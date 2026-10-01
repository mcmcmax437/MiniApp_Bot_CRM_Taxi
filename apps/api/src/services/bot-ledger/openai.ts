import { env } from "../../env.js";
import { LEDGER_SYSTEM_PROMPT, extractJsonObject, interpretLedgerJson, type LedgerIntent } from "./intent.js";
import { resolveLedgerTarget } from "./provider.js";

export async function askLedgerModel(text: string): Promise<LedgerIntent> {
  const target = resolveLedgerTarget(env);
  if (!target.key) {
    const err = new Error("not_configured");
    err.name = "LedgerNotConfigured";
    throw err;
  }

  const response = await fetch(`${target.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${target.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: target.model,
      temperature: 0,
      response_format: { type: "json_object" },
      ...(target.disableThinking ? { thinking: { type: "disabled" } } : {}),
      messages: [
        { role: "system", content: LEDGER_SYSTEM_PROMPT },
        { role: "user", content: text.slice(0, 500) },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const err = new Error(`${target.provider}_${response.status}`);
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    const detail = `${body?.error?.code ?? ""} ${body?.error?.message ?? ""}`;
    if (response.status === 402 || /insufficient|credit|quota|balance/i.test(detail)) {
      err.name = "LedgerNoCredits";
    }
    throw err;
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  const message = body.choices?.[0]?.message;
  const content = message?.content?.trim() || message?.reasoning_content?.trim();
  if (!content) throw new Error(`${target.provider}_empty`);
  return interpretLedgerJson(extractJsonObject(content));
}
