import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PAYMENT_METHODS, PaymentMethod, PaymentType, ExpenseCategory, AgreementStatus, RentPeriod } from "@taxi/shared";
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
import { NoteViewerModal, previewNote } from "../components/finance/NoteViewerModal";
import {
  Modal,
  Field,
  TextArea,
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
import { ApiError } from "../api";
import { showAlert } from "../telegram";

/** Surface server-side errors (validation, network, etc.) so the user can react. */
function notifySaveError(err: unknown, fallbackKey: string): void {
  let message: string;
  if (err instanceof ApiError) {
    if (err.code === "validation_error") {
      message = `${err.message}: ${fallbackKey}`;
    } else {
      message = err.message || fallbackKey;
    }
  } else if (err instanceof Error) {
    message = err.message || fallbackKey;
  } else {
    message = fallbackKey;
  }
  showAlert(message);
}

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
  // The driver breakdown modal's "give a discount" CTA jumps here with
  // ?addPayment=1&driverId=… so we can drop the owner straight into the
  // add-payment flow with the driver (and the active car, when there is
  // one) already chosen. Read the params once on mount and let the
  // existing openCreate() handle the rest.
  const [searchParams, setSearchParams] = useSearchParams();
  const presetDriverId = searchParams.get("driverId") ?? "";
  const wantsAddPayment = searchParams.get("addPayment") === "1";
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [dateSort, setDateSort] = useState<FinanceDateSort>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<PaymentType | "ALL">("ALL");
  const [fieldErrors, setFieldErrors] = useState<{ amount?: boolean; date?: boolean; method?: boolean; discount?: boolean }>({});
  const [noteView, setNoteView] = useState<{
    title: string;
    subtitle?: string;
    note: string;
    date?: string;
    amount?: string;
  } | null>(null);
  const [form, setForm] = useState<{
    driverId: string;
    carId: string;
    amount: number | "";
    // Inline discount applied to this payment (e.g. rent was 700, the
    // car was inactive for two days, the driver paid 400, and the
    // discount is 300). Empty string means "no discount on this
    // payment". The same field is sent as `discountAmount` to the API
    // and is honoured by the balance calculation alongside the legacy
    // DISCOUNT-type rows.
    discount: number | "";
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
    discount: "",
    date: todayInput(),
    method: PaymentMethod.BANK,
    type: PaymentType.RENT,
    note: "",
    receivedByPartner: false,
    partnerSettled: false,
  });

  // Discounts used to live as their own Payment rows with type=DISCOUNT
  // (managed through GiveDiscountModal). That flow is deprecated — the
  // owner now records a discount inline on the same RENT payment. Legacy
  // DISCOUNT-type rows still appear in the raw list for backwards
  // compatibility, but are excluded from the visible payments tab because
  // they are not income. New discounts ride along on their RENT row and
  // are visible there instead.
  const allIncludingDiscounts = payments.data ?? [];
  const all = allIncludingDiscounts.filter((p) => p.type !== PaymentType.DISCOUNT);

  // Auto-open the add-payment modal when arriving from the driver
  // breakdown's "give a discount" CTA. Preselect the driver (and the
  // active car, when there is one) so the discount field is the only
  // thing left to fill in.
  useEffect(() => {
    if (!wantsAddPayment || readOnly) return;
    if (open) return;
    setEditId(null);
    setFieldErrors({});
    const { suggestedCarId } = rankCarsForDriver(
      presetDriverId,
      agreements.data ?? [],
      (cars.data ?? []).map((c) => c.id),
    );
    setForm({
      driverId: presetDriverId,
      carId: suggestedCarId ?? "",
      amount: "",
      discount: "",
      date: todayInput(),
      method: PaymentMethod.BANK,
      type: PaymentType.RENT,
      note: "",
      receivedByPartner: false,
      partnerSettled: false,
    });
    setOpen(true);
    // Strip the query params so a page refresh doesn't reopen the modal.
    const next = new URLSearchParams(searchParams);
    next.delete("addPayment");
    next.delete("driverId");
    setSearchParams(next, { replace: true });
  }, [
    wantsAddPayment,
    presetDriverId,
    readOnly,
    open,
    agreements.data,
    cars.data,
    searchParams,
    setSearchParams,
  ]);
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
      discount: "",
      date: todayInput(),
      method: PaymentMethod.BANK,
      type: PaymentType.RENT,
      note: "",
      receivedByPartner: false,
      partnerSettled: false,
    });
    setOpen(true);
  }

  function openEdit(p: (typeof allIncludingDiscounts)[number]) {
    setEditId(p.id);
    setFieldErrors({});
    // Legacy payments may have types the form no longer offers (REFUND,
    // FINE, DISCOUNT). Map them to RENT so the dropdown always has a valid
    // initial selection — the owner can change it to DEPOSIT if needed.
    const editableType =
      p.type === PaymentType.RENT || p.type === PaymentType.DEPOSIT
        ? p.type
        : PaymentType.RENT;
    setForm({
      driverId: p.driverId ?? "",
      carId: p.carId ?? "",
      amount: p.amount,
      // Legacy DISCOUNT-type rows used to carry the credit as `amount`
      // (the "discount amount"). Convert it into the inline discount
      // field so opening one of those old rows still shows the credit
      // the owner applied — they can then change the type and the form
      // will save it as a normal RENT with discountAmount.
      discount:
        p.type === PaymentType.DISCOUNT
          ? p.amount
          : p.discountAmount && p.discountAmount > 0
            ? p.discountAmount
            : "",
      date: p.date.slice(0, 10),
      method: p.method === PaymentMethod.CASH ? PaymentMethod.CASH : PaymentMethod.BANK,
      type: editableType,
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
      // The discount is optional. We only flag it as invalid if the
      // owner typed a value that isn't a non-negative number (a
      // negative discount doesn't make sense — the API clamps to >= 0).
      discount: form.discount !== "" && (typeof form.discount !== "number" || form.discount < 0),
    };
    setFieldErrors(errors);
    if (errors.amount || errors.date || errors.method || errors.discount) return;
    save.mutate(
      {
        id: editId ?? undefined,
        data: {
          driverId: form.driverId || null,
          carId: form.carId || null,
          amount: form.amount,
          // Empty discount → 0 (no credit applied). The API clamps to
          // >= 0 so a stray negative number never makes it to the DB.
          discountAmount: form.discount === "" ? 0 : form.discount,
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
        onError: (err) => notifySaveError(err, t("common.saveFailed")),
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
              {/* Match the Payment Type dropdown in the modal: only show
                  categories the user actually adds through that form. */}
              {[PaymentType.RENT, PaymentType.DEPOSIT].map((pt) => (
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
                title={(() => {
                  const rawNote = (p.note ?? "").trim();
                  const driverName = p.driver?.fullName ?? "";
                  // If the note is long AND is what we're showing as the title,
                  // truncate it; otherwise fall back to driver or "none".
                  if (rawNote) {
                    return rawNote.length > 80 ? previewNote(rawNote, 80) : rawNote;
                  }
                  return driverName || t("common.none");
                })()}
                subtitle={paymentDisplaySubtitle(p, formatDate(p.date), t, t("common.none"))}
                amount={formatMoney(p.amount)}
                amountTone="income"
                partnerAlert={p.receivedByPartner && !p.partnerSettled}
                partnerAlertLabel={t("finance.receivedByPartner")}
                noteExpandable={Boolean((p.note ?? "").trim().length > 80)}
                showNoteLabel={t("finance.viewFullNote")}
                onShowNote={
                  (p.note ?? "").trim().length > 80
                    ? () =>
                        setNoteView({
                          title: paymentDisplayTitle(p, t, t("common.none")),
                          subtitle: paymentDisplaySubtitle(
                            p,
                            formatDate(p.date),
                            t,
                            t("common.none"),
                          ),
                          note: (p.note ?? "").trim(),
                          date: p.date,
                          amount: formatMoney(p.amount),
                        })
                    : undefined
                }
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
      <NoteViewerModal
        open={Boolean(noteView)}
        item={noteView}
        onClose={() => setNoteView(null)}
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
  const [noteView, setNoteView] = useState<{
    title: string;
    subtitle?: string;
    note: string;
    date?: string;
    amount?: string;
  } | null>(null);
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
      {
        onSuccess: () => setOpen(false),
        onError: (err) => notifySaveError(err, t("common.saveFailed")),
      },
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
              const rawNote = (e.note ?? "").trim();
              const isLongNote = rawNote.length > 80;
              const displayTitle = isLongNote
                ? previewNote(rawNote, 80)
                : expenseDisplayTitle(e, t);
              return (
                <FinanceListItem
                  title={displayTitle}
                  subtitle={expenseDisplaySubtitle(e, formatDate(e.date), t, t("common.none"))}
                  partnerAlert={partnerOpen}
                  partnerAlertLabel={t("finance.partnerUnsettledTitle")}
                  amount={formatMoney(e.amount)}
                  amountTone="expense"
                  noteExpandable={isLongNote}
                  showNoteLabel={t("finance.viewFullNote")}
                  onShowNote={
                    isLongNote
                      ? () =>
                          setNoteView({
                            title: expenseDisplayTitle(e, t),
                            subtitle: expenseDisplaySubtitle(
                              e,
                              formatDate(e.date),
                              t,
                              t("common.none"),
                            ),
                            note: rawNote,
                            date: e.date,
                            amount: formatMoney(e.amount),
                          })
                      : undefined
                  }
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
          <TextArea
            value={form.note}
            maxLength={12000}
            rows={4}
            maxRows={12}
            onChange={(v) => setForm({ ...form, note: v })}
          />
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
      <NoteViewerModal
        open={Boolean(noteView)}
        item={noteView}
        onClose={() => setNoteView(null)}
      />
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
    discount: number | "";
    date: string;
    method: PaymentMethod;
    type: PaymentType;
    note: string;
    receivedByPartner: boolean;
    partnerSettled: boolean;
  };
  setForm: (f: typeof props.form) => void;
  fieldErrors: { amount?: boolean; date?: boolean; method?: boolean; discount?: boolean };
  drivers: { id: string; fullName: string }[];
  cars: { id: string; plate: string }[];
  agreements: Agreement[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onFieldErrorClear?: (key: "amount" | "date" | "method" | "discount") => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { form, setForm, fieldErrors } = props;

  // Resolve the rental agreement that governs the currently-selected
  // driver + car so the modal can show the owner what the driver is
  // actually required to pay under contract. Three tiers of match,
  // each falling back to the next when no agreement is found:
  //   1. An agreement that matches the (driver, car) pair exactly —
  //      the usual case once the owner has picked both.
  //   2. If a driver is selected but no exact match exists, any
  //      agreement that matches the driver (even on a different car).
  //      This handles "I picked the driver first, then changed cars
  //      to one they're not currently on" — we still want to surface
  //      their most recent active deal.
  //   3. If a car is selected but no exact match exists, any
  //      agreement that matches the car (even with a different
  //      driver). This is the headline fix for "I picked the car
  //      first, the modal said no contract even though the car is
  //      definitely assigned" — we now surface the car-side contract
  //      regardless of the (possibly wrong) driver that
  //      `onCarChange` auto-filled.
  // Within each tier we prefer ACTIVE > ENDED, then most recent
  // startDate, then the largest rentAmount.
  const contractAgreement = useMemo(() => {
    if (!form.driverId && !form.carId) return null;
    const score = (a: Agreement) => {
      return (
        (a.status === AgreementStatus.ACTIVE ? 1000 : 0) +
        new Date(a.startDate).getTime() / 1e9 +
        a.rentAmount / 1e6
      );
    };
    const pickBest = (candidates: Agreement[]): Agreement | null => {
      if (candidates.length === 0) return null;
      const sorted = [...candidates].sort((a, b) => score(b) - score(a));
      return sorted[0] ?? null;
    };
    // Tier 1: exact (driver, car) match.
    const exact = pickBest(
      props.agreements.filter((a) => {
        if (form.driverId && a.driverId !== form.driverId) return false;
        if (form.carId && a.carId !== form.carId) return false;
        return true;
      }),
    );
    if (exact) return exact;
    // Tier 2: driver-only fallback. Useful when the user picked a
    // driver first and then switched to a car they're not currently
    // contracted on.
    if (form.driverId) {
      const byDriver = pickBest(
        props.agreements.filter((a) => a.driverId === form.driverId),
      );
      if (byDriver) return byDriver;
    }
    // Tier 3: car-only fallback. This is the case the user was
    // hitting — the car is assigned, the modal just didn't surface
    // the contract because the (auto-filled) driver wasn't matched.
    if (form.carId) {
      const byCar = pickBest(
        props.agreements.filter((a) => a.carId === form.carId),
      );
      if (byCar) return byCar;
    }
    return null;
  }, [props.agreements, form.driverId, form.carId]);

  const contractPeriodLabel = useMemo(() => {
    if (!contractAgreement) return "";
    switch (contractAgreement.period) {
      case RentPeriod.DAILY:
        return t("finance.periodDay");
      case RentPeriod.WEEKLY:
        return t("finance.periodWeek");
      case RentPeriod.MONTHLY:
        return t("finance.periodMonth");
      case RentPeriod.YEARLY:
        return t("finance.periodYear");
      default:
        return "";
    }
  }, [contractAgreement, t]);

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
      {form.driverId || form.carId ? (
        <div
          className={`crm-contract-note crm-contract-note--${contractAgreement?.status === AgreementStatus.ACTIVE ? "active" : contractAgreement ? "ended" : "none"}`}
        >
          {contractAgreement ? (
            <>
              <div className="crm-contract-note__row crm-contract-note__row--primary">
                <Icon
                  name="invoice-01"
                  size={16}
                  color="var(--taxi-accent, #ffc107)"
                />
                <span>
                  {t("finance.contractRequires", {
                    amount: formatMoney(contractAgreement.rentAmount),
                    period: contractPeriodLabel,
                  })}
                </span>
              </div>
              <div className="crm-contract-note__row crm-contract-note__row--meta">
                <Icon
                  name="calendar-01"
                  size={14}
                  color="rgba(255, 255, 255, 0.55)"
                />
                <span>
                  {(() => {
                    if (contractAgreement.status === AgreementStatus.ACTIVE) {
                      if (contractAgreement.endDate) {
                        return t("finance.contractEndsOn", {
                          date: formatDate(contractAgreement.endDate),
                        });
                      }
                      return `${t("cars.startDate")}: ${formatDate(contractAgreement.startDate)}`;
                    }
                    return t("finance.contractEnded", {
                      date: formatDate(
                        contractAgreement.endDate ?? contractAgreement.startDate,
                      ),
                    });
                  })()}
                </span>
              </div>
            </>
          ) : (
            <div className="crm-contract-note__row">
              <Icon
                name="information-circle"
                size={16}
                color="rgba(255, 255, 255, 0.55)"
              />
              <span>
                {form.carId
                  ? t("finance.contractNoAgreementForCar")
                  : form.driverId
                    ? t("finance.contractNoAgreementForDriver")
                    : t("finance.contractNoAgreement")}
              </span>
            </div>
          )}
        </div>
      ) : null}
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
      {form.type === PaymentType.RENT ? (
        <Field
          label={t("finance.discount")}
          hint={t("finance.discountHint")}
          invalid={fieldErrors.discount}
          errorMessage={
            fieldErrors.discount ? t("finance.discountInvalid") : undefined
          }
        >
          <MoneyNumberInput
            value={form.discount}
            invalid={fieldErrors.discount}
            onChange={(v) => {
              // Clamp negatives at the input layer so the preview never
              // shows a "negative discount" (which would actually
              // *increase* the driver's balance via the formula).
              const clamped = typeof v === "number" && v < 0 ? 0 : v;
              setForm({ ...form, discount: clamped });
              props.onFieldErrorClear?.("discount");
            }}
            placeholder="0"
          />
        </Field>
      ) : null}
      {form.type === PaymentType.RENT &&
      form.amount !== "" &&
      form.discount !== "" &&
      form.discount > 0 ? (
        <div className="crm-discount-preview">
          <div className="crm-discount-preview__row">
            <span>{t("finance.fullRent")}</span>
            <strong>{formatMoney(form.amount + form.discount)}</strong>
          </div>
          <div className="crm-discount-preview__row">
            <span>{t("finance.discount")}</span>
            <strong className="crm-discount-preview__discount">
              −{formatMoney(form.discount)}
            </strong>
          </div>
          <div className="crm-discount-preview__row crm-discount-preview__row--total">
            <span>{t("finance.amountPaid")}</span>
            <strong>{formatMoney(form.amount)}</strong>
          </div>
        </div>
      ) : null}
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
          // The payment form only collects money that the owner actually
          // receives from a driver (RENT) or holds on their behalf as a
          // refundable deposit (DEPOSIT). Refunds are issued via the
          // dashboard's deposit controls, fines live in the dedicated Fines
          // module, and discounts are now recorded inline on a RENT payment
          // (see the Discount field above) — they don't need their own
          // payment-type entry.
          options={[
            { value: PaymentType.RENT, label: t(`finance.${PaymentType.RENT}`) },
            { value: PaymentType.DEPOSIT, label: t(`finance.${PaymentType.DEPOSIT}`) },
          ]}
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
        <TextArea
          value={form.note}
          maxLength={12000}
          rows={3}
          maxRows={10}
          onChange={(v) => setForm({ ...form, note: v })}
        />
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
