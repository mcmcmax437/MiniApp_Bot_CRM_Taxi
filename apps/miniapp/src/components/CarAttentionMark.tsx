import { useMemo, useState } from "react";
import type { ReminderItem } from "@taxi/shared";
import { useTranslation } from "react-i18next";
import { carAttentionReasons } from "./carAttention";

export function CarAttentionMark(props: {
  carId?: string;
  reminders?: ReminderItem[];
  title?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const reasons = useMemo(() => {
    if (props.title) return [props.title];
    if (props.carId && props.reminders?.length) {
      const list = carAttentionReasons(props.carId, props.reminders, t);
      if (list.length > 0) return list;
    }
    return [t("cars.attentionNeeded")];
  }, [props.carId, props.reminders, props.title, t]);

  const tooltip = reasons.join("\n");

  return (
    <span className="crm-car-attention-wrap">
      <button
        type="button"
        className="crm-car-attention"
        title={tooltip}
        aria-label={tooltip}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        data-stop-press="true"
      >
        !
      </button>
      {open ? (
        <div className="crm-car-attention-popover" role="tooltip">
          <div className="crm-car-attention-popover__title">{t("cars.attentionNeeded")}</div>
          <ul className="crm-car-attention-popover__list">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
