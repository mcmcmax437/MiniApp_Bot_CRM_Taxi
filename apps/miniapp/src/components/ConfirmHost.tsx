import { useEffect, useState } from "react";
import { answerConfirm, getPendingConfirm, subscribeConfirm } from "../confirmBridge";

export function ConfirmHost() {
  const [, tick] = useState(0);

  useEffect(() => subscribeConfirm(() => tick((n) => n + 1)), []);

  const pending = getPendingConfirm();
  if (!pending) return null;

  return (
    <div className="crm-confirm-overlay" role="presentation">
      <div className="crm-confirm-sheet" role="alertdialog" aria-modal="true">
        <p className="crm-confirm-sheet__message">{pending.message}</p>
        <div className="crm-confirm-sheet__actions">
          <button type="button" className="crm-btn-outline" onClick={() => answerConfirm(false)}>
            {pending.cancelLabel}
          </button>
          <button type="button" className="crm-btn-danger" onClick={() => answerConfirm(true)}>
            {pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
