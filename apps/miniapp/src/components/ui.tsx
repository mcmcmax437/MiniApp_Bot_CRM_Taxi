import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

const MODAL_CLOSE_MS = 300;

export type ModalHandle = { dismiss: () => void };

export type ModalProps = {
  open: boolean;
  title: string;
  /** Called after the slide-down exit animation finishes. */
  onClose: () => void;
  backLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export const Modal = forwardRef<ModalHandle, ModalProps>(function Modal(props, ref) {
  const [render, setRender] = useState(props.open);
  const [active, setActive] = useState(false);
  const exitingRef = useRef(false);

  const dismiss = useCallback(() => {
    if (!render || exitingRef.current) return;
    exitingRef.current = true;
    setActive(false);
  }, [render]);

  useImperativeHandle(ref, () => ({ dismiss }), [dismiss]);

  useEffect(() => {
    if (props.open) {
      exitingRef.current = false;
      setRender(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    if (render) dismiss();
  }, [props.open, render, dismiss]);

  useEffect(() => {
    if (!active && render && exitingRef.current) {
      const timer = window.setTimeout(() => {
        exitingRef.current = false;
        setRender(false);
        props.onClose();
      }, MODAL_CLOSE_MS);
      return () => clearTimeout(timer);
    }
  }, [active, render, props.onClose]);

  if (!render) return null;

  return createPortal(
    <div
      className={`crm-modal-overlay${active ? " crm-modal-overlay--active" : ""}`}
      onClick={dismiss}
      aria-hidden={!active}
    >
      <div className="crm-modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="crm-modal-head">
          {props.backLabel ? (
            <button type="button" className="crm-modal-back" onClick={dismiss}>
              <span className="crm-modal-back__chevron" aria-hidden>
                ‹
              </span>
              {props.backLabel}
            </button>
          ) : null}
          <h3 className="crm-modal-head__title">{props.title}</h3>
        </div>
        <div className="crm-modal-body">{props.children}</div>
        {props.footer ? <div className="crm-modal-footer">{props.footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
});

export function Field(props: {
  label: string;
  children: React.ReactNode;
  invalid?: boolean;
  errorMessage?: string;
}) {
  return (
    <label className={`form-stack${props.invalid ? " crm-field--error" : ""}`}>
      <span style={{ fontSize: 13, color: "var(--tgui--hint_color, #8e8e93)" }}>{props.label}</span>
      {props.children}
      {props.invalid && props.errorMessage ? (
        <span className="crm-field-error">{props.errorMessage}</span>
      ) : null}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--tgui--outline, #d1d1d6)",
  background: "var(--tgui--secondary_bg_color, #f2f2f7)",
  color: "var(--tgui--text_color, #000)",
  fontSize: 16,
};

function inputClass(invalid?: boolean): string {
  return invalid ? "crm-input crm-input--error" : "crm-input";
}

export function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <input
      className={inputClass(props.invalid)}
      style={inputStyle}
      type={props.type ?? "text"}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function NumberInput(props: {
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <input
      className={inputClass(props.invalid)}
      style={inputStyle}
      type="number"
      inputMode="decimal"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );
}

export function DateInput(props: {
  value: string;
  onChange: (v: string) => void;
  /** Example date shown when empty (avoids clashing with the browser date mask). */
  example?: string;
  /** @deprecated Use `example` */
  placeholder?: string;
  invalid?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const example = props.example ?? props.placeholder;
  const empty = !props.value;
  const showExample = empty && Boolean(example) && !focused;
  const dateClass = `${inputClass(props.invalid)} crm-input-date${empty ? " crm-input-date--empty" : ""}`;

  return (
    <div className="crm-date-field">
      <input
        className={dateClass}
        style={inputStyle}
        type="date"
        value={props.value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {showExample ? <span className="crm-date-field__example">{example}</span> : null}
    </div>
  );
}

export function SelectInput<T extends string>(props: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  invalid?: boolean;
}) {
  return (
    <select
      className={inputClass(props.invalid)}
      style={inputStyle}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value as T)}
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FormActions(props: { onCancel: () => void; onSave: () => void; saving?: boolean }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Button mode="outline" stretched onClick={props.onCancel} type="button">
        {t("common.cancel")}
      </Button>
      <Button stretched onClick={props.onSave} loading={props.saving} type="button">
        {t("common.save")}
      </Button>
    </div>
  );
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}
