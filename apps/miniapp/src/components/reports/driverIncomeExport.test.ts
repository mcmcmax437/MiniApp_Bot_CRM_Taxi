import { describe, expect, it } from "vitest";
import type { DriverIncomeReport } from "@taxi/shared";
import {
  amountForChannel,
  buildDriverIncomeCsv,
  buildAccountantEmailText,
} from "./driverIncomeExport";

const sample: DriverIncomeReport = {
  from: "2026-07-01",
  to: "2026-07-31",
  months: [
    {
      month: "2026-07",
      drivers: [
        {
          driverId: "1",
          driverName: "Ivan Dekol",
          pesel: "94041815090",
          passportNumber: null,
          address: "Wrocław, Kumasa 43B",
          cash: 3800,
          bank: 0,
          total: 3800,
        },
        {
          driverId: "2",
          driverName: "Dmytro Dehtiar",
          pesel: "90010112345",
          passportNumber: null,
          address: "Warszawa",
          cash: 0,
          bank: 2850,
          total: 2850,
        },
      ],
      totals: { cash: 3800, bank: 2850, total: 6650 },
    },
  ],
  grandTotals: { cash: 3800, bank: 2850, total: 6650 },
};

const csvLabels = {
  month: "Month",
  driver: "Driver",
  pesel: "PESEL",
  passport: "Passport",
  address: "Address",
  cash: "Cash",
  bank: "Bank",
  total: "Total",
  monthTotal: "Month total",
  grandTotal: "Grand total",
  unassignedDriver: "Unassigned",
  driverLabel: (name: string) => name,
  monthLabel: () => "July 2026",
};

describe("amountForChannel", () => {
  it("picks cash, bank, or total", () => {
    const row = sample.months[0]!.drivers[0]!;
    expect(amountForChannel(row, "cash")).toBe(3800);
    expect(amountForChannel(row, "bank")).toBe(0);
    expect(amountForChannel(row, "both")).toBe(3800);
  });
});

describe("buildDriverIncomeCsv", () => {
  it("includes all money columns for the default channel", () => {
    const csv = buildDriverIncomeCsv(sample, csvLabels);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe("Month;Driver;PESEL;Passport;Address;Cash;Bank;Total");
    expect(lines).toContain(
      "July 2026;Ivan Dekol;94041815090;;Wrocław, Kumasa 43B;3800.00;0.00;3800.00",
    );
    expect(lines).toContain("July 2026;Month total;;;;3800.00;2850.00;6650.00");
    expect(lines.at(-1)).toBe("Grand total;;;;;3800.00;2850.00;6650.00");
  });

  it("limits cash exports to the cash column", () => {
    const csv = buildDriverIncomeCsv(sample, csvLabels, "cash");
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe("Month;Driver;PESEL;Passport;Address;Cash");
    expect(lines[0]).not.toContain("Bank");
    expect(lines[0]).not.toContain("Total");
    expect(lines).toContain(
      "July 2026;Ivan Dekol;94041815090;;Wrocław, Kumasa 43B;3800.00",
    );
    expect(lines).toContain("July 2026;Dmytro Dehtiar;90010112345;;Warszawa;0.00");
    expect(lines).toContain("July 2026;Month total;;;;3800.00");
    expect(lines.at(-1)).toBe("Grand total;;;;;3800.00");
  });

  it("limits bank exports to the bank column", () => {
    const csv = buildDriverIncomeCsv(sample, csvLabels, "bank");
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe("Month;Driver;PESEL;Passport;Address;Bank");
    expect(lines[0]).not.toContain("Cash");
    expect(lines[0]).not.toContain("Total");
    expect(lines).toContain(
      "July 2026;Ivan Dekol;94041815090;;Wrocław, Kumasa 43B;0.00",
    );
    expect(lines).toContain("July 2026;Dmytro Dehtiar;90010112345;;Warszawa;2850.00");
    expect(lines).toContain("July 2026;Month total;;;;2850.00");
    expect(lines.at(-1)).toBe("Grand total;;;;;2850.00");
  });
});

describe("buildAccountantEmailText", () => {
  it("builds Ukrainian email with driver lines for cash channel", () => {
    const text = buildAccountantEmailText(sample, {
      channel: "cash",
      monthLabel: () => "липень 2026 р.",
      driverLabel: (name) => name,
      formatAmount: (n) => `${n} zł`,
      template: {
        greeting: "Доброго дня,",
        intro: "Надсилаю дані для закриття місяця {{month}}.",
        driversHeading: "Дані водіїв:",
        thanks: "Дякую,",
        signature: "Максим Терешкович",
      },
    });

    expect(text).toContain("Доброго дня,");
    expect(text).toContain("липень 2026 р.");
    expect(text).toContain("---- Ivan Dekol 94041815090 Wrocław, Kumasa 43B ---- = 3800 zł");
    expect(text).not.toContain("Dmytro Dehtiar"); // bank-only, skipped for cash
    expect(text).toContain("Максим Терешкович");
  });

  it("includes bank-only drivers when channel is bank", () => {
    const text = buildAccountantEmailText(sample, {
      channel: "bank",
      monthLabel: () => "липень 2026 р.",
      driverLabel: (name) => name,
      formatAmount: (n) => `${n} zł`,
      template: {
        greeting: "Доброго дня,",
        intro: "Надсилаю дані для закриття місяця {{month}}.",
        driversHeading: "Дані водіїв:",
        thanks: "Дякую,",
        signature: "Максим Терешкович",
      },
    });
    expect(text).toContain("Dmytro Dehtiar");
    expect(text).not.toContain("Ivan Dekol");
  });

  it("uses a dash when no drivers match the selected channel", () => {
    const noBankReport: DriverIncomeReport = {
      ...sample,
      months: [
        {
          ...sample.months[0]!,
          drivers: sample.months[0]!.drivers.map((driver) => ({
            ...driver,
            bank: 0,
            total: driver.cash,
          })),
          totals: { cash: 3800, bank: 0, total: 3800 },
        },
      ],
      grandTotals: { cash: 3800, bank: 0, total: 3800 },
    };

    const text = buildAccountantEmailText(noBankReport, {
      channel: "bank",
      monthLabel: () => "липень 2026 р.",
      driverLabel: (name) => name,
      formatAmount: (n) => `${n} zł`,
      template: {
        greeting: "Доброго дня,",
        intro: "Надсилаю дані для закриття місяця {{month}}.",
        driversHeading: "Дані водіїв:",
        thanks: "Дякую,",
        signature: "Максим Терешкович",
      },
    });

    expect(text).toContain("Дані водіїв:\n—\n\nДякую,");
    expect(text).not.toContain("Ivan Dekol");
    expect(text).not.toContain("Dmytro Dehtiar");
  });
});
