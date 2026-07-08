import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDriverBalanceBreakdown } from "../hooks";
import type {
  DriverBalanceAccrual,
  DriverBalanceBreakdown,
  DriverBalancePaymentLine,
  DriverBalanceFineLine,
  RentPeriod,
} from "@taxi/shared";
import { Modal, formatDate, formatMoney } from "./ui";
import { Icon, SectionCard } from "./crm";

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
  const prefix = props.tone === "good" ? "+" : "";
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

// The breakdown now comes straight from the server (`/drivers/:id/
// balance/breakdown`) so the modal can't disagree with the driver
// card after a recent payment or agreement change. The server uses
// the same `rentDue - rentPaid - discounts + unpaidFines` formula
// that `computeDriverBalances` uses for `/balances`, guaranteeing
// the numbers the owner sees in two places always match.

const PERIOD_DAYS: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  YEARLY: 365,
};

function periodPerDay(rentAmount: number, period: RentPeriod): number {
  const days = PERIOD_DAYS[period] ?? 1;
  return rentAmount / days;
}

function ActiveRentalCard(props: { accrual: DriverBalanceAccrual }) {
  const { t } = useTranslation();
  const a = props.accrual;
  return (
    <div className="crm-contract-note crm-contract-note--active">
      <div className="crm-contract-note__row crm-contract-note__row--primary">
        <Icon name="car-01" size={16} color="var(--taxi-accent)" />
        <span>{a.carPlate}</span>
        <span>·</span>
        <span>{t(`drivers.${a.period}`)}</span>
      </div>
      <div className="crm-contract-note__row crm-contract-note__row--meta">
        {t("balanceBreakdown.startedOn", { date: formatDate(a.startDate) })}
      </div>
      <div className="crm-contract-note__row crm-contract-note__row--meta">
        {t("balanceBreakdown.daysRiding", { count: a.daysElapsed })}
      </div>
      <div className="crm-contract-note__row">
        <span>{t("balanceBreakdown.rentRate")}</span>
        <span>{formatMoney(a.rentAmount)}</span>
      </div>
      <div className="crm-contract-note__row">
        <span>{t("balanceBreakdown.accruedSoFar")}</span>
        <span>{formatMoney(a.accrued)}</span>
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
  const breakdownQuery = useDriverBalanceBreakdown(props.open ? props.driverId : null);
  const breakdown: DriverBalanceBreakdown | null = breakdownQuery.data ?? null;

  const loading = props.open && !breakdown;

  const balanceTone: "good" | "bad" | "neutral" =
    !breakdown ? "neutral" : breakdown.balance > 0.005 ? "bad" : breakdown.balance < -0.005 ? "good" : "neutral";

  // Per-day rent rate across all active accruals. The balance grows by
  // this amount each day the driver has the car, until they pay rent.
  // We surface the figure in the daily-accrual hint so the owner
  // understands why the balance keeps moving even when nothing has
  // changed since yesterday.
  const perDayText = useMemo(() => {
    if (!breakdown) return "";
    let perDay = 0;
    for (const a of breakdown.activeAccruals) {
      perDay += periodPerDay(a.rentAmount, a.period);
    }
    return formatMoney(perDay);
  }, [breakdown]);

  return (
    <Modal open={props.open} title={t("balanceBreakdown.title")} onClose={props.onClose}>
      {loading ? (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      ) : !breakdown ? (
        <div className="crm-empty-box">
          <p className="crm-form-hint">{t("common.empty")}</p>
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
                {t("balanceBreakdown.asOf", { date: formatDate(breakdown.asOf) })}
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

          {/* Hint that explains why the balance keeps growing day-to-day.
              Rent accrues continuously from each agreement's start, so a
              driver who hasn't paid this week keeps accumulating rent at
              the per-day rate until a rent payment is recorded. */}
          {breakdown.activeAccruals.length > 0 ? (
            <p
              className="crm-form-hint"
              style={{ marginTop: -4, marginBottom: 12 }}
            >
              {t("balanceBreakdown.dailyAccrualHint", { perDay: perDayText })}
            </p>
          ) : null}

          {props.onGiveDiscount ? (
            // The "give a discount" CTA used to launch the standalone
            // GiveDiscountModal. Discounts now live inline on the rent
            // payment form (one record per cash event), so this button
            // takes the user straight to the Finance → Add payment
            // flow, pre-filled with the driver and the active car.
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

          {breakdown.activeAccruals.length > 0 ? (
            <SectionCard
              title={t("balanceBreakdown.activeRentals")}
              icon={<Icon name="car-01" size={20} color="var(--taxi-text-muted)" />}
              defaultOpen
              storageKey="balance-bd-active-rentals"
            >
              <div className="crm-balance-rentals">
                {breakdown.activeAccruals.map((a) => (
                  <ActiveRentalCard key={a.agreementId} accrual={a} />
                ))}
              </div>
            </SectionCard>
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
                {breakdown.activeAccruals.map((a: DriverBalanceAccrual) => (
                  <MoneyLine
                    key={a.agreementId}
                    label={`${a.carPlate} · ${t(`drivers.${a.period}`)}`}
                    sublabel={`${t("balanceBreakdown.daysRiding", { count: a.daysElapsed })} · ${a.periods.toFixed(2)} × ${formatMoney(a.rentAmount)}`}
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
                {breakdown.rentPayments.map((p: DriverBalancePaymentLine) => (
                  <MoneyLine
                    key={p.id}
                    label={p.carPlate ?? "—"}
                    sublabel={`${formatDate(p.date)}${p.note ? ` · ${p.note}` : ""}`}
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
                {breakdown.discountPayments.map((p: DriverBalancePaymentLine) => (
                  <MoneyLine
                    key={p.id}
                    label={p.carPlate ?? "—"}
                    sublabel={`${formatDate(p.date)}${p.note ? ` · ${p.note}` : ""}`}
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
                {breakdown.unpaidFines.map((f: DriverBalanceFineLine) => (
                  <MoneyLine
                    key={f.id}
                    label={f.description ?? formatDate(f.date)}
                    sublabel={formatDate(f.date)}
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
