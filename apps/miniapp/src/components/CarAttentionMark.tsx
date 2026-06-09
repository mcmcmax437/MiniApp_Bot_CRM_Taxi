import { useTranslation } from "react-i18next";

export function CarAttentionMark(props: { title?: string }) {
  const { t } = useTranslation();
  const label = props.title ?? t("cars.attentionNeeded");
  return (
    <span className="crm-car-attention" title={label} aria-label={label}>
      !
    </span>
  );
}
