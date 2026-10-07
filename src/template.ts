/** Replaces {name} placeholders; unknown names become empty. */
export const fill = (template: string, vars: Record<string, unknown>): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));

export const pick = <T>(list: readonly T[], random = Math.random): T => list[Math.floor(random() * list.length)];

/** Workers AI returns structured output either parsed or as a JSON string, depending on the model. */
export function aiJson(out: unknown): unknown {
  const o = out as { response?: unknown; choices?: { message?: { content?: unknown } }[] };
  const raw = o?.response ?? o?.choices?.[0]?.message?.content;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}
