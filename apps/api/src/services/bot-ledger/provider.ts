export type LedgerProviderName = "deepseek" | "grok" | "openai";

export type LedgerTarget = {
  provider: LedgerProviderName;
  key: string;
  baseUrl: string;
  model: string;
  /** DeepSeek thinks by default. This bot only needs the JSON answer. */
  disableThinking: boolean;
};

type LedgerEnv = {
  ledgerProvider?: string;
  ledgerModel?: string;
  deepseekApiKey?: string;
  xaiApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
};

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

/**
 * DeepSeek is the default. A Grok or OpenAI key is used when that is the only
 * key set, or when LEDGER_PROVIDER names it.
 */
export function resolveLedgerTarget(source: LedgerEnv): LedgerTarget {
  const deepseek = clean(source.deepseekApiKey);
  const grok = clean(source.xaiApiKey);
  const openai = clean(source.openaiApiKey);
  const named = clean(source.ledgerProvider).toLowerCase();
  const modelOverride = clean(source.ledgerModel);

  const provider: LedgerProviderName =
    named === "grok" || named === "xai" || named === "openai" || named === "deepseek"
      ? named === "xai"
        ? "grok"
        : named
      : deepseek
        ? "deepseek"
        : grok
          ? "grok"
          : openai
            ? "openai"
            : "deepseek";

  if (provider === "grok") {
    return {
      provider,
      key: grok,
      baseUrl: "https://api.x.ai/v1",
      model: modelOverride || "grok-4-fast-non-reasoning",
      disableThinking: false,
    };
  }
  if (provider === "openai") {
    return {
      provider,
      key: openai,
      baseUrl: (clean(source.openaiBaseUrl) || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: modelOverride || clean(source.openaiModel) || "gpt-4o-mini",
      disableThinking: false,
    };
  }
  return {
    provider: "deepseek",
    key: deepseek,
    baseUrl: "https://api.deepseek.com",
    model: modelOverride || "deepseek-flash",
    disableThinking: true,
  };
}
