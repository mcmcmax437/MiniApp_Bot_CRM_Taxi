import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GlassButton, Icon, SectionCard } from "./crm";
import { useImport } from "../hooks";

type Kind = "cars" | "drivers" | "payments";

export function ImportSection() {
  const { t } = useTranslation();
  const imp = useImport();
  const [message, setMessage] = useState<string | null>(null);
  const refs = {
    cars: useRef<HTMLInputElement>(null),
    drivers: useRef<HTMLInputElement>(null),
    payments: useRef<HTMLInputElement>(null),
  };

  function handleFile(kind: Kind, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const csv = String(reader.result ?? "");
      imp.mutate(
        { kind, csv },
        {
          onSuccess: (res) => {
            const errors = res.errors.length ? ` (${res.errors.length} errors)` : "";
            setMessage(t("importData.result", { created: res.created, total: res.total }) + errors);
          },
          onError: () => setMessage(t("common.error")),
        },
      );
    };
    reader.readAsText(file);
  }

  const items: { kind: Kind; title: string; subtitle: string; icon: ReactNode }[] = [
    {
      kind: "cars",
      title: t("importData.cars"),
      subtitle: t("importData.carsHint"),
      icon: (
        <Icon fill="var(--taxi-text-muted)">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM5 11l1.5-4.5h11L19 11H5z" />
        </Icon>
      ),
    },
    {
      kind: "drivers",
      title: t("importData.drivers"),
      subtitle: t("importData.driversHint"),
      icon: (
        <Icon stroke="var(--taxi-text-muted)" fill="none">
          <circle cx="12" cy="8" r="3.5" strokeWidth="1.8" />
          <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeWidth="1.8" strokeLinecap="round" />
        </Icon>
      ),
    },
    {
      kind: "payments",
      title: t("importData.payments"),
      subtitle: t("importData.paymentsHint"),
      icon: (
        <Icon stroke="var(--taxi-text-muted)" fill="none">
          <path d="M12 3v18M7 8h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6" strokeWidth="1.8" strokeLinecap="round" />
        </Icon>
      ),
    },
  ];

  return (
    <SectionCard
      title={t("importData.title")}
      icon={
        <Icon stroke="var(--taxi-text-muted)" fill="none">
          <path d="M8 17l-4 4V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 12v5M9.5 14.5 12 12l2.5 2.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </Icon>
      }
    >
      <div className="crm-import-grid">
        {items.map((item) => (
          <div key={item.kind} className="crm-import-grid__cell">
            <input
              ref={refs[item.kind]}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(item.kind, file);
                if (refs[item.kind].current) refs[item.kind].current!.value = "";
              }}
            />
            <GlassButton
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              loading={imp.isPending && imp.variables?.kind === item.kind}
              onClick={() => refs[item.kind].current?.click()}
            />
          </div>
        ))}
      </div>

      {message ? <p className="crm-message">{message}</p> : null}

      <div className="crm-info-banner glass-card">
        <Icon className="crm-info-banner__icon" stroke="#448AFF" fill="none">
          <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          <path d="M12 8v1M12 11v5" strokeWidth="1.8" strokeLinecap="round" />
        </Icon>
        <p>{t("importData.hint")}</p>
      </div>
    </SectionCard>
  );
}
