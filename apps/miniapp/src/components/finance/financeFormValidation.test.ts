import { describe, expect, it } from "vitest";
import {
  clearAssignErrorsForPatch,
  collectAssignFormErrors,
  collectEditFormErrors,
  type AssignFormField,
  type EditFormField,
} from "./financeFormValidation";

function assignFields(errors: Set<AssignFormField>): AssignFormField[] {
  return [...errors].sort();
}

function editFields(errors: Set<EditFormField>): EditFormField[] {
  return [...errors].sort();
}

describe("collectAssignFormErrors", () => {
  it("requires a driver, car, rent amount, and start date before creating an assignment", () => {
    const errors = collectAssignFormErrors({
      useTemporaryDriver: false,
      driverId: "",
      temporaryDriverName: "",
      carId: "",
      rentAmount: "",
      startDate: "   ",
    });

    expect(assignFields(errors)).toEqual(["car", "driver", "rentAmount", "startDate"]);
  });

  it("accepts a named temporary driver and a zero rent amount", () => {
    const errors = collectAssignFormErrors({
      useTemporaryDriver: true,
      driverId: "",
      temporaryDriverName: "  Ada Driver  ",
      carId: "car-1",
      rentAmount: 0,
      startDate: "2026-08-25",
    });

    expect(assignFields(errors)).toEqual([]);
  });
});

describe("clearAssignErrorsForPatch", () => {
  it("clears only the error group changed by an incremental form patch", () => {
    const current = new Set<AssignFormField>(["driver", "car", "rentAmount", "startDate"]);

    expect(assignFields(clearAssignErrorsForPatch(current, { temporaryDriverName: "Ada" }))).toEqual([
      "car",
      "rentAmount",
      "startDate",
    ]);
    expect(assignFields(clearAssignErrorsForPatch(current, { rentAmount: 0 }))).toEqual([
      "car",
      "driver",
      "startDate",
    ]);
  });
});

describe("collectEditFormErrors", () => {
  it("requires a selected registered driver when temporary driver mode is off", () => {
    const errors = collectEditFormErrors({
      useTemporaryDriver: false,
      driverId: "",
      temporaryDriverName: "Ignored Temp",
      rentAmount: 100,
      startDate: "2026-08-25",
    });

    expect(editFields(errors)).toEqual(["driver"]);
  });

  it("accepts temporary drivers with trimmed names and zero rent edits", () => {
    const errors = collectEditFormErrors({
      useTemporaryDriver: true,
      driverId: "",
      temporaryDriverName: "  Ada Driver  ",
      rentAmount: 0,
      startDate: "2026-08-25",
    });

    expect(editFields(errors)).toEqual([]);
  });
});
