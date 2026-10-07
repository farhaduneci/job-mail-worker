// The D1 log (migrations/): one row per email, read by the weekly digest and by anything
// downstream (a tracker sync, a dashboard).

export interface MailRow {
  at: string;
  to_addr: string;
  slug: string;
  from_addr: string;
  subject: string;
  category: string;
  confidence: number | null;
  probs: string | null;
  company: string;
  role: string;
  summary: string;
  routed_to: string;
  pinged: 0 | 1;
  error: string | null;
}

export async function insertRow(db: D1Database, row: MailRow): Promise<void> {
  const cols = Object.keys(row) as (keyof MailRow)[];
  await db
    .prepare(`INSERT INTO mail (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`)
    .bind(...cols.map((c) => row[c]))
    .run();
}

export async function rowsSince(db: D1Database, since: Date): Promise<Pick<MailRow, "category" | "company" | "slug">[]> {
  const { results } = await db
    .prepare("SELECT category, company, slug FROM mail WHERE at >= ?")
    .bind(since.toISOString())
    .all<Pick<MailRow, "category" | "company" | "slug">>();
  return results;
}
