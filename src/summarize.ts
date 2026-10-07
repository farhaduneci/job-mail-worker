// Company, role and a one-line summary for the Telegram ping. Only attention mail pays for this call.
import type { Mail } from "./mail";
import { aiJson, fill } from "./template";
import PROMPT from "../content/summarize.txt";

export interface Details {
  company: string;
  role: string;
  summary: string;
}

const BODY = 3000;
const SCHEMA = {
  type: "object",
  properties: { company: { type: "string" }, role: { type: "string" }, summary: { type: "string" } },
  required: ["company", "role", "summary"],
};

export async function summarize(ai: Ai, model: string, mail: Mail, category: string): Promise<Details> {
  const out = await ai.run(model as keyof AiModels, {
    messages: [{ role: "user", content: fill(PROMPT, { ...mail, category, body: mail.body.slice(0, BODY) }) }],
    response_format: { type: "json_schema", json_schema: SCHEMA },
    max_tokens: 200,
  } as never);
  const d = aiJson(out) as Partial<Details> | undefined;
  return { company: d?.company ?? "", role: d?.role ?? "", summary: d?.summary ?? "" };
}
