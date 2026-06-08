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
      icon: <Icon name="car-01" size={24} color="var(--taxi-text-muted)" />,
    },
    {
      kind: "drivers",
      title: t("importData.drivers"),
      subtitle: t("importData.driversHint"),
      icon: <Icon name="user" size={24} color="var(--taxi-text-muted)" />,
    },
    {
      kind: "payments",
      title: t("importData.payments"),
      subtitle: t("importData.paymentsHint"),
      icon: <Icon name="dollar-01" size={24} color="var(--taxi-text-muted)" />,
    },
  ];

  return (
    <SectionCard
      title={t("importData.title")}
      icon={<Icon name="upload-01" size={24} color="var(--taxi-text-muted)" />}
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
        <Icon className="crm-info-banner__icon" name="information-circle" size={24} color="#448AFF" />
        <p>{t("importData.hint")}</p>
      </div>
    </SectionCard>
  );
}
