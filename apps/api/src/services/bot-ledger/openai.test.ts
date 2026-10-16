import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  ledgerProvider: "",
  ledgerModel: "",
  deepseekApiKey: "",
  xaiApiKey: "",
  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiModel: "gpt-4o-mini",
}));

vi.mock("../../env.js", () => ({
  env: mockEnv,
}));

import { askLedgerModel } from "./openai.js";

function resetEnv() {
  Object.assign(mockEnv, {
    ledgerProvider: "",
    ledgerModel: "",
    deepseekApiKey: "",
    xaiApiKey: "",
    openaiApiKey: "",
    openaiBaseUrl: "https://api.openai.com/v1",
    openaiModel: "gpt-4o-mini",
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  resetEnv();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("askLedgerModel", () => {
  it("posts DeepSeek requests with thinking disabled and a truncated user message", async () => {
    mockEnv.deepseekApiKey = "deepseek-key";
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        choices: [
          {
            message: {
              content:
                '{"kind":"expense","amount":450,"carQuery":"5132","expenseCategory":"repair","note":"Fuel"}',
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const longText = "x".repeat(550);
    await expect(askLedgerModel(longText)).resolves.toMatchObject({
      kind: "expense",
      amount: 450,
      carQuery: "5132",
      category: "REPAIR",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(init?.headers).toMatchObject({
      authorization: "Bearer deepseek-key",
      "content-type": "application/json",
    });

    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({
      model: "deepseek-flash",
      temperature: 0,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    });
    expect(payload.messages.at(-1)).toEqual({ role: "user", content: longText.slice(0, 500) });
  });

  it("posts Grok requests without DeepSeek thinking controls", async () => {
    mockEnv.ledgerProvider = "grok";
    mockEnv.ledgerModel = "grok-ledger";
    mockEnv.xaiApiKey = "xai-key";
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        choices: [{ message: { content: '{"kind":"income","amount":550,"carQuery":"5132"}' } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(askLedgerModel("+550 5132")).resolves.toMatchObject({
      kind: "income",
      amount: 550,
      carQuery: "5132",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
    const payload = JSON.parse(String(init?.body));
    expect(payload.model).toBe("grok-ledger");
    expect(payload).not.toHaveProperty("thinking");
  });

  it("fails before calling fetch when the selected provider has no key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(askLedgerModel("fuel 450")).rejects.toMatchObject({
      name: "LedgerNotConfigured",
      message: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks quota and balance API responses as no-credit failures", async () => {
    mockEnv.ledgerProvider = "openai";
    mockEnv.openaiApiKey = "openai-key";
    const fetchMock = vi.fn(async () =>
      jsonResponse(429, {
        error: { code: "rate_limit_exceeded", message: "Insufficient quota" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(askLedgerModel("fuel 450")).rejects.toMatchObject({
      name: "LedgerNoCredits",
      message: "openai_429",
    });
  });
});
