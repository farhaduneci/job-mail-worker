import { vi } from "vitest";
import { readConfig } from "../src/config";

/** A minimal RFC 822 message. */
export const eml = (o: { from?: string; to?: string; subject: string; body: string; html?: boolean }) =>
  [
    `From: Jane Doe <${o.from ?? "jane@acme.com"}>`,
    `To: ${o.to ?? "jobs+acme@example.com"}`,
    `Subject: ${o.subject}`,
    "Message-ID: <1@test>",
    `Content-Type: text/${o.html ? "html" : "plain"}; charset=utf-8`,
    "",
    o.body,
  ].join("\r\n");

export const VARS = {
  FORWARD_TO: "me@example.com",
  FORWARD_ATTENTION: "me+attention@example.com",
  FORWARD_ARCHIVE: "me+ack@example.com",
  FORWARD_REJECTED: "me+rejected@example.com",
  ARCHIVE_MIN: "0.8",
  ATTENTION_MAX: "0.1",
  AI_MODEL: "test-model",
  JEV_URL: "https://jev.test/v1",
  JEV_MODEL: "jev-test",
};

export const config = (over: Partial<Env> = {}) => readConfig({ ...VARS, ...over } as Env);

/** A Workers AI stub: answers the classify prompt with `category`, the summarize prompt with `details`. */
export function fakeAi(category: string | Error, details = { company: "Acme", role: "Backend Engineer", summary: "They want a call" }) {
  const run = vi.fn(async (_model: string, input: { max_tokens: number }) => {
    if (input.max_tokens === 20) {
      if (category instanceof Error) throw category;
      return { response: { category } };
    }
    return { response: JSON.stringify(details) };
  });
  return { run } as unknown as Ai & { run: typeof run };
}

/** An inbound email as the runtime hands it to the email handler. */
export function fakeMessage(raw: string, to = "jobs+acme@example.com", failFor: string[] = []) {
  const forward = vi.fn(async (address: string) => {
    if (failFor.includes(address)) throw new Error("destination address not verified");
  });
  return {
    from: "bounce@acme.com",
    to,
    raw: new Response(raw).body!,
    rawSize: raw.length,
    headers: new Headers(),
    forward,
    setReject: vi.fn(),
    reply: vi.fn(),
  } as unknown as ForwardableEmailMessage & { forward: typeof forward; setReject: ReturnType<typeof vi.fn> };
}

/** Routes fetch calls by host: Jev and Telegram. */
export function stubFetch(handlers: { jev?: () => Response; telegram?: () => Response }) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(VARS.JEV_URL) && handlers.jev) return handlers.jev();
    if (url.startsWith("https://api.telegram.org/") && handlers.telegram) return handlers.telegram();
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

export const jevAnswer = (choice: string, probabilities: Record<string, number>) =>
  Response.json({ answers: { category: { choice, probabilities } } });
