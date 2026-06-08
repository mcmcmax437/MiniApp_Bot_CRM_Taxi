import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PaymentType } from "@taxi/shared";
import { useExpenses, usePayments } from "../hooks";
import type { Expense, Payment } from "../types";
import { Icon, SectionCard } from "./crm";
import { formatDate, formatMoney } from "./ui";

type ActivityKind = "income" | "expense";

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  amount: number;
  sortAt: number;
  partnerUnsettled?: boolean;
}

function paymentSortTime(p: Payment): number {
  return new Date(p.createdAt ?? p.date).getTime();
}

function expenseSortTime(e: Expense): number {
  return new Date(e.createdAt ?? e.date).getTime();
}

function paymentIsOutflow(type: PaymentType): boolean {
  return type === PaymentType.REFUND;
}

export function RecentActivitySection() {
  const { t } = useTranslation();
  const payments = usePayments();
  const expenses = useExpenses();

  const items = useMemo(() => {
    const rows: ActivityItem[] = [];

    for (const p of payments.data ?? []) {
      const outflow = paymentIsOutflow(p.type);
      const parts = [
        formatDate(p.date),
        p.driver?.fullName,
        p.car?.plate,
        p.note,
      ].filter(Boolean);
      rows.push({
        id: `payment-${p.id}`,
        kind: outflow ? "expense" : "income",
        title: `${t(`finance.${p.type}`)}${p.driver?.fullName ? ` · ${p.driver.fullName}` : ""}`,
        subtitle: parts.join(" · "),
        amount: p.amount,
        sortAt: paymentSortTime(p),
      });
    }

    for (const e of expenses.data ?? []) {
      const parts = [formatDate(e.date), e.car?.plate, e.note].filter(Boolean);
      if (e.paidByPartner && !e.partnerSettled) {
        parts.push(t("finance.partnerUnsettledBadge"));
      }
      rows.push({
        id: `expense-${e.id}`,
        kind: "expense",
        title: t(`finance.${e.category}`),
        subtitle: parts.join(" · "),
        amount: e.amount,
        sortAt: expenseSortTime(e),
        partnerUnsettled: e.paidByPartner && !e.partnerSettled,
      });
    }

    rows.sort((a, b) => b.sortAt - a.sortAt);
    return rows.slice(0, 25);
  }, [payments.data, expenses.data, t]);

  const loading = payments.isLoading || expenses.isLoading;

  return (
    <SectionCard
      storageKey="recent-activity"
      defaultOpen
      title={t("dashboard.recentActivity")}
      icon={<Icon name="receipt-dollar" size={24} color="var(--taxi-text-muted)" />}
    >
      {loading ? (
        <div className="crm-empty-box">
          <span className="crm-spinner" />
          <p>{t("common.loading")}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="crm-empty-box">
          <Icon name="invoice-01" size={42} color="var(--taxi-text-muted)" />
          <p className="crm-empty-box__title">{t("dashboard.noActivity")}</p>
        </div>
      ) : (
        <ul className="crm-activity-feed">
          {items.map((item) => (
            <li
              key={item.id}
              className={`crm-activity-feed__item crm-activity-feed__item--${item.kind}${item.partnerUnsettled ? " crm-activity-feed__item--partner-unsettled" : ""}`}
            >
              <div className="crm-activity-feed__main">
                <div className="crm-activity-feed__title">{item.title}</div>
                <div className="crm-activity-feed__meta">{item.subtitle}</div>
              </div>
              <div className={`crm-activity-feed__amount crm-activity-feed__amount--${item.kind}`}>
                {item.kind === "income" ? "+" : "−"}
                {formatMoney(item.amount)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
