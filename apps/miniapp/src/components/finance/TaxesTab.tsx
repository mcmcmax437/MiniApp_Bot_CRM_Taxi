import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExpenseCategory } from "@taxi/shared";
import { useExpenses, useCars, useSaveExpense, useDeleteExpense } from "../../hooks";
import {
  Modal,
  Field,
  TextInput,
  DateInput,
  SelectInput,
  FormActions,
  formatMoney,
  formatDate,
  MoneyNumberInput,
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
  FinanceDateGroupedList,
  financeInPeriod,
  sortFinanceByDate,
  type FinancePeriod,
  type FinanceDateSort,
} from "./FinanceUi";
import { useReadOnly } from "../../readOnly";
import { ApiError } from "../../api";
import { showAlert } from "../../telegram";

function notifySaveError(err: unknown, fallbackKey: string): void {
  let message: string;
  if (err instanceof ApiError) {
    message = err.message || fallbackKey;
  } else if (err instanceof Error) {
    message = err.message || fallbackKey;
  } else {
    message = fallbackKey;
  }
  showAlert(message);
}

export function TaxesTab() {
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
    const list = taxItems.filter((e) => {
      if (!financeInPeriod(e.date, period)) return false;
      if (!q) return true;
      const hay = `${e.car?.plate ?? ""} ${e.note ?? ""} ${e.amount}`.toLowerCase();
      return hay.includes(q);
    });
    return sortFinanceByDate(list, dateSort, (e) => e.date);
  }, [taxItems, period, search, dateSort]);

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
      {
        onSuccess: () => setOpen(false),
        onError: (err) => notifySaveError(err, t("common.saveFailed")),
      },
    );
  }

  return (
    <>
      {!readOnly ? <FinanceAddButton label={t("finance.addTax")} onClick={openCreate} /> : null}

      <p className="crm-form-hint" style={{ margin: "0 0 8px" }}>
        {t("finance.taxesHint")}
      </p>

      <FinanceStatsRow>
        <FinanceStatCard
          title={t("finance.totalTax")}
          value={formatMoney(total)}
          subtitle={t("finance.taxCount", { count: taxItems.length })}
          tone="red"
          icon={<Icon name="lock" size={16} color="#ff5252" />}
        />
        <FinanceStatCard
          title={t("finance.thisMonth")}
          value={formatMoney(monthSum)}
          subtitle={t("finance.taxCount", { count: monthItems.length })}
          tone="purple"
          icon={<Icon name="calendar-01" size={16} color="#b388ff" />}
        />
        <FinanceStatCard
          title={t("finance.period_year")}
          value={formatMoney(yearSum)}
          subtitle={t("finance.taxCount", { count: yearItems.length })}
          tone="blue"
          icon={<Icon name="invoice-01" size={16} color="#448aff" />}
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
        dateSort={dateSort}
        onDateSortChange={setDateSort}
        sortOpen={sortOpen}
        onSortOpenChange={setSortOpen}
      />

      {!expenses.isLoading && filtered.length === 0 ? (
        <FinanceEmptyState
          title={t("common.empty")}
          description={t("finance.emptyTaxesDesc")}
          actionLabel={readOnly ? undefined : t("finance.addTax")}
          onAction={readOnly ? undefined : openCreate}
        />
      ) : (
        <FinanceList loading={expenses.isLoading}>
          <FinanceDateGroupedList
            items={filtered}
            collapseStorageKey="finance-taxes-months"
            getDate={(e) => e.date}
            getKey={(e) => e.id}
            getAmount={(e) => e.amount}
            formatCount={(count) => t("finance.taxCount", { count })}
            summaryTone="expense"
            renderItem={(e) => (
              <FinanceListItem
                title={e.note?.trim() || t("finance.TAX")}
                subtitle={[formatDate(e.date), e.car?.plate ?? t("finance.allCars"), t("finance.TAX")]
                  .filter(Boolean)
                  .join(" • ")}
                amount={formatMoney(e.amount)}
                amountTone="expense"
                onClick={
                  readOnly
                    ? undefined
                    : () => {
                        setEditId(e.id);
                        setForm({
                          carId: e.carId ?? "",
                          amount: e.amount,
                          date: e.date.slice(0, 10),
                          note: e.note ?? "",
                        });
                        setOpen(true);
                      }
                }
              />
            )}
          />
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
          <MoneyNumberInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
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
