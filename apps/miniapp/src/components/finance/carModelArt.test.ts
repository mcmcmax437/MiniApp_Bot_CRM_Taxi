import { describe, expect, it } from "vitest";
import { resolveCarModelArt } from "./carModelArt";

describe("resolveCarModelArt", () => {
  it("matches known models case-insensitively", () => {
    expect(resolveCarModelArt("Toyota", "Prius")?.src).toBeTruthy();
    expect(resolveCarModelArt(null, "COROLLA Hybrid")?.src).toBeTruthy();
    expect(resolveCarModelArt("Toyota", "Auris Touring")?.src).toBeTruthy();
  });

  it("returns null for unknown models", () => {
    expect(resolveCarModelArt("Toyota", "Yaris")).toBeNull();
    expect(resolveCarModelArt(null, null)).toBeNull();
  });
});
