// Jev, TypeSafe's judgment model (https://typesafe.ai): answers a choice question with a probability
// per option, which is what lets the router archive only when it is sure.
import { CRITERIA, INSTRUCTIONS, isCategory } from "../categories";
import type { Config } from "../config";
import type { Mail } from "../mail";
import { CLASSIFY_BODY, type Verdict } from "./types";

interface JevAnswer {
  choice?: string;
  probabilities?: Record<string, number>;
}

export async function classifyWithJev(jev: NonNullable<Config["jev"]>, mail: Mail): Promise<Verdict> {
  const res = await fetch(jev.url, {
    method: "POST",
    headers: { authorization: `Bearer ${jev.key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: jev.model,
      state: { from: mail.from, subject: mail.subject, body: mail.body.slice(0, CLASSIFY_BODY) },
      questions: { category: { type: "choice", instructions: INSTRUCTIONS, criteria: CRITERIA } },
    }),
  });
  if (!res.ok) throw new Error(`jev ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const answer = ((await res.json()) as { answers?: { category?: JevAnswer } }).answers?.category;
  if (!isCategory(answer?.choice) || answer.choice === "unsure") {
    throw new Error(`jev answer: ${JSON.stringify(answer).slice(0, 300)}`);
  }
  return { category: answer.choice, probabilities: answer.probabilities ?? { [answer.choice]: 1 }, source: "jev" };
}
