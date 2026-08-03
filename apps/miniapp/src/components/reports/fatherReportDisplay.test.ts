import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../ui", () => ({
  formatMoney: (amount: number) => `money:${amount}`,
}));

import { SingleTotalBlock } from "./fatherReportDisplay";

describe("SingleTotalBlock", () => {
  it("renders selected Father totals as one amount without split columns", () => {
    const html = renderToStaticMarkup(
      React.createElement(SingleTotalBlock, {
        title: "Income - Max + Oleh",
        amount: 345.67,
      }),
    );

    expect(html).toContain("Income - Max + Oleh");
    expect(html).toContain('class="crm-father-report__single-total"');
    expect(html).toContain("money:345.67");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<th");
    expect(html).not.toContain("Cash");
    expect(html).not.toContain("Bank");
    expect(html).not.toContain("Partner");
  });
});
