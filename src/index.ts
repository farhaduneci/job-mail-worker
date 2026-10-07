// Sorts job-application mail before it reaches the mailbox. Each email is classified, forwarded to
// one of four addresses (inbox, attention, archive, rejected), logged to D1, and, when it needs a
// human, announced on Telegram. Any failure falls back to the inbox: a mistake costs clutter,
// never a lost interview.
import { ATTENTION, type Category } from "./categories";
import { classify } from "./classify";
import { type Config, ConfigError, readConfig } from "./config";
import { sendDigest } from "./digest";
import { insertRow, type MailRow } from "./log";
import { type Mail, parseMail, tagOf } from "./mail";
import { route } from "./route";
import { summarize } from "./summarize";
import { type MessageKind, notify } from "./telegram";

const append = (error: string | null, more: string) => (error ? `${error}; ${more}` : more);

async function sort(config: Config, env: Env, message: ForwardableEmailMessage, row: MailRow): Promise<Mail | null> {
  try {
    const mail = await parseMail(message.raw, message.from);
    row.subject = mail.subject;
    const verdict = await classify(config, env.AI, mail);
    if (verdict.warning) row.error = verdict.warning;
    row.category = verdict.category;
    row.confidence = verdict.probabilities[verdict.category] ?? null;
    row.probs = JSON.stringify(verdict.probabilities);
    row.routed_to = config.forward[route(config, verdict)];
    return mail;
  } catch (e) {
    row.error = append(row.error, String((e as Error)?.stack ?? e).slice(0, 1000));
    return null;
  }
}

async function forward(config: Config, message: ForwardableEmailMessage, row: MailRow): Promise<void> {
  try {
    await message.forward(row.routed_to);
  } catch (e) {
    // Usually an unverified destination address. The inbox is always verified.
    if (row.routed_to === config.forward.inbox) throw e;
    row.error = append(row.error, `forward(${row.routed_to}): ${e}`);
    row.routed_to = config.forward.inbox;
    await message.forward(config.forward.inbox);
  }
}

async function announce(config: Config, env: Env, mail: Mail, row: MailRow): Promise<void> {
  try {
    Object.assign(row, await summarize(env.AI, config.aiModel, mail, row.category));
  } catch (e) {
    row.error = append(row.error, `summarize: ${e}`);
  }
  const s = (row.summary || row.subject).trim();
  const vars = {
    company: row.company || row.slug || "a company",
    role: row.role || "a role",
    summary: /[.!?]$/.test(s) ? s : `${s}.`,
    subject: row.subject,
  };
  row.pinged = (await notify(config, row.category as MessageKind, vars).catch(() => false)) ? 1 : 0;
}

export default {
  async email(message, env, ctx) {
    let config: Config;
    try {
      config = readConfig(env);
    } catch (e) {
      if (!(e instanceof ConfigError)) throw e;
      console.error(`job-mail-worker is misconfigured: ${e.message}`);
      message.setReject("Mailbox misconfigured, try again later");
      return;
    }

    const row: MailRow = {
      at: new Date().toISOString(),
      to_addr: message.to,
      slug: tagOf(message.to),
      from_addr: message.from,
      subject: "",
      category: "unsure",
      confidence: null,
      probs: null,
      company: "",
      role: "",
      summary: "",
      routed_to: config.forward.inbox,
      pinged: 0,
      error: null,
    };

    const mail = await sort(config, env, message, row);
    await forward(config, message, row);

    ctx.waitUntil(
      (async () => {
        if (mail && ATTENTION.has(row.category as Category)) await announce(config, env, mail, row);
        await insertRow(env.DB, row);
      })().catch((e) => console.error("job-mail-worker: logging failed", e, row)),
    );
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendDigest(readConfig(env), env.DB));
  },
} satisfies ExportedHandler<Env>;
