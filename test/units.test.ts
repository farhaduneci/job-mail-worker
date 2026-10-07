import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "../src/config";
import { digestVars } from "../src/digest";
import { parseMail, tagOf } from "../src/mail";
import { route } from "../src/route";
import { fill, pick } from "../src/template";
import { config, eml, VARS } from "./helpers";

describe("config", () => {
  it("falls back to FORWARD_TO for empty optional destinations", () => {
    const c = config({ FORWARD_ATTENTION: "", FORWARD_ARCHIVE: " ", FORWARD_REJECTED: "" });
    expect(c.forward).toEqual({ inbox: "me@example.com", attention: "me@example.com", archive: "me@example.com", rejected: "me@example.com" });
  });

  it("turns optional integrations on only when their secrets are set", () => {
    expect(config().jev).toBeUndefined();
    expect(config().telegram).toBeUndefined();
    expect(config({ TYPESAFE_API_KEY: "k" }).jev).toEqual({ url: VARS.JEV_URL, model: VARS.JEV_MODEL, key: "k" });
    expect(config({ TELEGRAM_BOT_TOKEN: "t" }).telegram).toBeUndefined();
    expect(config({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1" }).telegram).toEqual({ token: "t", chatId: "1" });
  });

  it("rejects a missing inbox and out-of-range thresholds", () => {
    expect(() => readConfig({ ...VARS, FORWARD_TO: "" } as Env)).toThrow(ConfigError);
    expect(() => config({ FORWARD_ARCHIVE: "not-an-address" })).toThrow(/FORWARD_ARCHIVE/);
    expect(() => config({ ARCHIVE_MIN: "1.5" })).toThrow(/ARCHIVE_MIN/);
  });
});

describe("route", () => {
  const c = config();

  it("sends every attention category to the attention box", () => {
    for (const category of ["offer", "interview", "assessment", "action"] as const) {
      expect(route(c, { category, probabilities: { [category]: 0.4 } })).toBe("attention");
    }
  });

  it("archives only confident rejections, confirmations and noise", () => {
    expect(route(c, { category: "rejection", probabilities: { rejection: 0.95, interview: 0.02 } })).toBe("rejected");
    expect(route(c, { category: "confirmation", probabilities: { confirmation: 0.9 } })).toBe("archive");
    expect(route(c, { category: "noise", probabilities: { noise: 0.85 } })).toBe("archive");
    expect(route(c, { category: "rejection", probabilities: { rejection: 0.7 } })).toBe("inbox");
    expect(route(c, { category: "rejection", probabilities: { rejection: 0.85, interview: 0.08, action: 0.05 } })).toBe("inbox");
  });

  it("keeps verification codes and unsure mail in the inbox", () => {
    expect(route(c, { category: "verification", probabilities: { verification: 1 } })).toBe("inbox");
    expect(route(c, { category: "unsure", probabilities: { unsure: 1 } })).toBe("inbox");
  });
});

describe("mail", () => {
  it("reads the +tag of an address", () => {
    expect(tagOf("jobs+acme-corp@example.com")).toBe("acme-corp");
    expect(tagOf("jobs@example.com")).toBe("");
  });

  it("parses plain text and drops quoted replies", async () => {
    const mail = await parseMail(eml({ subject: "Next steps", body: "Hi,\n> old quote\nlet's  talk." }), "x@y.z");
    expect(mail).toEqual({ from: "jane@acme.com", subject: "Next steps", body: "Hi, let's talk." });
  });

  it("strips html when there is no text part", async () => {
    const mail = await parseMail(eml({ subject: "s", body: "<style>p{}</style><p>Hello&nbsp;<b>there</b></p>", html: true }), "x@y.z");
    expect(mail.body).toBe("Hello there");
  });
});

describe("template", () => {
  it("fills known placeholders and blanks unknown ones", () => {
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and ");
  });

  it("picks from a list", () => {
    expect(pick(["x", "y"], () => 0.99)).toBe("y");
  });
});

describe("digest", () => {
  it("counts categories and names the good ones once", () => {
    const vars = digestVars([
      { category: "interview", company: "Acme", slug: "acme" },
      { category: "assessment", company: "", slug: "bolt" },
      { category: "interview", company: "Acme", slug: "acme" },
      { category: "rejection", company: "Initech", slug: "initech" },
    ]);
    expect(vars).toMatchObject({ total: 4, companies: 3, interviews: 2, assessments: 1, rejections: 1, good: "Acme, bolt" });
  });
});
