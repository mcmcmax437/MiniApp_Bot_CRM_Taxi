import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Field, TextInput } from "./ui";
import { GlassButton, Icon, SectionCard } from "./crm";
import { useImport } from "../hooks";

type Kind = "cars" | "drivers" | "payments" | "expenses";

function countLines(text: string): number {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

export function ImportSection() {
  const { t } = useTranslation();
  const imp = useImport();
  const [text, setText] = useState<{ cars: string; drivers: string; payments: string; expenses: string }>({
    cars: "",
    drivers: "",
    payments: "",
    expenses: "",
  });
  const [activeKind, setActiveKind] = useState<Kind | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lineCount = useMemo(() => countLines(text[activeKind ?? "cars"]), [text, activeKind]);

  function pasteExample(kind: Kind) {
    setText((prev) => ({ ...prev, [kind]: t(`importData.${kind}Example`) }));
    setActiveKind(kind);
    setMessage(null);
  }

  function handlePaste(kind: Kind) {
    void (async () => {
      try {
        const clip = await navigator.clipboard.readText();
        setText((prev) => ({ ...prev, [kind]: clip }));
        setActiveKind(kind);
        setMessage(null);
      } catch {
        setMessage(t("common.error"));
      }
    })();
  }

  function clearAll() {
    setText({ cars: "", drivers: "", payments: "", expenses: "" });
    setActiveKind(null);
    setMessage(null);
  }

  function submit(kind: Kind) {
    const value = text[kind].trim();
    if (!value) {
      setMessage(t("importData.needMoreInfo"));
      return;
    }
    setActiveKind(kind);
    imp.mutate(
      { kind, text: value },
      {
        onSuccess: (res) => {
          const errors = res.errors.length ? ` (${res.errors.length} errors)` : "";
          setMessage(t("importData.result", { created: res.created, total: res.total }) + errors);
          setText((prev) => ({ ...prev, [kind]: "" }));
        },
        onError: () => setMessage(t("common.error")),
      },
    );
  }

  const items: { kind: Kind; title: string; subtitle: string; icon: ReactNode }[] = [
    {
      kind: "payments",
      title: t("importData.payments"),
      subtitle: t("importData.paymentsHint"),
      icon: <Icon name="dollar-01" size={24} color="var(--taxi-text-muted)" />,
    },
    {
      kind: "expenses",
      title: t("importData.expenses"),
      subtitle: t("importData.expensesHint"),
      icon: <Icon name="fire" size={24} color="var(--taxi-text-muted)" />,
    },
    {
      kind: "cars",
      title: t("importData.cars"),
      subtitle: t("importData.carsHint"),
      icon: <Icon name="car-01" size={24} color="var(--taxi-text-muted)" />,
    },
    {
      kind: "drivers",
      title: t("importData.drivers"),
      subtitle: t("importData.driversHint"),
      icon: <Icon name="user" size={24} color="var(--taxi-text-muted)" />,
    },
  ];

  return (
    <SectionCard
      storageKey="import"
      defaultOpen={false}
      title={t("importData.title")}
      icon={<Icon name="upload-01" size={24} color="var(--taxi-text-muted)" />}
    >
      <div className="crm-import-grid">
        {items.map((item) => (
          <div
            key={item.kind}
            className={`crm-import-grid__cell${activeKind === item.kind ? " crm-import-grid__cell--active" : ""}`}
            onClick={() => {
              setActiveKind(item.kind);
              setMessage(null);
            }}
          >
            <GlassButton
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              onClick={() => {
                setActiveKind(item.kind);
                setMessage(null);
              }}
            />
          </div>
        ))}
      </div>

      {activeKind ? (
        <div className="crm-import-paste">
          <Field label={t(`importData.${activeKind}`)}>
            <TextInput
              value={text[activeKind]}
              onChange={(v) => setText((prev) => ({ ...prev, [activeKind]: v }))}
              placeholder={t("importData.placeholder")}
            />
          </Field>
          <p className="crm-form-hint">
            {text[activeKind].trim()
              ? t("importData.pasteDetected", { count: lineCount })
              : t("importData.hint")}
          </p>
          <div className="crm-import-paste__actions">
            <button
              type="button"
              className="crm-btn-primary"
              disabled={imp.isPending || !text[activeKind].trim()}
              onClick={() => submit(activeKind)}
            >
              {imp.isPending && imp.variables?.kind === activeKind ? (
                <span className="crm-spinner crm-form-actions__spinner" aria-hidden />
              ) : null}
              <span>{t("importData.paste")}</span>
            </button>
            <button
              type="button"
              className="crm-btn-outline"
              onClick={() => handlePaste(activeKind)}
            >
              {t("common.copy")} ↘
            </button>
            <button type="button" className="crm-btn-outline" onClick={clearAll}>
              {t("importData.clear")}
            </button>
            <button
              type="button"
              className="crm-link-btn"
              onClick={() => pasteExample(activeKind)}
            >
              {t("importData.placeholder")}: example
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="crm-message">{message}</p> : null}
    </SectionCard>
  );
}
