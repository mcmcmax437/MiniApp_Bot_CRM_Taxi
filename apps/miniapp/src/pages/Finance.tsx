import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PaymentMethod, PaymentType, ExpenseCategory, FineStatus } from "@taxi/shared";
import {
  usePayments,
  useExpenses,
  useBalances,
  useDrivers,
  useCars,
  useSavePayment,
  useDeletePayment,
  useSaveExpense,
  useDeleteExpense,
  useFines,
  useSaveFine,
  useDeleteFine,
  useShifts,
  useSaveShift,
  useDeleteShift,
} from "../hooks";
import {
  Modal,
  Field,
  TextInput,
  NumberInput,
  DateInput,
  SelectInput,
  FormActions,
  formatMoney,
  formatDate,
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
  financeInPeriod,
  type FinanceTabId,
  type FinancePeriod,
} from "../components/finance/FinanceUi";

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
      {tab === "fines" && <FinesTab />}
      {tab === "shifts" && <ShiftsTab />}
      {tab === "balances" && <BalancesTab />}
    </div>
  );
}

function PaymentsTab() {
  const { t } = useTranslation();
  const payments = usePayments();
  const balances = useBalances();
  const drivers = useDrivers();
  const cars = useCars();
  const save = useSavePayment();
  const del = useDeletePayment();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<PaymentType | "ALL">("ALL");
  const [form, setForm] = useState<{
    driverId: string;
    carId: string;
    amount: number | "";
    date: string;
    method: PaymentMethod;
    type: PaymentType;
    note: string;
  }>({
    driverId: "",
    carId: "",
    amount: "",
    date: todayInput(),
    method: PaymentMethod.CASH,
    type: PaymentType.RENT,
    note: "",
  });

  const all = payments.data ?? [];
  const totalPaid = all.reduce((s, p) => s + p.amount, 0);
  const debts = (balances.data ?? []).filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const monthItems = all.filter((p) => financeInPeriod(p.date, "month"));
  const monthSum = monthItems.reduce((s, p) => s + p.amount, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => {
      if (!financeInPeriod(p.date, period)) return false;
      if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
      if (!q) return true;
      const hay = `${p.driver?.fullName ?? ""} ${p.note ?? ""} ${p.amount}`.toLowerCase();
      return hay.includes(q);
    });
  }, [all, period, search, typeFilter]);

  function openCreate() {
    setEditId(null);
    setForm({
      driverId: drivers.data?.[0]?.id ?? "",
      carId: "",
      amount: "",
      date: todayInput(),
      method: PaymentMethod.CASH,
      type: PaymentType.RENT,
      note: "",
    });
    setOpen(true);
  }

  function openEdit(p: (typeof all)[number]) {
    setEditId(p.id);
    setForm({
      driverId: p.driverId,
      carId: p.carId ?? "",
      amount: p.amount,
      date: p.date.slice(0, 10),
      method: p.method,
      type: p.type,
      note: p.note ?? "",
    });
    setOpen(true);
  }

  function submit() {
    if (!form.driverId || form.amount === "") return;
    save.mutate(
      {
        id: editId ?? undefined,
        data: {
          driverId: form.driverId,
          carId: form.carId || null,
          amount: form.amount,
          date: form.date,
          method: form.method,
          type: form.type,
          note: form.note || null,
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <FinanceAddButton label={t("finance.addPayment")} onClick={openCreate} disabled={!drivers.data?.length} />

      <FinanceStatsRow>
        <FinanceStatCard
          title={t("finance.totalPayments")}
          value={String(all.length)}
          subtitle={t("finance.allTime")}
          tone="blue"
          icon={
            <Icon stroke="#448aff" fill="none" width="22" height="22">
              <rect x="3" y="6" width="18" height="13" rx="2" strokeWidth="1.6" />
              <path d="M3 10h18" strokeWidth="1.6" />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("finance.paid")}
          value={formatMoney(totalPaid)}
          subtitle={t("finance.allTime")}
          tone="green"
          icon={
            <Icon stroke="#69f0ae" fill="none" width="22" height="22">
              <path d="M6 16l4-8 4 4 4-10" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("finance.debts")}
          value={formatMoney(debts)}
          subtitle={t("finance.allTime")}
          tone="red"
          icon={
            <Icon stroke="#ff5252" fill="none" width="22" height="22">
              <path d="M6 8l4 8 4-4 4 6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("finance.thisMonth")}
          value={formatMoney(monthSum)}
          subtitle={t("finance.paymentCount", { count: monthItems.length })}
          tone="purple"
          icon={
            <Icon stroke="#b388ff" fill="none" width="22" height="22">
              <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.6" />
              <path d="M8 3v4M16 3v4M4 10h16" strokeWidth="1.6" strokeLinecap="round" />
            </Icon>
          }
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
              {Object.values(PaymentType).map((pt) => (
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
          actionLabel={t("finance.addPayment")}
          onAction={openCreate}
        />
      ) : (
        <FinanceList loading={payments.isLoading}>
          {filtered.map((p) => (
            <FinanceListItem
              key={p.id}
              title={p.driver?.fullName ?? "—"}
              subtitle={`${formatDate(p.date)} • ${t(`finance.${p.type}`)} • ${t(`finance.${p.method}`)}`}
              amount={formatMoney(p.amount)}
              amountTone="income"
              onClick={() => openEdit(p)}
            />
          ))}
        </FinanceList>
      )}

      <PaymentModal
        open={open}
        editId={editId}
        form={form}
        setForm={setForm}
        drivers={drivers.data ?? []}
        cars={cars.data ?? []}
        saving={save.isPending}
        onClose={() => setOpen(false)}
        onSave={submit}
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
  const expenses = useExpenses();
  const cars = useCars();
  const save = useSaveExpense();
  const del = useDeleteExpense();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [form, setForm] = useState<{
    carId: string;
    category: ExpenseCategory;
    amount: number | "";
    date: string;
    note: string;
  }>({
    carId: "",
    category: ExpenseCategory.FUEL,
    amount: "",
    date: todayInput(),
    note: "",
  });

  const all = expenses.data ?? [];
  const total = all.reduce((s, e) => s + e.amount, 0);
  const monthItems = all.filter((e) => financeInPeriod(e.date, "month"));
  const monthSum = monthItems.reduce((s, e) => s + e.amount, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((e) => {
      if (!financeInPeriod(e.date, period)) return false;
      if (!q) return true;
      const hay = `${t(`finance.${e.category}`)} ${e.car?.plate ?? ""} ${e.note ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [all, period, search, t]);

  function openCreate() {
    setEditId(null);
    setForm({ carId: "", category: ExpenseCategory.FUEL, amount: "", date: todayInput(), note: "" });
    setOpen(true);
  }

  function submit() {
    if (form.amount === "") return;
    save.mutate(
      {
        id: editId ?? undefined,
        data: {
          carId: form.carId || null,
          category: form.category,
          amount: form.amount,
          date: form.date,
          note: form.note || null,
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <FinanceAddButton label={t("finance.addExpense")} onClick={openCreate} />

      <FinanceStatsRow>
        <FinanceStatCard
          title={t("finance.totalExpenses")}
          value={String(all.length)}
          subtitle={t("finance.allTime")}
          tone="blue"
          icon={
            <Icon stroke="#448aff" fill="none" width="22" height="22">
              <path d="M12 3c-1.5 3-4 5-4 8a4 4 0 0 0 8 0c0-3-2.5-5-4-8z" strokeWidth="1.6" />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("finance.spent")}
          value={formatMoney(total)}
          subtitle={t("finance.allTime")}
          tone="red"
          icon={
            <Icon stroke="#ff5252" fill="none" width="22" height="22">
              <path d="M6 8l4 8 4-4 4 6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("finance.thisMonth")}
          value={formatMoney(monthSum)}
          subtitle={t("finance.expenseCount", { count: monthItems.length })}
          tone="purple"
          icon={
            <Icon stroke="#b388ff" fill="none" width="22" height="22">
              <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.6" />
            </Icon>
          }
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
      />

      {!expenses.isLoading && filtered.length === 0 ? (
        <FinanceEmptyState
          title={t("common.empty")}
          description={t("finance.emptyExpensesDesc")}
          actionLabel={t("finance.addExpense")}
          onAction={openCreate}
        />
      ) : (
        <FinanceList loading={expenses.isLoading}>
          {filtered.map((e) => (
            <FinanceListItem
              key={e.id}
              title={t(`finance.${e.category}`)}
              subtitle={`${formatDate(e.date)} • ${e.car?.plate ?? t("common.none")}`}
              amount={formatMoney(e.amount)}
              amountTone="expense"
              onClick={() => {
                setEditId(e.id);
                setForm({
                  carId: e.carId ?? "",
                  category: e.category,
                  amount: e.amount,
                  date: e.date.slice(0, 10),
                  note: e.note ?? "",
                });
                setOpen(true);
              }}
            />
          ))}
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
            options={Object.values(ExpenseCategory).map((x) => ({ value: x, label: t(`finance.${x}`) }))}
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
        <Field label={t("finance.amount")}>
          <NumberInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
        </Field>
        <Field label={t("finance.date")}>
          <DateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        </Field>
        <Field label={t("finance.note")}>
          <TextInput value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
        </Field>
      </Modal>
    </>
  );
}

function FinesTab() {
  const { t } = useTranslation();
  const fines = useFines();
  const drivers = useDrivers();
  const cars = useCars();
  const save = useSaveFine();
  const del = useDeleteFine();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [form, setForm] = useState<{
    driverId: string;
    carId: string;
    amount: number | "";
    date: string;
    status: FineStatus;
    description: string;
  }>({
    driverId: "",
    carId: "",
    amount: "",
    date: todayInput(),
    status: FineStatus.UNPAID,
    description: "",
  });

  const all = fines.data ?? [];
  const unpaid = all.filter((f) => f.status === FineStatus.UNPAID).reduce((s, f) => s + f.amount, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((f) => {
      if (!financeInPeriod(f.date, period)) return false;
      if (!q) return true;
      const hay = `${f.description ?? ""} ${f.driver?.fullName ?? ""} ${f.car?.plate ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [all, period, search]);

  function openCreate() {
    setEditId(null);
    setForm({ driverId: "", carId: "", amount: "", date: todayInput(), status: FineStatus.UNPAID, description: "" });
    setOpen(true);
  }

  function submit() {
    if (form.amount === "") return;
    save.mutate(
      {
        id: editId ?? undefined,
        data: {
          driverId: form.driverId || null,
          carId: form.carId || null,
          amount: form.amount,
          date: form.date,
          status: form.status,
          description: form.description || null,
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <FinanceAddButton label={t("fines.addFine")} onClick={openCreate} />

      <FinanceStatsRow>
        <FinanceStatCard
          title={t("fines.title")}
          value={String(all.length)}
          subtitle={t("finance.allTime")}
          tone="blue"
          icon={
            <Icon stroke="#448aff" fill="none" width="22" height="22">
              <path d="M8 4h8l2 4v10H6V4h2z" strokeWidth="1.6" />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("fines.UNPAID")}
          value={formatMoney(unpaid)}
          subtitle={t("finance.allTime")}
          tone="red"
          icon={
            <Icon stroke="#ff9800" fill="none" width="22" height="22">
              <path d="M12 8v5M12 16h.01" strokeWidth="1.8" strokeLinecap="round" />
            </Icon>
          }
        />
      </FinanceStatsRow>

      <FinanceSearchRow
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("finance.searchFines")}
        period={period}
        onPeriodChange={setPeriod}
        periodOpen={periodOpen}
        onPeriodOpenChange={setPeriodOpen}
      />

      {!fines.isLoading && filtered.length === 0 ? (
        <FinanceEmptyState
          title={t("common.empty")}
          description={t("finance.emptyFinesDesc")}
          actionLabel={t("fines.addFine")}
          onAction={openCreate}
        />
      ) : (
        <FinanceList loading={fines.isLoading}>
          {filtered.map((f) => (
            <FinanceListItem
              key={f.id}
              title={f.description || t("fines.title")}
              subtitle={`${formatDate(f.date)} • ${t(`fines.${f.status}`)} • ${f.driver?.fullName ?? f.car?.plate ?? ""}`}
              amount={formatMoney(f.amount)}
              amountTone="expense"
              onClick={() => {
                setEditId(f.id);
                setForm({
                  driverId: f.driverId ?? "",
                  carId: f.carId ?? "",
                  amount: f.amount,
                  date: f.date.slice(0, 10),
                  status: f.status,
                  description: f.description ?? "",
                });
                setOpen(true);
              }}
            />
          ))}
        </FinanceList>
      )}

      <Modal
        open={open}
        title={t("fines.addFine")}
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
        <Field label={t("finance.driver")}>
          <SelectInput
            value={form.driverId}
            onChange={(v) => setForm({ ...form, driverId: v })}
            options={[
              { value: "", label: t("common.none") },
              ...(drivers.data ?? []).map((d) => ({ value: d.id, label: d.fullName })),
            ]}
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
        <Field label={t("finance.amount")}>
          <NumberInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
        </Field>
        <Field label={t("finance.date")}>
          <DateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        </Field>
        <Field label={t("fines.status")}>
          <SelectInput
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={Object.values(FineStatus).map((x) => ({ value: x, label: t(`fines.${x}`) }))}
          />
        </Field>
        <Field label={t("fines.description")}>
          <TextInput value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        </Field>
      </Modal>
    </>
  );
}

function ShiftsTab() {
  const { t } = useTranslation();
  const shifts = useShifts();
  const drivers = useDrivers();
  const cars = useCars();
  const save = useSaveShift();
  const del = useDeleteShift();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [form, setForm] = useState({
    carId: "",
    driverId: "",
    date: todayInput(),
    mileageStart: "" as number | "",
    mileageEnd: "" as number | "",
    income: "" as number | "",
    note: "",
  });

  const all = shifts.data ?? [];
  const monthItems = all.filter((s) => financeInPeriod(s.date, "month"));
  const monthIncome = monthItems.reduce((s, sh) => s + (sh.income ?? 0), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((s) => {
      if (!financeInPeriod(s.date, period)) return false;
      if (!q) return true;
      const hay = `${s.driver?.fullName ?? ""} ${s.car?.plate ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [all, period, search]);

  function openCreate() {
    setEditId(null);
    setForm({
      carId: cars.data?.[0]?.id ?? "",
      driverId: drivers.data?.[0]?.id ?? "",
      date: todayInput(),
      mileageStart: "",
      mileageEnd: "",
      income: "",
      note: "",
    });
    setOpen(true);
  }

  function submit() {
    if (!form.carId || !form.driverId) return;
    save.mutate(
      {
        id: editId ?? undefined,
        data: {
          carId: form.carId,
          driverId: form.driverId,
          date: form.date,
          mileageStart: form.mileageStart === "" ? null : form.mileageStart,
          mileageEnd: form.mileageEnd === "" ? null : form.mileageEnd,
          income: form.income === "" ? null : form.income,
          note: form.note || null,
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <FinanceAddButton
        label={t("shifts.addShift")}
        onClick={openCreate}
        disabled={!cars.data?.length || !drivers.data?.length}
      />

      <FinanceStatsRow>
        <FinanceStatCard
          title={t("shifts.title")}
          value={String(all.length)}
          subtitle={t("finance.allTime")}
          tone="blue"
          icon={
            <Icon stroke="#448aff" fill="none" width="22" height="22">
              <path d="M7 8h10M7 12h10" strokeWidth="1.6" strokeLinecap="round" />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("finance.thisMonth")}
          value={formatMoney(monthIncome)}
          subtitle={t("finance.shiftCount", { count: monthItems.length })}
          tone="green"
          icon={
            <Icon stroke="#69f0ae" fill="none" width="22" height="22">
              <path d="M6 16l4-8 4 4 4-10" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </Icon>
          }
        />
      </FinanceStatsRow>

      <FinanceSearchRow
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("finance.searchShifts")}
        period={period}
        onPeriodChange={setPeriod}
        periodOpen={periodOpen}
        onPeriodOpenChange={setPeriodOpen}
      />

      {!shifts.isLoading && filtered.length === 0 ? (
        <FinanceEmptyState
          title={t("common.empty")}
          description={t("finance.emptyShiftsDesc")}
          actionLabel={t("shifts.addShift")}
          onAction={openCreate}
        />
      ) : (
        <FinanceList loading={shifts.isLoading}>
          {filtered.map((s) => (
            <FinanceListItem
              key={s.id}
              title={
                s.mileageStart != null && s.mileageEnd != null
                  ? `${s.mileageEnd - s.mileageStart} km`
                  : t("shifts.title")
              }
              subtitle={`${formatDate(s.date)} • ${s.car?.plate ?? ""} • ${s.driver?.fullName ?? ""}`}
              amount={s.income != null ? formatMoney(s.income) : undefined}
              amountTone="income"
              onClick={() => {
                setEditId(s.id);
                setForm({
                  carId: s.carId,
                  driverId: s.driverId,
                  date: s.date.slice(0, 10),
                  mileageStart: s.mileageStart ?? "",
                  mileageEnd: s.mileageEnd ?? "",
                  income: s.income ?? "",
                  note: s.note ?? "",
                });
                setOpen(true);
              }}
            />
          ))}
        </FinanceList>
      )}

      <Modal
        open={open}
        title={t("shifts.addShift")}
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
        <Field label={t("finance.car")}>
          <SelectInput
            value={form.carId}
            onChange={(v) => setForm({ ...form, carId: v })}
            options={(cars.data ?? []).map((c) => ({ value: c.id, label: c.plate }))}
          />
        </Field>
        <Field label={t("finance.driver")}>
          <SelectInput
            value={form.driverId}
            onChange={(v) => setForm({ ...form, driverId: v })}
            options={(drivers.data ?? []).map((d) => ({ value: d.id, label: d.fullName }))}
          />
        </Field>
        <Field label={t("finance.date")}>
          <DateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        </Field>
        <Field label={t("shifts.mileageStart")}>
          <NumberInput value={form.mileageStart} onChange={(v) => setForm({ ...form, mileageStart: v })} />
        </Field>
        <Field label={t("shifts.mileageEnd")}>
          <NumberInput value={form.mileageEnd} onChange={(v) => setForm({ ...form, mileageEnd: v })} />
        </Field>
        <Field label={t("shifts.income")}>
          <NumberInput value={form.income} onChange={(v) => setForm({ ...form, income: v })} />
        </Field>
        <Field label={t("finance.note")}>
          <TextInput value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
        </Field>
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
          icon={
            <Icon stroke="#b388ff" fill="none" width="22" height="22">
              <path d="M6 8h12v10H6z" strokeWidth="1.6" />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("finance.debts")}
          value={formatMoney(totalDebt)}
          subtitle={t("finance.allTime")}
          tone="red"
          icon={
            <Icon stroke="#ff5252" fill="none" width="22" height="22">
              <path d="M6 8l4 8 4-4 4 6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </Icon>
          }
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
  };
  setForm: (f: typeof props.form) => void;
  drivers: { id: string; fullName: string }[];
  cars: { id: string; plate: string }[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { form, setForm } = props;

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
        <SelectInput
          value={form.driverId}
          onChange={(v) => setForm({ ...form, driverId: v })}
          options={props.drivers.map((d) => ({ value: d.id, label: d.fullName }))}
        />
      </Field>
      <Field label={t("finance.car")}>
        <SelectInput
          value={form.carId}
          onChange={(v) => setForm({ ...form, carId: v })}
          options={[
            { value: "", label: t("common.none") },
            ...props.cars.map((c) => ({ value: c.id, label: c.plate })),
          ]}
        />
      </Field>
      <Field label={t("finance.amount")}>
        <NumberInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
      </Field>
      <Field label={t("finance.date")}>
        <DateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
      </Field>
      <Field label={t("finance.type")}>
        <SelectInput
          value={form.type}
          onChange={(v) => setForm({ ...form, type: v })}
          options={Object.values(PaymentType).map((x) => ({ value: x, label: t(`finance.${x}`) }))}
        />
      </Field>
      <Field label={t("finance.method")}>
        <SelectInput
          value={form.method}
          onChange={(v) => setForm({ ...form, method: v })}
          options={Object.values(PaymentMethod).map((x) => ({ value: x, label: t(`finance.${x}`) }))}
        />
      </Field>
      <Field label={t("finance.note")}>
        <TextInput value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
      </Field>
    </Modal>
  );
}
