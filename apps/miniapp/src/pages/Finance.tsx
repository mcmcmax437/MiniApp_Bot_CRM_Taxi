import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PAYMENT_METHODS, PaymentMethod, PaymentType, ExpenseCategory } from "@taxi/shared";
import {
  usePayments,
  useExpenses,
  useBalances,
  useDrivers,
  useCars,
  useAgreements,
  useSavePayment,
  useDeletePayment,
  useSaveExpense,
  useDeleteExpense,
} from "../hooks";
import {
  agreementHintForCar,
  agreementHintForDriver,
  rankCarsForDriver,
  rankDriversForCar,
} from "../driverCarSuggestions";
import type { Agreement } from "../types";
import { FleetTab } from "../components/finance/FleetTab";
import { TaxesTab } from "../components/finance/TaxesTab";
import { ExpenseTagInput } from "../components/finance/ExpenseTagInput";
import {
  Modal,
  Field,
  TextInput,
  NumberInput,
  DateInput,
  SelectInput,
  SearchableSelect,
  FormActions,
  formatMoney,
  formatDate,
  MoneyNumberInput,
  todayInput,
} from "../components/ui";
import { AppHeader, Icon } from "../components/crm";
import {
  FinanceTabs,
  FinanceAddButton,
  FinanceStatCard,
  FinanceStatsRow,
  FinanceSearchRow,
  FinanceEmptyState,
  FinanceList,
  FinanceListItem,
  FinanceDateGroupedList,
  PartnerAlertMark,
  financeInPeriod,
  sortFinanceByDate,
  type FinanceTabId,
  type FinancePeriod,
  type FinanceDateSort,
} from "../components/finance/FinanceUi";
import {
  expenseDisplaySubtitle,
  expenseDisplayTitle,
  paymentDisplaySubtitle,
  paymentDisplayTitle,
} from "../components/finance/financeLabels";
import { useReadOnly } from "../readOnly";

export function FinancePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FinanceTabId>("payments");

  return (
    <div className="crm-page">
      <div className="crm-page-header-block">
        <AppHeader title={t("dashboard.appName")} subtitle={t("dashboard.appSubtitle")} />
      </div>

      <FinanceTabs active={tab} onChange={setTab} />

      {tab === "payments" && <PaymentsTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "taxes" && <TaxesTab />}
      {tab === "fleet" && <FleetTab />}
      {tab === "balances" && <BalancesTab />}
    </div>
  );
}

