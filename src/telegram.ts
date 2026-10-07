import type { Config } from "./config";
import { fill, pick } from "./template";
import MESSAGES from "../content/messages.json";

export type MessageKind = Exclude<keyof typeof MESSAGES, "$comment">;

/** Sends one random variant of a message from content/messages.json. False when Telegram is off or fails. */
export async function notify(config: Config, kind: MessageKind, vars: Record<string, unknown>): Promise<boolean> {
  if (!config.telegram) return false;
  const res = await fetch(`https://api.telegram.org/bot${config.telegram.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegram.chatId, text: fill(pick(MESSAGES[kind]), vars) }),
  });
  return res.ok;
}
