// Workers AI classifier: free on the Workers AI allowance, no extra account. It gives no
// probabilities, so its pick is taken at face value (and "unsure" keeps mail in the inbox).
import { CATEGORY_KEYS, CRITERIA, INSTRUCTIONS, isCategory } from "../categories";
import type { Mail } from "../mail";
import { aiJson, fill } from "../template";
import PROMPT from "../../content/classify.txt";
import { CLASSIFY_BODY, type Verdict } from "./types";

const KEYS = [...CATEGORY_KEYS, "unsure"];
const CRITERIA_LIST = CATEGORY_KEYS.map((k) => `- ${k}: ${CRITERIA[k]}`).join("\n");

export async function classifyWithWorkersAi(ai: Ai, model: string, mail: Mail): Promise<Verdict> {
  const content = fill(PROMPT, {
    ...mail,
    body: mail.body.slice(0, CLASSIFY_BODY),
    instructions: INSTRUCTIONS,
    criteria: CRITERIA_LIST,
  });
  const out = await ai.run(model as keyof AiModels, {
    messages: [{ role: "user", content }],
    response_format: {
      type: "json_schema",
      json_schema: { type: "object", properties: { category: { type: "string", enum: KEYS } }, required: ["category"] },
    },
    max_tokens: 20,
  } as never);
  const category = (aiJson(out) as { category?: unknown } | undefined)?.category;
  if (!isCategory(category)) throw new Error(`workers-ai answer: ${JSON.stringify(out).slice(0, 300)}`);
  return { category, probabilities: { [category]: 1 }, source: "workers-ai" };
}