function PaymentsTab() {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const payments = usePayments();
  const balances = useBalances();
  const drivers = useDrivers();
  const cars = useCars();
  const agreements = useAgreements();
  const save = useSavePayment();
  const del = useDeletePayment();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [dateSort, setDateSort] = useState<FinanceDateSort>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<PaymentType | "ALL">("ALL");
  const [fieldErrors, setFieldErrors] = useState<{ amount?: boolean; date?: boolean; method?: boolean }>({});
  const [form, setForm] = useState<{
    driverId: string;
    carId: string;
    amount: number | "";
    date: string;
    method: PaymentMethod;
    type: PaymentType;
    note: string;
    receivedByPartner: boolean;
    partnerSettled: boolean;
  }>({
    driverId: "",
    carId: "",
    amount: "",
    date: todayInput(),
    method: PaymentMethod.BANK,
    type: PaymentType.RENT,
    note: "",
    receivedByPartner: false,
    partnerSettled: false,
  });

  // Discounts are tracked as Payment rows with type=DISCOUNT so the balance
  // calculation picks them up, but they are NOT income and shouldn't be
  // mixed into the payments list. Use `all` for the list and `allIncludingDiscounts`
  // only when the caller explicitly needs the raw data.
  const allIncludingDiscounts = payments.data ?? [];
  const all = allIncludingDiscounts.filter((p) => p.type !== PaymentType.DISCOUNT);
  const totalPaid = all.reduce((s, p) => s + p.amount, 0);
  const debts = (balances.data ?? []).filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const monthItems = all.filter((p) => financeInPeriod(p.date, "month"));
  const monthSum = monthItems.reduce((s, p) => s + p.amount, 0);
  const partnerUnsettled = all.filter((p) => p.receivedByPartner && !p.partnerSettled);
  const partnerUnsettledSum = partnerUnsettled.reduce((s, p) => s + p.amount, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = all.filter((p) => {
      if (!financeInPeriod(p.date, period)) return false;
      if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
      if (!q) return true;
      const hay = `${p.driver?.fullName ?? ""} ${p.note ?? ""} ${p.amount}`.toLowerCase();
      return hay.includes(q);
    });
    return sortFinanceByDate(list, dateSort, (p) => p.date);
  }, [all, period, search, typeFilter, dateSort]);

  function openCreate() {
    setEditId(null);
    setFieldErrors({});
    setForm({
      driverId: "",
      carId: "",
      amount: "",
      date: todayInput(),
      method: PaymentMethod.BANK,
      type: PaymentType.RENT,
      note: "",
      receivedByPartner: false,
      partnerSettled: false,
    });
    setOpen(true);
  }

  function openEdit(p: (typeof all)[number]) {
    setEditId(p.id);
    setFieldErrors({});
    setForm({
      driverId: p.driverId ?? "",
      carId: p.carId ?? "",
      amount: p.amount,
      date: p.date.slice(0, 10),
      method: p.method === PaymentMethod.CASH ? PaymentMethod.CASH : PaymentMethod.BANK,
      type: p.type,
      note: p.note ?? "",
      receivedByPartner: p.receivedByPartner,
      partnerSettled: p.partnerSettled,
    });
    setOpen(true);
  }

  function submit() {
    const errors = {
      amount: form.amount === "",
      date: !form.date.trim(),
      method: !form.method,
    };
    setFieldErrors(errors);
    if (errors.amount || errors.date || errors.method) return;
    save.mutate(
      {
        id: editId ?? undefined,
        data: {
          driverId: form.driverId || null,
          carId: form.carId || null,
          amount: form.amount,
          date: form.date,
          method: form.method,
          type: form.type,
          note: form.note || null,
          receivedByPartner: form.receivedByPartner,
          partnerSettled: form.receivedByPartner ? form.partnerSettled : false,
        },
      },
      {
        onSuccess: () => setOpen(false),
      },
    );
  }

  return (
    <>
      {!readOnly ? <FinanceAddButton label={t("finance.addPayment")} onClick={openCreate} /> : null}

      {partnerUnsettled.length > 0 ? (
        <div className="crm-partner-banner glass-card">
          <PartnerAlertMark label={t("finance.receivedByPartner")} />
          <div>
            <div className="crm-partner-banner__title">{t("finance.receivedByPartnerTitle")}</div>
            <div className="crm-partner-banner__subtitle">
              {t("finance.receivedByPartnerSummary", {
                count: partnerUnsettled.length,
                amount: formatMoney(partnerUnsettledSum),
              })}
            </div>
          </div>
        </div>
      ) : null}

      <FinanceStatsRow>
        <FinanceStatCard
          title={t("finance.totalPayments")}
          value={String(all.length)}
          subtitle={t("finance.allTime")}
          tone="blue"
          icon={<Icon name="credit-card" size={16} color="#448aff" />}
        />
        <FinanceStatCard
          title={t("finance.paid")}
          value={formatMoney(totalPaid)}
          subtitle={t("finance.allTime")}
          tone="green"
          icon={<Icon name="chart-increase" size={16} color="#69f0ae" />}
        />
        <FinanceStatCard
          title={t("finance.debts")}
          value={formatMoney(debts)}
          subtitle={t("finance.allTime")}
          tone="red"
          icon={<Icon name="chart-decrease" size={16} color="#ff5252" />}
        />
        <FinanceStatCard
          title={t("finance.thisMonth")}
          value={formatMoney(monthSum)}
          subtitle={t("finance.paymentCount", { count: monthItems.length })}
          tone="purple"
          icon={<Icon name="calendar-01" size={16} color="#b388ff" />}
        />
      </FinanceStatsRow>

      <FinanceSearchRow
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("finance.searchPayments")}
        period={period}
        onPeriodChange={setPeriod}
        periodOpen={periodOpen}
        onPeriodOpenChange={setPeriodOpen}
        dateSort={dateSort}
        onDateSortChange={setDateSort}
        sortOpen={sortOpen}
        onSortOpenChange={setSortOpen}
        filterActive={typeFilter !== "ALL"}
        onFilterClick={() => setFilterOpen((v) => !v)}
        filterMenu={
          filterOpen ? (
            <div className="crm-filter-menu crm-finance-filter-menu">
              <button
                type="button"
                className={`crm-filter-menu__item${typeFilter === "ALL" ? " crm-filter-menu__item--active" : ""}`}
                onClick={() => {
                  setTypeFilter("ALL");
                  setFilterOpen(false);
                }}
              >
                {t("common.all")}
              </button>
              {Object.values(PaymentType)
                .filter((pt) => pt !== PaymentType.DISCOUNT)
                .map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    className={`crm-filter-menu__item${typeFilter === pt ? " crm-filter-menu__item--active" : ""}`}
                    onClick={() => {
                      setTypeFilter(pt);
                      setFilterOpen(false);
                    }}
                  >
                    {t(`finance.${pt}`)}
                  </button>
                ))}
            </div>
          ) : null
        }
      />

      {!payments.isLoading && filtered.length === 0 ? (
        <FinanceEmptyState
          title={t("common.empty")}
          description={t("finance.emptyPaymentsDesc")}
          actionLabel={readOnly ? undefined : t("finance.addPayment")}
          onAction={readOnly ? undefined : openCreate}
        />
      ) : (
        <FinanceList loading={payments.isLoading}>
          <FinanceDateGroupedList
            items={filtered}
            collapseStorageKey="finance-payments-months"
            getDate={(p) => p.date}
            getKey={(p) => p.id}
            getAmount={(p) => p.amount}
            formatCount={(count) => t("finance.paymentCount", { count })}
            summaryTone="income"
            renderItem={(p) => (
              <FinanceListItem
                title={paymentDisplayTitle(p, t, t("common.none"))}
                subtitle={paymentDisplaySubtitle(p, formatDate(p.date), t, t("common.none"))}
                amount={formatMoney(p.amount)}
                amountTone="income"
                partnerAlert={p.receivedByPartner && !p.partnerSettled}
                partnerAlertLabel={t("finance.receivedByPartner")}
                onClick={readOnly ? undefined : () => openEdit(p)}
              />
            )}
          />
        </FinanceList>
      )}

      <PaymentModal
        open={open}
        editId={editId}
        form={form}
        setForm={setForm}
        fieldErrors={fieldErrors}
        drivers={drivers.data ?? []}
        cars={cars.data ?? []}
        agreements={agreements.data ?? []}
        saving={save.isPending}
        onClose={() => setOpen(false)}
        onSave={submit}
        onFieldErrorClear={(key) => setFieldErrors((e) => ({ ...e, [key]: false }))}
        onDelete={
          editId
            ? () => {
                if (confirm(t("common.confirmDelete"))) del.mutate(editId, { onSuccess: () => setOpen(false) });
              }
            : undefined
        }
      />
    </>
  );
}

