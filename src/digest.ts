// Weekly Telegram digest of the last 7 days of the log.
import type { Config } from "./config";
import { rowsSince } from "./log";
import { notify } from "./telegram";

const WEEK_MS = 7 * 24 * 3600 * 1000;

export function digestVars(rows: Awaited<ReturnType<typeof rowsSince>>) {
  const count = (category: string) => rows.filter((r) => r.category === category).length;
  const names = (category: string) =>
    [...new Set(rows.filter((r) => r.category === category).map((r) => r.company || r.slug).filter(Boolean))];
  const good = ["offer", "interview", "assessment"].flatMap(names);
  return {
    total: rows.length,
    companies: new Set(rows.map((r) => r.slug || r.company)).size,
    confirmations: count("confirmation"),
    rejections: count("rejection"),
    interviews: count("interview"),
    assessments: count("assessment"),
    offers: count("offer"),
    actions: count("action"),
    good: good.length ? [...new Set(good)].join(", ") : "none yet",
  };
}

export async function sendDigest(config: Config, db: D1Database, now = new Date()): Promise<boolean> {
  const rows = await rowsSince(db, new Date(now.getTime() - WEEK_MS));
  return notify(config, rows.length ? "weekly" : "weekly_quiet", digestVars(rows));
}
