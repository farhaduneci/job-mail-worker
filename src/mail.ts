import PostalMime from "postal-mime";

export interface Mail {
  from: string;
  subject: string;
  /** Plain text, quoted replies dropped, whitespace collapsed. */
  body: string;
}

/** The +tag of an address: "jobs+acme@example.com" -> "acme". */
export const tagOf = (address: string): string => address.match(/^[^+@]+\+([^@]+)@/)?.[1] ?? "";

const htmlToText = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const squeeze = (text: string) => text.replace(/^>.*$/gm, "").replace(/\s+/g, " ").trim();

export async function parseMail(raw: ReadableStream | ArrayBuffer | string, envelopeFrom: string): Promise<Mail> {
  const parsed = await PostalMime.parse(raw);
  return {
    from: parsed.from?.address ?? envelopeFrom,
    subject: parsed.subject ?? "",
    body: squeeze(parsed.text || htmlToText(parsed.html || "")),
  };
}
