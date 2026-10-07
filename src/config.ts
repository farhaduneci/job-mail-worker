// Turns the raw Worker env into a validated config. Every knob lives in wrangler.jsonc `vars`
// or in secrets; nothing here is specific to one deployment.

export type Box = "inbox" | "attention" | "archive" | "rejected";

export interface Config {
  forward: Record<Box, string>;
  archiveMin: number;
  attentionMax: number;
  aiModel: string;
  jev?: { url: string; model: string; key: string };
  telegram?: { token: string; chatId: string };
}

export class ConfigError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Unset and blank values are the same thing: the Deploy button leaves skipped secrets empty.
const opt = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);

function address(name: string, value: string | undefined, fallback?: string): string {
  const v = opt(value) ?? fallback;
  if (!v || !EMAIL.test(v)) throw new ConfigError(`${name} must be an email address, got "${value ?? ""}"`);
  return v;
}

function ratio(name: string, value: string | undefined, fallback: number): number {
  const v = opt(value) === undefined ? fallback : Number(value);
  if (!Number.isFinite(v) || v < 0 || v > 1) throw new ConfigError(`${name} must be a number from 0 to 1, got "${value}"`);
  return v;
}

export function readConfig(env: Env): Config {
  const inbox = address("FORWARD_TO", env.FORWARD_TO);
  const jevKey = opt(env.TYPESAFE_API_KEY);
  const token = opt(env.TELEGRAM_BOT_TOKEN);
  const chatId = opt(env.TELEGRAM_CHAT_ID);
  return {
    forward: {
      inbox,
      attention: address("FORWARD_ATTENTION", env.FORWARD_ATTENTION, inbox),
      archive: address("FORWARD_ARCHIVE", env.FORWARD_ARCHIVE, inbox),
      rejected: address("FORWARD_REJECTED", env.FORWARD_REJECTED, inbox),
    },
    archiveMin: ratio("ARCHIVE_MIN", env.ARCHIVE_MIN, 0.8),
    attentionMax: ratio("ATTENTION_MAX", env.ATTENTION_MAX, 0.1),
    aiModel: opt(env.AI_MODEL) ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    jev: jevKey ? { url: env.JEV_URL, model: env.JEV_MODEL, key: jevKey } : undefined,
    telegram: token && chatId ? { token, chatId } : undefined,
  };
}
