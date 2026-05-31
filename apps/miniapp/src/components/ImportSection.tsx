import { useRef, useState } from "react";
import { Section, Cell, Button } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
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

  const buttons: { kind: Kind; label: string }[] = [
    { kind: "cars", label: t("importData.cars") },
    { kind: "drivers", label: t("importData.drivers") },
    { kind: "payments", label: t("importData.payments") },
  ];

  return (
    <Section header={t("importData.title")} footer={t("importData.hint")}>
      {message && <Cell>{message}</Cell>}
      {buttons.map((b) => (
        <div key={b.kind} style={{ padding: "4px 16px" }}>
          <input
            ref={refs[b.kind]}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(b.kind, file);
              if (refs[b.kind].current) refs[b.kind].current!.value = "";
            }}
          />
          <Button
            mode="outline"
            stretched
            loading={imp.isPending && imp.variables?.kind === b.kind}
            onClick={() => refs[b.kind].current?.click()}
          >
            {b.label}
          </Button>
        </div>
      ))}
    </Section>
  );
}
