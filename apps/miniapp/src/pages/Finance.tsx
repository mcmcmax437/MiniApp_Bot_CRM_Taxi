import { useState } from "react";
import { List, Section, Cell, Button, Spinner, SegmentedControl } from "@telegram-apps/telegram-ui";
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

type Tab = "payments" | "expenses" | "fines" | "shifts" | "balances";

export function FinancePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("payments");

  const tabs: { id: Tab; label: string }[] = [
    { id: "payments", label: t("finance.payments") },
    { id: "expenses", label: t("finance.expenses") },
    { id: "fines", label: t("fines.title") },
    { id: "shifts", label: t("shifts.title") },
    { id: "balances", label: t("finance.balances") },
  ];

  return (
    <List>
      <div style={{ padding: "12px 16px" }}>
        <SegmentedControl>
          {tabs.map((tb) => (
            <SegmentedControl.Item key={tb.id} selected={tab === tb.id} onClick={() => setTab(tb.id)}>
              {tb.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
      </div>

      {tab === "payments" && <PaymentsTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "fines" && <FinesTab />}
      {tab === "shifts" && <ShiftsTab />}
      {tab === "balances" && <BalancesTab />}
    </List>
  );
}

// ---------------------------------------------------------------------------
function PaymentsTab() {
  const { t } = useTranslation();
  const payments = usePayments();
  const drivers = useDrivers();
  const cars = useCars();
  const save = useSavePayment();
  const del = useDeletePayment();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
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
      <div className="row-actions">
        <Button stretched onClick={openCreate} disabled={!drivers.data?.length}>
          + {t("finance.addPayment")}
        </Button>
      </div>
      <Section>
        {payments.isLoading && <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>}
        {payments.data?.length === 0 && <Cell>{t("common.empty")}</Cell>}
        {payments.data?.map((p) => (
          <Cell
            key={p.id}
            subtitle={`${formatDate(p.date)} • ${t(`finance.${p.type}`)} • ${t(`finance.${p.method}`)}`}
            after={<span className="amount-neg">{formatMoney(p.amount)}</span>}
            onClick={() => {
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
            }}
          >
            {p.driver?.fullName ?? "—"}
          </Cell>
        ))}
      </Section>

      <Modal
        open={open}
        title={t("finance.addPayment")}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FormActions onCancel={() => setOpen(false)} onSave={submit} saving={save.isPending} />
            {editId && (
              <Button
                mode="outline"
                stretched
                onClick={() =>
                  confirm(t("common.confirmDelete")) &&
                  del.mutate(editId, { onSuccess: () => setOpen(false) })
                }
              >
                {t("common.delete")}
              </Button>
            )}
          </div>
        }
      >
        <Field label={t("finance.driver")}>
          <SelectInput
            value={form.driverId}
            onChange={(v) => setForm({ ...form, driverId: v })}
            options={(drivers.data ?? []).map((d) => ({ value: d.id, label: d.fullName }))}
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
    </>
  );
}

// ---------------------------------------------------------------------------
function ExpensesTab() {
  const { t } = useTranslation();
  const expenses = useExpenses();
  const cars = useCars();
  const save = useSaveExpense();
  const del = useDeleteExpense();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
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
      <div className="row-actions">
        <Button stretched onClick={openCreate}>
          + {t("finance.addExpense")}
        </Button>
      </div>
      <Section>
        {expenses.isLoading && <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>}
        {expenses.data?.length === 0 && <Cell>{t("common.empty")}</Cell>}
        {expenses.data?.map((e) => (
          <Cell
            key={e.id}
            subtitle={`${formatDate(e.date)} • ${e.car?.plate ?? t("common.none")}`}
            after={<span className="amount-pos">{formatMoney(e.amount)}</span>}
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
          >
            {t(`finance.${e.category}`)}
          </Cell>
        ))}
      </Section>

      <Modal
        open={open}
        title={t("finance.addExpense")}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FormActions onCancel={() => setOpen(false)} onSave={submit} saving={save.isPending} />
            {editId && (
              <Button
                mode="outline"
                stretched
                onClick={() =>
                  confirm(t("common.confirmDelete")) &&
                  del.mutate(editId, { onSuccess: () => setOpen(false) })
                }
              >
                {t("common.delete")}
              </Button>
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

// ---------------------------------------------------------------------------
function FinesTab() {
  const { t } = useTranslation();
  const fines = useFines();
  const drivers = useDrivers();
  const cars = useCars();
  const save = useSaveFine();
  const del = useDeleteFine();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    driverId: string;
    carId: string;
    amount: number | "";
    date: string;
    status: FineStatus;
    description: string;
  }>({ driverId: "", carId: "", amount: "", date: todayInput(), status: FineStatus.UNPAID, description: "" });

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
      <div className="row-actions">
        <Button stretched onClick={openCreate}>
          + {t("fines.addFine")}
        </Button>
      </div>
      <Section>
        {fines.isLoading && <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>}
        {fines.data?.length === 0 && <Cell>{t("common.empty")}</Cell>}
        {fines.data?.map((f) => (
          <Cell
            key={f.id}
            subtitle={`${formatDate(f.date)} • ${t(`fines.${f.status}`)} • ${f.driver?.fullName ?? f.car?.plate ?? ""}`}
            after={<span className="amount-pos">{formatMoney(f.amount)}</span>}
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
          >
            {f.description || t("fines.title")}
          </Cell>
        ))}
      </Section>

      <Modal
        open={open}
        title={t("fines.addFine")}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FormActions onCancel={() => setOpen(false)} onSave={submit} saving={save.isPending} />
            {editId && (
              <Button
                mode="outline"
                stretched
                onClick={() =>
                  confirm(t("common.confirmDelete")) &&
                  del.mutate(editId, { onSuccess: () => setOpen(false) })
                }
              >
                {t("common.delete")}
              </Button>
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

// ---------------------------------------------------------------------------
function ShiftsTab() {
  const { t } = useTranslation();
  const shifts = useShifts();
  const drivers = useDrivers();
  const cars = useCars();
  const save = useSaveShift();
  const del = useDeleteShift();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    carId: string;
    driverId: string;
    date: string;
    mileageStart: number | "";
    mileageEnd: number | "";
    income: number | "";
    note: string;
  }>({ carId: "", driverId: "", date: todayInput(), mileageStart: "", mileageEnd: "", income: "", note: "" });

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
      <div className="row-actions">
        <Button stretched onClick={openCreate} disabled={!cars.data?.length || !drivers.data?.length}>
          + {t("shifts.addShift")}
        </Button>
      </div>
      <Section>
        {shifts.isLoading && <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>}
        {shifts.data?.length === 0 && <Cell>{t("common.empty")}</Cell>}
        {shifts.data?.map((s) => (
          <Cell
            key={s.id}
            subtitle={`${formatDate(s.date)} • ${s.car?.plate ?? ""} • ${s.driver?.fullName ?? ""}`}
            after={s.income != null ? <span className="amount-neg">{formatMoney(s.income)}</span> : null}
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
          >
            {s.mileageStart != null && s.mileageEnd != null
              ? `${s.mileageEnd - s.mileageStart} km`
              : t("shifts.title")}
          </Cell>
        ))}
      </Section>

      <Modal
        open={open}
        title={t("shifts.addShift")}
        onClose={() => setOpen(false)}
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FormActions onCancel={() => setOpen(false)} onSave={submit} saving={save.isPending} />
            {editId && (
              <Button
                mode="outline"
                stretched
                onClick={() =>
                  confirm(t("common.confirmDelete")) &&
                  del.mutate(editId, { onSuccess: () => setOpen(false) })
                }
              >
                {t("common.delete")}
              </Button>
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

// ---------------------------------------------------------------------------
function BalancesTab() {
  const { t } = useTranslation();
  const balances = useBalances();
  return (
    <Section>
      {balances.isLoading && <Cell before={<Spinner size="s" />}>{t("common.loading")}</Cell>}
      {balances.data?.length === 0 && <Cell>{t("common.empty")}</Cell>}
      {balances.data?.map((b) => (
        <Cell
          key={b.driverId}
          subtitle={`${t("reports.income")}: ${formatMoney(b.rentPaid)} • ${t("dashboard.deposit")}: ${formatMoney(b.depositHeld)}`}
          after={
            <span className={b.balance > 0 ? "amount-pos" : "amount-neg"}>{formatMoney(b.balance)}</span>
          }
        >
          {b.driverName}
        </Cell>
      ))}
    </Section>
  );
}
