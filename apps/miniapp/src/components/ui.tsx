import React from "react";
import { Button } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

export function Modal(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          background: "var(--tgui--bg_color, #fff)",
          width: "100%",
          maxWidth: 520,
          maxHeight: "92vh",
          overflowY: "auto",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: "16px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "4px 0 12px", fontSize: 18 }}>{props.title}</h3>
        {props.children}
        <div style={{ marginTop: 16 }}>{props.footer}</div>
      </div>
    </div>
  );
}

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
  invalid?: boolean;
}) {
  return (
    <input
      className={inputClass(props.invalid)}
      style={inputStyle}
      type="number"
      inputMode="decimal"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );
}

export function DateInput(props: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <input
      className={inputClass(props.invalid)}
      style={inputStyle}
      type="date"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
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
