// Secrets are not in wrangler.jsonc, so `wrangler types` cannot see them. All optional.
interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TYPESAFE_API_KEY?: string;
}

declare module "*.txt" {
  const text: string;
  export default text;
}
