import { describe, expect, it } from "vitest";
import { carIdAfterDriverChange } from "./driverCarSuggestions";

describe("carIdAfterDriverChange", () => {
  it("keeps the selected car when the driver is cleared", () => {
    expect(carIdAfterDriverChange("car-1", "", "car-2")).toBe("car-1");
    expect(carIdAfterDriverChange("car-1", "", null)).toBe("car-1");
  });

  it("uses the suggested car when a driver is chosen", () => {
    expect(carIdAfterDriverChange("car-1", "driver-1", "car-2")).toBe("car-2");
    expect(carIdAfterDriverChange("", "driver-1", null)).toBe("");
  });
});
