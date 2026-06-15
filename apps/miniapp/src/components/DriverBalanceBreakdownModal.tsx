import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAgreements, useFines, usePayments } from "../hooks";
import { Modal, formatDate, formatMoney } from "./ui";
import { Icon, SectionCard } from "./crm";
import { buildDriverBalanceBreakdown, type DriverBalanceBreakdown } from "../balanceBreakdown";

function SumRow(props: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  const toneColor =
    props.tone === "good" ? "#69f0ae" : props.tone === "bad" ? "#ff5252" : "rgba(255,255,255,0.85)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.7)" }}>{props.label}</span>
      <span style={{ color: toneColor, fontVariantNumeric: "tabular-nums" }}>{props.value}</span>
    </div>
  );
}

function MoneyLine(props: { label: string; sublabel?: string; amount: number; tone?: "neutral" | "good" | "bad" }) {
  const toneColor =
    props.tone === "good" ? "#69f0ae" : props.tone === "bad" ? "#ff5252" : "rgba(255,255,255,0.85)";
  const prefix = props.tone === "good" ? "−" : props.tone === "bad" ? "+" : "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 0",
        gap: 8,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{props.label}</div>
        {props.sublabel ? (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>{props.sublabel}</div>
        ) : null}
      </div>
      <div style={{ color: toneColor, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {prefix}
        {formatMoney(props.amount)}
      </div>
    </div>
  );
}

export function DriverBalanceBreakdownModal(props: {
  open: boolean;
  driverId: string | null;
  driverName: string;
  onClose: () => void;
  onGiveDiscount?: () => void;
}) {
  const { t } = useTranslation();
  const agreements = useAgreements();
  const payments = usePayments();
  const fines = useFines();

  const breakdown: DriverBalanceBreakdown | null = useMemo(() => {
    if (!props.open || !props.driverId) return null;
    return buildDriverBalanceBreakdown({
      driverId: props.driverId,
      driverName: props.driverName,
      agreements: agreements.data ?? [],
      payments: payments.data ?? [],
      fines: fines.data ?? [],
    });
  }, [props.open, props.driverId, props.driverName, agreements.data, payments.data, fines.data]);

  const loading = !breakdown;

  const balanceTone: "good" | "bad" | "neutral" =
    !breakdown ? "neutral" : breakdown.balance > 0.005 ? "bad" : breakdown.balance < -0.005 ? "good" : "neutral";

  return (
    <Modal open={props.open} title={t("balanceBreakdown.title")} onClose={props.onClose}>
      {loading ? (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                {t("balanceBreakdown.driver")}
              </div>
              <div style={{ color: "rgba(255,255,255,0.95)", fontWeight: 600 }}>{breakdown.driverName}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>
                {t("balanceBreakdown.asOf", { date: formatDate(breakdown.asOf.toISOString()) })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{t("drivers.balance")}</div>
              <div
                style={{
                  color: balanceTone === "bad" ? "#ff5252" : balanceTone === "good" ? "#69f0ae" : "rgba(255,255,255,0.95)",
                  fontWeight: 700,
                  fontSize: 22,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatMoney(breakdown.balance)}
              </div>
            </div>
          </div>

          {props.onGiveDiscount ? (
            <button
              type="button"
              className="crm-btn-outline crm-discount-cta"
              onClick={props.onGiveDiscount}
              data-stop-press="true"
            >
              <Icon name="receipt-dollar" size={16} color="#ffc107" />
              <span>{t("discount.giveDiscount")}</span>
            </button>
          ) : null}

          <SectionCard
            title={t("balanceBreakdown.rentAccrued")}
            icon={<Icon name="car-01" size={20} color="var(--taxi-text-muted)" />}
            defaultOpen
            storageKey="balance-bd-accruals"
          >
            {breakdown.activeAccruals.length === 0 ? (
              <p className="crm-form-hint">{t("balanceBreakdown.noActiveAgreements")}</p>
            ) : (
              <>
                {breakdown.activeAccruals.map((a) => (
                  <MoneyLine
                    key={a.agreementId}
                    label={`${a.carPlate} · ${t(`drivers.${a.period}`)}`}
                    sublabel={`${t("balanceBreakdown.since")} ${formatDate(a.startDate.toISOString())} · ${a.daysElapsed} ${t("balanceBreakdown.days")} · ${a.periods.toFixed(2)} × ${formatMoney(a.rentAmount)}`}
                    amount={a.accrued}
                    tone="bad"
                  />
                ))}
                <SumRow
                  label={t("balanceBreakdown.totalRentDue")}
                  value={formatMoney(breakdown.rentDue)}
                  tone="bad"
                />
              </>
            )}
          </SectionCard>

          <SectionCard
            title={t("balanceBreakdown.rentPaid")}
            icon={<Icon name="credit-card" size={20} color="var(--taxi-text-muted)" />}
            defaultOpen
            storageKey="balance-bd-rent-paid"
          >
            {breakdown.rentPayments.length === 0 ? (
              <p className="crm-form-hint">{t("balanceBreakdown.noRentPayments")}</p>
            ) : (
              <>
                {breakdown.rentPayments.map((p) => (
                  <MoneyLine
                    key={p.id}
                    label={p.carPlate ?? "—"}
                    sublabel={`${formatDate(p.date.toISOString())}${p.note ? ` · ${p.note}` : ""}`}
                    amount={p.amount}
                    tone="good"
                  />
                ))}
                <SumRow
                  label={t("balanceBreakdown.totalRentPaid")}
                  value={formatMoney(breakdown.rentPaid)}
                  tone="good"
                />
              </>
            )}
          </SectionCard>

          <SectionCard
            title={t("balanceBreakdown.discounts")}
            icon={<Icon name="wallet-01" size={20} color="var(--taxi-text-muted)" />}
            storageKey="balance-bd-discounts"
          >
            {breakdown.discountPayments.length === 0 ? (
              <p className="crm-form-hint">{t("balanceBreakdown.noDiscounts")}</p>
            ) : (
              <>
                {breakdown.discountPayments.map((p) => (
                  <MoneyLine
                    key={p.id}
                    label={p.carPlate ?? "—"}
                    sublabel={`${formatDate(p.date.toISOString())}${p.note ? ` · ${p.note}` : ""}`}
                    amount={p.amount}
                    tone="good"
                  />
                ))}
                <SumRow
                  label={t("balanceBreakdown.totalDiscounts")}
                  value={formatMoney(breakdown.discounts)}
                  tone="good"
                />
              </>
            )}
          </SectionCard>

          <SectionCard
            title={t("balanceBreakdown.unpaidFines")}
            icon={<Icon name="notification-01" size={20} color="var(--taxi-text-muted)" />}
            storageKey="balance-bd-fines"
          >
            {breakdown.unpaidFines.length === 0 ? (
              <p className="crm-form-hint">{t("balanceBreakdown.noFines")}</p>
            ) : (
              <>
                {breakdown.unpaidFines.map((f) => (
                  <MoneyLine
                    key={f.id}
                    label={f.description ?? formatDate(f.date.toISOString())}
                    sublabel={formatDate(f.date.toISOString())}
                    amount={f.amount}
                    tone="bad"
                  />
                ))}
                <SumRow
                  label={t("balanceBreakdown.totalFines")}
                  value={formatMoney(breakdown.unpaidFinesTotal)}
                  tone="bad"
                />
              </>
            )}
          </SectionCard>

          <SectionCard
            title={t("balanceBreakdown.formula")}
            icon={<Icon name="chart-bar-line" size={20} color="var(--taxi-text-muted)" />}
            defaultOpen
            storageKey="balance-bd-formula"
          >
            <div className="crm-formula">
              <div className="crm-formula__row">
                <span>{t("balanceBreakdown.formulaRentDue")}</span>
                <span>{formatMoney(breakdown.rentDue)}</span>
              </div>
              <div className="crm-formula__op">−</div>
              <div className="crm-formula__row">
                <span>{t("balanceBreakdown.formulaRentPaid")}</span>
                <span>{formatMoney(breakdown.rentPaid)}</span>
              </div>
              <div className="crm-formula__op">−</div>
              <div className="crm-formula__row">
                <span>{t("balanceBreakdown.formulaDiscounts")}</span>
                <span>{formatMoney(breakdown.discounts)}</span>
              </div>
              <div className="crm-formula__op">+</div>
              <div className="crm-formula__row">
                <span>{t("balanceBreakdown.formulaFines")}</span>
                <span>{formatMoney(breakdown.unpaidFinesTotal)}</span>
              </div>
              <div className="crm-formula__divider" />
              <div className="crm-formula__total">
                <span>{t("drivers.balance")}</span>
                <span
                  style={{
                    color: balanceTone === "bad" ? "#ff5252" : balanceTone === "good" ? "#69f0ae" : undefined,
                  }}
                >
                  {formatMoney(breakdown.balance)}
                </span>
              </div>
            </div>
            <p className="crm-form-hint">{t("balanceBreakdown.depositHeld", { amount: formatMoney(breakdown.depositHeld) })}</p>
          </SectionCard>
        </>
      )}
    </Modal>
  );
}
