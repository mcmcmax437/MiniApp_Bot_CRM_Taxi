import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AgreementStatus, agreementDriverDisplayName, agreementIsTemporaryDriver } from "@taxi/shared";
import { useDeleteAgreement } from "../../hooks";
import { confirmAction } from "../../telegram";
import type { Agreement } from "../../types";
import { Modal, formatDate, formatMoney } from "../ui";
import { Icon, IconActionButton } from "../crm";
import { AgreementEditModal } from "./AgreementEditModal";

export function CarDriverHistoryModal(props: {
  open: boolean;
  carPlate: string;
  carSubtitle?: string;
  history: Agreement[];
  readOnly?: boolean;
  onClose: () => void;
  onAddPast?: () => void;
}) {
  const { t } = useTranslation();
  const del = useDeleteAgreement();
  const [editing, setEditing] = useState<Agreement | null>(null);

  async function handleDelete(agreement: Agreement) {
    const active = agreement.status === AgreementStatus.ACTIVE;
    const ok = await confirmAction(
      active ? t("fleet.deleteActiveHistoryConfirm") : t("fleet.deleteHistoryConfirm"),
      t("common.delete"),
      t("common.cancel"),
    );
    if (!ok) return;
    del.mutate(agreement.id);
  }

  return (
    <>
      <Modal open={props.open} title={t("fleet.driverHistoryTitle")} onClose={props.onClose}>
        <div className="crm-fleet-history-head">
          <span className="crm-fleet-history-head__plate">{props.carPlate}</span>
          {props.carSubtitle ? (
            <span className="crm-fleet-history-head__subtitle">{props.carSubtitle}</span>
          ) : null}
        </div>
        <p className="crm-form-hint">{t("fleet.driverHistoryHint")}</p>
        {props.history.length === 0 ? (
          <p className="crm-form-hint">{t("fleet.noDriverHistory")}</p>
        ) : (
          <ul className="crm-fleet-history">
            {props.history.map((agreement) => {
              const active = agreement.status === AgreementStatus.ACTIVE;
              const endLabel = active
                ? t("fleet.present")
                : agreement.endDate
                  ? formatDate(agreement.endDate)
                  : "—";
              const deleting = del.isPending && del.variables === agreement.id;
              return (
                <li
                  key={agreement.id}
                  className={`crm-fleet-history__item${active ? " crm-fleet-history__item--active" : ""}`}
                >
                  <div className="crm-fleet-history__row">
                    <div className="crm-fleet-history__content">
                      <div className="crm-fleet-history__top">
                        <span className="crm-fleet-history__driver">
                          <Icon
                            name="user"
                            size={14}
                            color={active ? "#69f0ae" : "rgba(255,255,255,0.55)"}
                          />
                          {agreementDriverDisplayName(agreement)}
                          {agreementIsTemporaryDriver(agreement) ? (
                            <span className="crm-fleet-card__temp-badge">
                              {t("fleet.temporaryDriver")}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`crm-fleet-history__status${active ? " crm-fleet-history__status--active" : ""}`}
                        >
                          {active ? t("fleet.rentalActive") : t("fleet.rentalEnded")}
                        </span>
                      </div>
                      <div className="crm-fleet-history__dates">
                        {formatDate(agreement.startDate)} — {endLabel}
                      </div>
                      <div className="crm-fleet-history__rent">
                        {formatMoney(agreement.rentAmount)} / {t(`drivers.${agreement.period}`)}
                        {agreement.depositAmount > 0
                          ? ` · ${t("drivers.deposit")}: ${formatMoney(agreement.depositAmount)}`
                          : null}
                      </div>
                    </div>
                    {!props.readOnly ? (
                      <div className="crm-fleet-history__actions">
                        <IconActionButton
                          icon="edit-02"
                          label={t("fleet.editRental")}
                          size={16}
                          className="crm-fleet-history__edit"
                          onClick={() => setEditing(agreement)}
                        />
                        <button
                          type="button"
                          className="crm-icon-btn crm-icon-btn--sm crm-fleet-history__delete"
                          disabled={deleting}
                          aria-label={t("common.delete")}
                          onClick={() => void handleDelete(agreement)}
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!props.readOnly && props.onAddPast ? (
          <button type="button" className="crm-btn-outline crm-fleet-history-add" onClick={props.onAddPast}>
            + {t("fleet.addPastRental")}
          </button>
        ) : null}
      </Modal>

      <AgreementEditModal
        agreement={editing}
        open={editing != null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
