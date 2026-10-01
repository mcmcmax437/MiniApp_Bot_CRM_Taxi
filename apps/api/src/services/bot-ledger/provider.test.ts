import { describe, expect, it } from "vitest";
import { resolveLedgerTarget } from "./provider.js";

describe("resolveLedgerTarget", () => {
  it("uses DeepSeek when that key is set", () => {
    expect(resolveLedgerTarget({ deepseekApiKey: " sk-d ", openaiApiKey: "sk-o" })).toMatchObject({
      provider: "deepseek",
      key: "sk-d",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      disableThinking: true,
    });
  });

  it("uses Grok when that is the only key", () => {
    expect(resolveLedgerTarget({ xaiApiKey: "xai" })).toMatchObject({
      provider: "grok",
      key: "xai",
      baseUrl: "https://api.x.ai/v1",
      model: "grok-4-fast-non-reasoning",
    });
  });

  it("lets LEDGER_PROVIDER override which key is used", () => {
    expect(
      resolveLedgerTarget({
        ledgerProvider: "grok",
        deepseekApiKey: "d",
        xaiApiKey: "x",
        ledgerModel: "grok-4.5",
      }),
    ).toMatchObject({ provider: "grok", key: "x", model: "grok-4.5" });
  });
});
