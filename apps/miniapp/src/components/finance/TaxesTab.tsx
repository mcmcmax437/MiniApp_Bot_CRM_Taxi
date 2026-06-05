import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExpenseCategory } from "@taxi/shared";
import { useExpenses, useCars, useSaveExpense, useDeleteExpense } from "../../hooks";
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
} from "../ui";
import { Icon } from "../crm";
import {
  FinanceAddButton,
  FinanceStatCard,
  FinanceStatsRow,
  FinanceSearchRow,
  FinanceEmptyState,
  FinanceList,
  FinanceListItem,
  financeInPeriod,
  type FinancePeriod,
} from "./FinanceUi";

export function TaxesTab() {
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
    amount: number | "";
    date: string;
    note: string;
  }>({
    carId: "",
    amount: "",
    date: todayInput(),
    note: "",
  });

  const taxItems = useMemo(
    () => (expenses.data ?? []).filter((e) => e.category === ExpenseCategory.TAX),
    [expenses.data],
  );

  const total = taxItems.reduce((s, e) => s + e.amount, 0);
  const monthItems = taxItems.filter((e) => financeInPeriod(e.date, "month"));
  const monthSum = monthItems.reduce((s, e) => s + e.amount, 0);
  const yearItems = taxItems.filter((e) => financeInPeriod(e.date, "year"));
  const yearSum = yearItems.reduce((s, e) => s + e.amount, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return taxItems.filter((e) => {
      if (!financeInPeriod(e.date, period)) return false;
      if (!q) return true;
      const hay = `${e.car?.plate ?? ""} ${e.note ?? ""} ${e.amount}`.toLowerCase();
      return hay.includes(q);
    });
  }, [taxItems, period, search]);

  function openCreate() {
    setEditId(null);
    setForm({ carId: "", amount: "", date: todayInput(), note: "" });
    setOpen(true);
  }

  function submit() {
    if (form.amount === "") return;
    save.mutate(
      {
        id: editId ?? undefined,
        data: {
          carId: form.carId || null,
          category: ExpenseCategory.TAX,
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
      <FinanceAddButton label={t("finance.addTax")} onClick={openCreate} />

      <p className="crm-form-hint" style={{ margin: "0 0 8px" }}>
        {t("finance.taxesHint")}
      </p>

      <FinanceStatsRow>
        <FinanceStatCard
          title={t("finance.totalTax")}
          value={formatMoney(total)}
          subtitle={t("finance.taxCount", { count: taxItems.length })}
          tone="red"
          icon={
            <Icon stroke="#ff5252" fill="none" width="22" height="22">
              <path d="M6 8h12v10H6z" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeWidth="1.6" />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("finance.thisMonth")}
          value={formatMoney(monthSum)}
          subtitle={t("finance.taxCount", { count: monthItems.length })}
          tone="purple"
          icon={
            <Icon stroke="#b388ff" fill="none" width="22" height="22">
              <rect x="4" y="5" width="16" height="15" rx="2" strokeWidth="1.6" />
            </Icon>
          }
        />
        <FinanceStatCard
          title={t("finance.period_year")}
          value={formatMoney(yearSum)}
          subtitle={t("finance.taxCount", { count: yearItems.length })}
          tone="blue"
          icon={
            <Icon stroke="#448aff" fill="none" width="22" height="22">
              <path d="M4 18V6l8-3 8 3v12l-8 3-8-3z" strokeWidth="1.6" strokeLinejoin="round" />
            </Icon>
          }
        />
      </FinanceStatsRow>

      <FinanceSearchRow
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("finance.searchTaxes")}
        period={period}
        onPeriodChange={setPeriod}
        periodOpen={periodOpen}
        onPeriodOpenChange={setPeriodOpen}
      />

      {!expenses.isLoading && filtered.length === 0 ? (
        <FinanceEmptyState
          title={t("common.empty")}
          description={t("finance.emptyTaxesDesc")}
          actionLabel={t("finance.addTax")}
          onAction={openCreate}
        />
      ) : (
        <FinanceList loading={expenses.isLoading}>
          {filtered.map((e) => (
            <FinanceListItem
              key={e.id}
              title={e.note?.trim() || t("finance.TAX")}
              subtitle={`${formatDate(e.date)} • ${e.car?.plate ?? t("finance.allCars")}`}
              amount={formatMoney(e.amount)}
              amountTone="expense"
              onClick={() => {
                setEditId(e.id);
                setForm({
                  carId: e.carId ?? "",
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
        title={editId ? t("finance.editTax") : t("finance.addTax")}
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
            options={[
              { value: "", label: t("finance.allCars") },
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
          <TextInput value={form.note} onChange={(v) => setForm({ ...form, note: v })} placeholder={t("finance.taxNotePlaceholder")} />
        </Field>
      </Modal>
    </>
  );
}
