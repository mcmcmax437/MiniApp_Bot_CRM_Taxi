import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

let Field: typeof import("./ui").Field;

beforeAll(async () => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
  Field = (await import("./ui")).Field;
});

describe("Field", () => {
  it("does not wrap controls in a label that can steal mobile option taps", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Field,
        { label: "Driver" },
        React.createElement("input", { name: "driver", defaultValue: "Alex" }),
      ),
    );

    expect(html).toContain('<div class="form-stack">');
    expect(html).toContain('<span class="crm-field-label">Driver</span>');
    expect(html).not.toContain("<label");
  });
});
