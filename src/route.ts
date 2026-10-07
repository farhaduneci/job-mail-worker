import { ARCHIVE, ATTENTION } from "./categories";
import type { Verdict } from "./classify";
import type { Box, Config } from "./config";

/**
 * Where an email goes. Attention mail gets its own address so a mail filter can star it and pin it
 * to the primary tab. Rejections, confirmations and noise leave the inbox only when the classifier
 * is sure (archiveMin) and gives the attention categories almost nothing together (attentionMax):
 * a wrong archive hides an interview, a wrong inbox costs a glance.
 */
export function route(config: Config, verdict: Pick<Verdict, "category" | "probabilities">): Box {
  const { category, probabilities: p } = verdict;
  if (ATTENTION.has(category)) return "attention";
  const box = ARCHIVE[category];
  if (!box) return "inbox";
  const attention = [...ATTENTION].reduce((sum, c) => sum + (p[c] ?? 0), 0);
  const sure = (p[category] ?? 0) >= config.archiveMin && attention <= config.attentionMax;
  return sure ? box : "inbox";
}
