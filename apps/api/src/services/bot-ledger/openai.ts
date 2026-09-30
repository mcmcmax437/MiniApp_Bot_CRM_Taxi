import { env } from "../../env.js";
import { LEDGER_SYSTEM_PROMPT, extractJsonObject, interpretLedgerJson, type LedgerIntent } from "./intent.js";

export async function askLedgerModel(text: string): Promise<LedgerIntent> {
  const key = env.openaiApiKey.trim();
  if (!key) {
    const err = new Error("not_configured");
    err.name = "LedgerNotConfigured";
    throw err;
  }

  const base = env.openaiBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: LEDGER_SYSTEM_PROMPT },
        { role: "user", content: text.slice(0, 500) },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`openai_${response.status}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("openai_empty");
  return interpretLedgerJson(extractJsonObject(content));
}