function ExpensesTab() {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const expenses = useExpenses();
  const cars = useCars();
  const save = useSaveExpense();
  const del = useDeleteExpense();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [dateSort, setDateSort] = useState<FinanceDateSort>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ amount?: boolean; date?: boolean }>({});
  const [form, setForm] = useState<{
    carId: string;
    category: ExpenseCategory;
    amount: number | "";
    date: string;
    note: string;
    tag: string;
    paidByPartner: boolean;
    partnerSettled: boolean;
  }>({
    carId: "",
    category: ExpenseCategory.FUEL,
    amount: "",
    date: todayInput(),
    note: "",
    tag: "",
    paidByPartner: false,
    partnerSettled: false,
  });

  const all = (expenses.data ?? []).filter((e) => e.category !== ExpenseCategory.TAX);
  const expenseTagSuggestions = useMemo(() => {
    const tags = new Set<string>();
    for (const e of all) {
      const tag = e.tag?.trim();
      if (tag) tags.add(tag);
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [all]);
  const total = all.reduce((s, e) => s + e.amount, 0);
  const monthItems = all.filter((e) => financeInPeriod(e.date, "month"));
  const monthSum = monthItems.reduce((s, e) => s + e.amount, 0);
  const partnerUnsettled = all.filter((e) => e.paidByPartner && !e.partnerSettled);
  const partnerUnsettledSum = partnerUnsettled.reduce((s, e) => s + e.amount, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = all.filter((e) => {
      if (!financeInPeriod(e.date, period)) return false;
      if (!q) return true;
      const hay = `${t(`finance.${e.category}`)} ${e.car?.plate ?? ""} ${e.tag ?? ""} ${e.note ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    return sortFinanceByDate(list, dateSort, (e) => e.date);
  }, [all, period, search, t, dateSort]);

  function openCreate() {
    setEditId(null);
    setFieldErrors({});
    setForm({
      carId: "",
      category: ExpenseCategory.FUEL,
      amount: "",
      date: todayInput(),
      note: "",
      tag: "",
      paidByPartner: false,
      partnerSettled: false,
    });
    setOpen(true);
  }

  function submit() {
    const errors = {
      amount: form.amount === "",
      date: !form.date.trim(),
    };
    setFieldErrors(errors);
    if (errors.amount || errors.date) return;
    save.mutate(
      {
        id: editId ?? undefined,
        data: {
          carId: form.carId || null,
          category: form.category,
          amount: form.amount,
          date: form.date,
          note: form.note || null,
          tag: form.tag.trim() || null,
          paidByPartner: form.paidByPartner,
          partnerSettled: form.paidByPartner ? form.partnerSettled : false,
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      {!readOnly ? <FinanceAddButton label={t("finance.addExpense")} onClick={openCreate} /> : null}

      {partnerUnsettled.length > 0 ? (
        <div className="crm-partner-banner glass-card">
          <PartnerAlertMark label={t("finance.partnerUnsettledTitle")} />
          <div>
            <div className="crm-partner-banner__title">{t("finance.partnerUnsettledTitle")}</div>
            <div className="crm-partner-banner__subtitle">
              {t("finance.partnerUnsettledSummary", {
                count: partnerUnsettled.length,
                amount: formatMoney(partnerUnsettledSum),
              })}
            </div>
          </div>
        </div>
      ) : null}

      <FinanceStatsRow>
        <FinanceStatCard
          title={t("finance.totalExpenses")}
          value={String(all.length)}
          subtitle={t("finance.allTime")}
          tone="blue"
          icon={<Icon name="fire" size={16} color="#448aff" />}
        />
        <FinanceStatCard
          title={t("finance.spent")}
          value={formatMoney(total)}
          subtitle={t("finance.allTime")}
          tone="red"
          icon={<Icon name="chart-decrease" size={16} color="#ff5252" />}
        />
        <FinanceStatCard
          title={t("finance.thisMonth")}
          value={formatMoney(monthSum)}
          subtitle={t("finance.expenseCount", { count: monthItems.length })}
          tone="purple"
          icon={<Icon name="calendar-01" size={16} color="#b388ff" />}
        />
      </FinanceStatsRow>

      <FinanceSearchRow
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("finance.searchExpenses")}
        period={period}
        onPeriodChange={setPeriod}
        periodOpen={periodOpen}
        onPeriodOpenChange={setPeriodOpen}
        dateSort={dateSort}
        onDateSortChange={setDateSort}
        sortOpen={sortOpen}
        onSortOpenChange={setSortOpen}
      />

      {!expenses.isLoading && filtered.length === 0 ? (
        <FinanceEmptyState
          title={t("common.empty")}
          description={t("finance.emptyExpensesDesc")}
          actionLabel={readOnly ? undefined : t("finance.addExpense")}
          onAction={readOnly ? undefined : openCreate}
        />
      ) : (
        <FinanceList loading={expenses.isLoading}>
          <FinanceDateGroupedList
            items={filtered}
            collapseStorageKey="finance-expenses-months"
            getDate={(e) => e.date}
            getKey={(e) => e.id}
            getAmount={(e) => e.amount}
            formatCount={(count) => t("finance.expenseCount", { count })}
            summaryTone="expense"
            renderItem={(e) => {
              const partnerOpen = e.paidByPartner && !e.partnerSettled;
              return (
                <FinanceListItem
                  title={expenseDisplayTitle(e, t)}
                  subtitle={expenseDisplaySubtitle(e, formatDate(e.date), t, t("common.none"))}
                  partnerAlert={partnerOpen}
                  partnerAlertLabel={t("finance.partnerUnsettledTitle")}
                  amount={formatMoney(e.amount)}
                  amountTone="expense"
                  onClick={
                    readOnly
                      ? undefined
                      : () => {
                          setEditId(e.id);
                          setFieldErrors({});
                          setForm({
                            carId: e.carId ?? "",
                            category: e.category,
                            amount: e.amount,
                            date: e.date.slice(0, 10),
                            note: e.note ?? "",
                            tag: e.tag ?? "",
                            paidByPartner: e.paidByPartner,
                            partnerSettled: e.partnerSettled,
                          });
                          setOpen(true);
                        }
                  }
                />
              );
            }}
          />
        </FinanceList>
      )}

      <Modal
        open={open}
        title={editId ? t("finance.addExpense") : t("finance.addExpense")}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FormActions onCancel={() => setOpen(false)} onSave={submit} saving={save.isPending} />
            {editId && (
              <button
                type="button"
                className="crm-btn-outline"
                onClick={() => {
                  if (confirm(t("common.confirmDelete"))) del.mutate(editId, { onSuccess: () => setOpen(false) });
                }}
              >
                {t("common.delete")}
              </button>
            )}
          </div>
        }
      >
        <Field label={t("finance.category")}>
          <SelectInput
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={Object.values(ExpenseCategory)
              .filter((x) => x !== ExpenseCategory.TAX)
              .map((x) => ({ value: x, label: t(`finance.${x}`) }))}
          />
        </Field>
        <Field label={t("finance.car")}>
          <SelectInput
            value={form.carId}
            onChange={(v) => setForm({ ...form, carId: v })}
            options={[
              { value: "", label: t("common.none") },
              ...(cars.data ?? []).map((c) => ({ value: c.id, label: c.plate })),
            ]}
          />
        </Field>
        <Field
          label={t("finance.amount")}
          invalid={fieldErrors.amount}
          errorMessage={fieldErrors.amount ? t("common.requiredField") : undefined}
        >
          <MoneyNumberInput
            value={form.amount}
            invalid={fieldErrors.amount}
            onChange={(v) => {
              setFieldErrors((e) => ({ ...e, amount: false }));
              setForm({ ...form, amount: v });
            }}
          />
        </Field>
        <Field
          label={t("finance.date")}
          invalid={fieldErrors.date}
          errorMessage={fieldErrors.date ? t("common.requiredField") : undefined}
        >
          <DateInput
            value={form.date}
            invalid={fieldErrors.date}
            onChange={(v) => {
              setFieldErrors((e) => ({ ...e, date: false }));
              setForm({ ...form, date: v });
            }}
          />
        </Field>
        <Field label={t("finance.expenseTag")}>
          <ExpenseTagInput
            value={form.tag}
            suggestions={expenseTagSuggestions}
            onChange={(v) => setForm({ ...form, tag: v })}
          />
        </Field>
        <Field label={t("finance.note")}>
          <TextInput value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
        </Field>
        <p className="crm-field-hint">{t("finance.noteHint")}</p>
        <label className="crm-checkbox-field">
          <input
            type="checkbox"
            checked={form.paidByPartner}
            onChange={(e) =>
              setForm({
                ...form,
                paidByPartner: e.target.checked,
                partnerSettled: e.target.checked ? form.partnerSettled : false,
              })
            }
          />
          <span>{t("finance.paidByPartner")}</span>
        </label>
        {form.paidByPartner ? (
          <label className="crm-checkbox-field">
            <input
              type="checkbox"
              checked={form.partnerSettled}
              onChange={(e) => setForm({ ...form, partnerSettled: e.target.checked })}
            />
            <span>{t("finance.partnerSettled")}</span>
          </label>
        ) : null}
      </Modal>
    </>
  );
}

function BalancesTab() {
  const { t } = useTranslation();
  const balances = useBalances();
  const all = balances.data ?? [];
  const totalDebt = all.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);

  return (
    <>
      <FinanceStatsRow>
        <FinanceStatCard
          title={t("finance.balances")}
          value={String(all.length)}
          subtitle={t("finance.allTime")}
          tone="purple"
          icon={<Icon name="lock" size={16} color="#b388ff" />}
        />
        <FinanceStatCard
          title={t("finance.debts")}
          value={formatMoney(totalDebt)}
          subtitle={t("finance.allTime")}
          tone="red"
          icon={<Icon name="chart-decrease" size={16} color="#ff5252" />}
        />
      </FinanceStatsRow>

      {!balances.isLoading && all.length === 0 ? (
        <FinanceEmptyState
          title={t("common.empty")}
          description={t("finance.emptyBalancesDesc")}
        />
      ) : (
        <FinanceList loading={balances.isLoading}>
          {all.map((b) => (
            <FinanceListItem
              key={b.driverId}
              title={b.driverName}
              subtitle={`${t("reports.income")}: ${formatMoney(b.rentPaid)} • ${t("dashboard.deposit")}: ${formatMoney(b.depositHeld)}`}
              amount={formatMoney(b.balance)}
              amountTone={b.balance > 0 ? "expense" : "income"}
            />
          ))}
        </FinanceList>
      )}
    </>
  );
}

function PaymentModal(props: {
  open: boolean;
  editId: string | null;
  form: {
    driverId: string;
    carId: string;
    amount: number | "";
    date: string;
    method: PaymentMethod;
    type: PaymentType;
    note: string;
    receivedByPartner: boolean;
    partnerSettled: boolean;
  };
  setForm: (f: typeof props.form) => void;
  fieldErrors: { amount?: boolean; date?: boolean; method?: boolean };
  drivers: { id: string; fullName: string }[];
  cars: { id: string; plate: string }[];
  agreements: Agreement[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onFieldErrorClear?: (key: "amount" | "date" | "method") => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { form, setForm, fieldErrors } = props;

  const driverOptions = useMemo(() => {
    const driverById = new Map(props.drivers.map((d) => [d.id, d]));
    const { orderedDriverIds } = rankDriversForCar(
      form.carId,
      props.agreements,
      props.drivers.map((d) => d.id),
    );
    const ordered = orderedDriverIds
      .map((id) => driverById.get(id))
      .filter((d): d is { id: string; fullName: string } => Boolean(d));
    for (const d of props.drivers) {
      if (!ordered.some((x) => x.id === d.id)) ordered.push(d);
    }
    return [
      { value: "", label: t("common.none") },
      ...ordered.map((d) => {
        const hintKind = agreementHintForDriver(form.carId, d.id, props.agreements);
        return {
          value: d.id,
          label: d.fullName,
          hint:
            hintKind === "active"
              ? t("finance.carHintActive")
              : hintKind === "past"
                ? t("finance.carHintPast")
                : undefined,
        };
      }),
    ];
  }, [form.carId, props.agreements, props.drivers, t]);

  const carOptions = useMemo(() => {
    const carById = new Map(props.cars.map((c) => [c.id, c]));
    const { orderedCarIds } = rankCarsForDriver(
      form.driverId,
      props.agreements,
      props.cars.map((c) => c.id),
    );
    const ordered = orderedCarIds
      .map((id) => carById.get(id))
      .filter((c): c is { id: string; plate: string } => Boolean(c));
    for (const car of props.cars) {
      if (!ordered.some((c) => c.id === car.id)) ordered.push(car);
    }
    return [
      { value: "", label: t("common.none") },
      ...ordered.map((c) => {
        const hintKind = agreementHintForCar(form.driverId, c.id, props.agreements);
        return {
          value: c.id,
          label: c.plate,
          hint:
            hintKind === "active"
              ? t("finance.carHintActive")
              : hintKind === "past"
                ? t("finance.carHintPast")
                : undefined,
        };
      }),
    ];
  }, [form.driverId, props.agreements, props.cars, t]);

  function onDriverChange(driverId: string) {
    const { suggestedCarId } = rankCarsForDriver(
      driverId,
      props.agreements,
      props.cars.map((c) => c.id),
    );
    setForm({
      ...form,
      driverId,
      carId: suggestedCarId ?? "",
    });
  }

  function onCarChange(carId: string) {
    const { suggestedDriverId } = rankDriversForCar(
      carId,
      props.agreements,
      props.drivers.map((d) => d.id),
    );
    setForm({
      ...form,
      carId,
      // Only auto-fill the driver if the user hasn't already picked one.
      // (Otherwise, picking a car would clobber an explicit driver choice.)
      driverId: form.driverId || (suggestedDriverId ?? ""),
    });
  }

  return (
    <Modal
      open={props.open}
      title={props.editId ? t("finance.addPayment") : t("finance.addPayment")}
      onClose={props.onClose}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FormActions onCancel={props.onClose} onSave={props.onSave} saving={props.saving} />
          {props.onDelete && (
            <button type="button" className="crm-btn-outline" onClick={props.onDelete}>
              {t("common.delete")}
            </button>
          )}
        </div>
      }
    >
      <Field label={t("finance.driver")}>
        <SearchableSelect
          value={form.driverId}
          onChange={onDriverChange}
          options={driverOptions}
        />
      </Field>
      <Field label={t("finance.car")}>
        <SearchableSelect value={form.carId} onChange={onCarChange} options={carOptions} />
      </Field>
      <Field
        label={t("finance.amount")}
        invalid={fieldErrors.amount}
        errorMessage={fieldErrors.amount ? t("common.requiredField") : undefined}
      >
        <MoneyNumberInput
          value={form.amount}
          invalid={fieldErrors.amount}
          onChange={(v) => {
            setForm({ ...form, amount: v });
            if (v !== "") props.onFieldErrorClear?.("amount");
          }}
        />
      </Field>
      <Field
        label={t("finance.date")}
        invalid={fieldErrors.date}
        errorMessage={fieldErrors.date ? t("common.requiredField") : undefined}
      >
        <DateInput
          value={form.date}
          invalid={fieldErrors.date}
          onChange={(v) => {
            setForm({ ...form, date: v });
            if (v.trim()) props.onFieldErrorClear?.("date");
          }}
        />
      </Field>
      <Field label={t("finance.paymentType")}>
        <SelectInput
          value={form.type}
          onChange={(v) => setForm({ ...form, type: v })}
          options={Object.values(PaymentType).map((x) => ({ value: x, label: t(`finance.${x}`) }))}
        />
      </Field>
      <Field
        label={t("finance.method")}
        invalid={fieldErrors.method}
        errorMessage={fieldErrors.method ? t("common.requiredField") : undefined}
      >
        <SelectInput
          value={form.method}
          invalid={fieldErrors.method}
          onChange={(v) => {
            setForm({ ...form, method: v });
            props.onFieldErrorClear?.("method");
          }}
          options={PAYMENT_METHODS.map((x) => ({ value: x, label: t(`finance.${x}`) }))}
        />
      </Field>
      <Field label={t("finance.note")}>
        <TextInput value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
      </Field>
      <label className="crm-checkbox-field">
        <input
          type="checkbox"
          checked={form.receivedByPartner}
          onChange={(e) =>
            setForm({
              ...form,
              receivedByPartner: e.target.checked,
              partnerSettled: e.target.checked ? form.partnerSettled : false,
            })
          }
        />
        <span>{t("finance.receivedByPartner")}</span>
      </label>
      {form.receivedByPartner ? (
        <label className="crm-checkbox-field">
          <input
            type="checkbox"
            checked={form.partnerSettled}
            onChange={(e) => setForm({ ...form, partnerSettled: e.target.checked })}
          />
          <span>{t("finance.partnerSettled")}</span>
        </label>
      ) : null}
    </Modal>
  );
}
