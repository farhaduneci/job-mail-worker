import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { eml, fakeAi, fakeMessage, jevAnswer, stubFetch, VARS } from "./helpers";

const INTERVIEW = eml({ subject: "Backend Engineer - next steps", body: "Thanks for applying! Could you pick a slot for a 30 minute call?" });
const REJECTION = eml({ subject: "Your application", body: "We decided to move forward with other candidates." });

async function deliver(raw: string, over: Partial<Env> & { AI: Ai }, failFor: string[] = []) {
  const message = fakeMessage(raw, "jobs+acme@example.com", failFor);
  const ctx = createExecutionContext();
  await worker.email(message, { ...env, ...VARS, ...over } as Env, ctx);
  await waitOnExecutionContext(ctx);
  const row = await env.DB.prepare("SELECT * FROM mail ORDER BY id DESC LIMIT 1").first<Record<string, unknown>>();
  return { message, row };
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM mail");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("email handler", () => {
  it("sends an interview to the attention address, pings Telegram and logs it", async () => {
    const fetch = stubFetch({ telegram: () => Response.json({ ok: true }) });
    const { message, row } = await deliver(INTERVIEW, { AI: fakeAi("interview"), TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1" });

    expect(message.forward).toHaveBeenCalledExactlyOnceWith("me+attention@example.com");
    expect(row).toMatchObject({ category: "interview", slug: "acme", company: "Acme", role: "Backend Engineer", pinged: 1, error: null });
    const body = JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ chat_id: "1" });
    expect(body.text).toContain("Acme");
  });

  it("uses Jev probabilities when a TypeSafe key is set", async () => {
    stubFetch({ jev: () => jevAnswer("rejection", { rejection: 0.97, interview: 0.01 }) });
    const ai = fakeAi("interview");
    const { message, row } = await deliver(REJECTION, { AI: ai, TYPESAFE_API_KEY: "k" });

    expect(message.forward).toHaveBeenCalledExactlyOnceWith("me+rejected@example.com");
    expect(row).toMatchObject({ category: "rejection", confidence: 0.97, pinged: 0 });
    expect(ai.run).not.toHaveBeenCalled();
  });

  it("keeps a doubtful rejection in the inbox", async () => {
    stubFetch({ jev: () => jevAnswer("rejection", { rejection: 0.6, interview: 0.3 }) });
    const { message } = await deliver(REJECTION, { AI: fakeAi("rejection"), TYPESAFE_API_KEY: "k" });
    expect(message.forward).toHaveBeenCalledExactlyOnceWith("me@example.com");
  });

  it("falls back to Workers AI when Jev fails", async () => {
    stubFetch({ jev: () => new Response("quota", { status: 429 }) });
    const { message, row } = await deliver(REJECTION, { AI: fakeAi("rejection"), TYPESAFE_API_KEY: "k" });
    expect(message.forward).toHaveBeenCalledExactlyOnceWith("me+rejected@example.com");
    expect(row?.error).toMatch(/^jev: Error: jev 429/);
  });

  it("delivers to the inbox when classification fails", async () => {
    const { message, row } = await deliver(INTERVIEW, { AI: fakeAi(new Error("AI down")) });
    expect(message.forward).toHaveBeenCalledExactlyOnceWith("me@example.com");
    expect(row).toMatchObject({ category: "unsure", routed_to: "me@example.com" });
    expect(row?.error).toContain("AI down");
  });

  it("retries the inbox when a sorted destination is not verified", async () => {
    stubFetch({});
    const { message, row } = await deliver(INTERVIEW, { AI: fakeAi("interview") }, ["me+attention@example.com"]);
    expect(message.forward.mock.calls).toEqual([["me+attention@example.com"], ["me@example.com"]]);
    expect(row).toMatchObject({ routed_to: "me@example.com", category: "interview" });
    expect(row?.error).toContain("not verified");
  });

  it("rejects mail instead of losing it when misconfigured", async () => {
    const message = fakeMessage(INTERVIEW);
    await worker.email(message, { ...env, ...VARS, FORWARD_TO: "", AI: fakeAi("interview") } as Env, createExecutionContext());
    expect(message.setReject).toHaveBeenCalledOnce();
    expect(message.forward).not.toHaveBeenCalled();
  });
});

describe("weekly digest", () => {
  it("summarises the last week on Telegram", async () => {
    await env.DB.prepare("INSERT INTO mail (at, category, company, slug) VALUES (?, 'interview', 'Acme', 'acme')")
      .bind(new Date().toISOString())
      .run();
    const fetch = stubFetch({ telegram: () => Response.json({ ok: true }) });
    const ctx = createExecutionContext();
    await worker.scheduled({} as ScheduledController, { ...env, ...VARS, TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1" } as Env, ctx);
    await waitOnExecutionContext(ctx);
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string).text).toContain("Acme");
  });
});
