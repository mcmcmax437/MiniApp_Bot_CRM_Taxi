import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { getCurrencySymbol, useAppCurrency } from "../currency";
import { formatDate, isoDateOnly, todayInput } from "../dates";

export { formatMoney, getCurrencySymbol } from "../currency";
export { formatDate, isoDateOnly, todayInput };

const MODAL_CLOSE_MS = 300;

export type ModalHandle = { dismiss: () => void };

export type ModalProps = {
  open: boolean;
  title: string;
  /** Optional control rendered to the right of the title (e.g. refresh). */
  headerAction?: React.ReactNode;
  /** Called after the slide-down exit animation finishes. */
  onClose: () => void;
  backLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export const Modal = forwardRef<ModalHandle, ModalProps>(function Modal(props, ref) {
  const { t } = useTranslation();
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
      className={`crm-modal-overlay taxi-crm-theme${active ? " crm-modal-overlay--active" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
      aria-hidden={!active}
    >
      <div className="crm-modal-sheet" role="dialog" aria-modal="true">
        <div className="crm-modal-head">
          {props.backLabel ? (
            <button type="button" className="crm-modal-back" onClick={dismiss}>
              <span className="crm-modal-back__chevron" aria-hidden>
                ‹
              </span>
              {props.backLabel}
            </button>
          ) : null}
          <div className="crm-modal-head__row">
            <h3 className="crm-modal-head__title">{props.title}</h3>
            {props.headerAction ?? null}
            <button
              type="button"
              className="crm-modal-close"
              onClick={dismiss}
              aria-label={t("common.close")}
              data-stop-press="true"
            >
              ×
            </button>
          </div>
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
      <span className="crm-field-label">{props.label}</span>
      {props.children}
      {props.invalid && props.errorMessage ? (
        <span className="crm-field-error">{props.errorMessage}</span>
      ) : null}
    </label>
  );
}

function inputClass(invalid?: boolean): string {
  return invalid ? "crm-input crm-input--error" : "crm-input";
}

export function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  invalid?: boolean;
  list?: string;
}) {
  return (
    <input
      className={inputClass(props.invalid)}
      type={props.type ?? "text"}
      value={props.value}
      placeholder={props.placeholder}
      list={props.list}
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
  /** Show a clear button when a date is set. */
  clearable?: boolean;
  /** Minimum selectable date (YYYY-MM-DD). Earlier dates are blocked. */
  min?: string;
  /** Maximum selectable date (YYYY-MM-DD). Later dates are blocked. */
  max?: string;
}) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const example = props.example ?? props.placeholder;
  const empty = !props.value;
  const showExample = empty && Boolean(example) && !focused;
  const showClear = Boolean(props.clearable && props.value);
  const dateClass = `${inputClass(props.invalid)} crm-input-date${empty ? " crm-input-date--empty" : ""}`;

  return (
    <div className={`crm-date-field${showClear ? " crm-date-field--clearable" : ""}`}>
      <input
        className={`${dateClass} crm-date-field__input`}
        type="date"
        value={props.value}
        min={props.min}
        max={props.max}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {showExample ? <span className="crm-date-field__example">{example}</span> : null}
      {showClear ? (
        <button
          type="button"
          className="crm-date-field__clear"
          aria-label={t("common.clear")}
          data-stop-press="true"
          // On iOS Safari, tapping inside a <input type="date"> opens the
          // native picker. We have to cancel the gesture at every stage:
          // touchstart, pointerdown and mousedown. preventDefault on each
          // of these is what stops the picker from opening; the click
          // handler then commits the empty value.
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.onChange("");
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function PasswordInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="crm-password-field">
      <input
        className={inputClass(props.invalid)}
        type={visible ? "text" : "password"}
        value={props.value}
        placeholder={props.placeholder}
        autoComplete="off"
        onChange={(e) => props.onChange(e.target.value)}
      />
      <button
        type="button"
        className="crm-password-field__toggle"
        aria-label={visible ? t("common.hide") : t("common.show")}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? t("common.hide") : t("common.show")}
      </button>
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

export function SearchableSelect<T extends string>(props: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards the option click from being eaten by the document-close handler
  // or by an input blur on iOS Safari. The synthetic mousedown that iOS
  // dispatches ~300ms after a tap must not collapse the just-set selection.
  const justPickedRef = useRef(0);

  const selected = props.options.find((o) => o.value === props.value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.options;
    return props.options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.hint ? o.hint.toLowerCase().includes(q) : false),
    );
  }, [props.options, query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      // Skip the synthetic mousedown iOS dispatches after a tap on an option
      // we just handled. Otherwise the selection would be wiped out.
      if (Date.now() - justPickedRef.current < 800) return;
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  function pick(value: T) {
    justPickedRef.current = Date.now();
    props.onChange(value);
    setOpen(false);
    setQuery("");
    // Defer the blur by one tick so iOS Safari doesn't hide the keyboard /
    // shift the viewport before the state update commits. The dropdown
    // closes anyway, so the user sees the selected label without the input
    // stealing focus back.
    setTimeout(() => {
      inputRef.current?.blur();
    }, 0);
  }

  const displayValue = open ? query : (selected?.label ?? "");
  const searchPh = props.searchPlaceholder ?? t("common.searchToFilter");

  return (
    <div className={`crm-searchable-select${open ? " crm-searchable-select--open" : ""}`} ref={rootRef}>
      <input
        ref={inputRef}
        className={inputClass(props.invalid)}
        value={displayValue}
        placeholder={open ? searchPh : (props.placeholder ?? searchPh)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
            inputRef.current?.blur();
          }
          if (e.key === "Enter") {
            e.preventDefault();
            const first = filtered[0];
            if (first) pick(first.value);
          }
        }}
      />
      {open ? (
        filtered.length > 0 ? (
          <ul className="crm-searchable-select__list" role="listbox">
              {filtered.map((o) => (
                <li key={o.value || "__none"}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === props.value}
                    data-stop-press="true"
                    className={`crm-searchable-select__option${o.value === props.value ? " crm-searchable-select__option--active" : ""}`}
                    // touchstart fires first on iOS Safari and lets us commit
                    // the selection before the input can lose focus. We
                    // preventDefault to suppress the synthetic click/mousedown
                    // that would otherwise collapse the just-picked option.
                    onTouchStart={(e) => {
                      e.preventDefault();
                      pick(o.value);
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      pick(o.value);
                    }}
                  >
                    <span className="crm-searchable-select__label">{o.label}</span>
                    {o.hint ? <span className="crm-searchable-select__hint">{o.hint}</span> : null}
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <div className="crm-searchable-select__empty">{t("common.empty")}</div>
        )
      ) : null}
    </div>
  );
}

/** Copies `value` on double-tap (touch) or double-click (desktop). */
export function CopyOnDoubleTap(props: {
  value: string;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const lastTapRef = useRef(0);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = props.value.trim();
    if (!text || text === "—") return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be unavailable in some WebViews */
    }
  }

  function onTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 400) void copy();
    lastTapRef.current = now;
  }

  return (
    <span
      className={["crm-copyable", copied ? "crm-copyable--copied" : "", props.className]
        .filter(Boolean)
        .join(" ")}
      onDoubleClick={() => void copy()}
      onClick={onTap}
      title={copied ? t("common.copied") : t("common.doubleTapToCopy")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") void copy();
      }}
    >
      {props.children ?? props.value}
    </span>
  );
}

export function FormActions(props: { onCancel: () => void; onSave: () => void; saving?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="crm-form-actions">
      <button type="button" className="crm-btn-outline" onClick={props.onCancel} disabled={props.saving}>
        {t("common.cancel")}
      </button>
      <button type="button" className="crm-btn-primary" onClick={props.onSave} disabled={props.saving}>
        {props.saving ? <span className="crm-spinner crm-form-actions__spinner" aria-hidden /> : null}
        <span>{t("common.save")}</span>
      </button>
    </div>
  );
}

export function MoneyNumberInput(props: {
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  useAppCurrency();
  const symbol = getCurrencySymbol();

  return (
    <div className="crm-money-input">
      <NumberInput {...props} />
      <span className="crm-money-input__symbol" aria-hidden>
        {symbol}
      </span>
    </div>
  );
}
