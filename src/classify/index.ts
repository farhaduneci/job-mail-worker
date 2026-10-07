import type { Config } from "../config";
import type { Mail } from "../mail";
import { classifyWithJev } from "./jev";
import type { Verdict } from "./types";
import { classifyWithWorkersAi } from "./workers-ai";

export type { Verdict } from "./types";

/**
 * Jev when a TypeSafe key is set, Workers AI otherwise or when Jev fails (quota, outage), so mail
 * still gets sorted. A Jev failure is returned as `warning` for the log.
 */
export async function classify(config: Config, ai: Ai, mail: Mail): Promise<Verdict & { warning?: string }> {
  if (config.jev) {
    try {
      return await classifyWithJev(config.jev, mail);
    } catch (e) {
      const verdict = await classifyWithWorkersAi(ai, config.aiModel, mail);
      return { ...verdict, warning: `jev: ${String(e).slice(0, 200)}` };
    }
  }
  return classifyWithWorkersAi(ai, config.aiModel, mail);
}
