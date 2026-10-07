# job-mail-worker

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/farhaduneci/job-mail-worker)
[![CI](https://github.com/farhaduneci/job-mail-worker/actions/workflows/ci.yml/badge.svg)](https://github.com/farhaduneci/job-mail-worker/actions/workflows/ci.yml)

A Cloudflare Email Worker that sorts job-application mail before it reaches the mailbox. Sending
hundreds of applications buries the few emails that matter (an interview invite, a take-home, a
recruiter question) under auto-replies and rejections. This worker reads each email, decides what
it is, and forwards it to one of four addresses, so mail filters can file each kind on its own:

| Category | Forwarded to | Telegram ping |
|---|---|---|
| offer, interview, assessment, action (needs a reply) | `FORWARD_ATTENTION` | yes, with a one-line summary |
| verification codes, anything unclear | `FORWARD_TO` | no |
| confirmation ("we received your application"), job-board noise | `FORWARD_ARCHIVE` | no |
| rejection | `FORWARD_REJECTED` | no |

Every email is logged to a D1 database, and a weekly Telegram digest counts the week's
confirmations, rejections, interviews and offers.

## How it decides

- **Classification.** Workers AI (Llama 3.3 70B by default) picks one of the categories in
  [`content/categories.json`](content/categories.json). With a [TypeSafe](https://typesafe.ai) key
  set, its Jev model does it instead and returns a probability per category; Workers AI then stays
  as the fallback when Jev is down or out of quota.
- **Archiving is conservative.** Mail leaves the inbox only when the classifier gives the category
  at least `ARCHIVE_MIN` (0.8) and the four attention categories together at most `ATTENTION_MAX`
  (0.1). A wrong archive hides an interview; a wrong inbox costs a glance.
- **Failures land in the inbox.** A classifier error, a parsing error or an unverified destination
  all fall back to `FORWARD_TO`, and the reason is logged.
- **Only attention mail costs a second model call**, to extract company, role and summary for the
  ping. Rejections and confirmations cost one call.

## Setup

Requirements: a domain on Cloudflare with [Email Routing](https://developers.cloudflare.com/email-routing/)
enabled, and a mailbox to forward to. Gmail is used below; any provider with plus-addressing and
filters works the same way.

### 1. Deploy

Click **Deploy to Cloudflare** above. It forks the repo, creates the D1 database, and asks for the
variables below. Or from a clone:

```bash
npm install
npx wrangler login
# edit "vars" in wrangler.jsonc, then:
npm run deploy
```

| Variable | Default | Meaning |
|---|---|---|
| `FORWARD_TO` | (required) | Main mailbox, e.g. `name@gmail.com` |
| `FORWARD_ATTENTION` | `FORWARD_TO` | e.g. `name+jobs-attention@gmail.com` |
| `FORWARD_ARCHIVE` | `FORWARD_TO` | e.g. `name+jobs-ack@gmail.com` |
| `FORWARD_REJECTED` | `FORWARD_TO` | e.g. `name+jobs-rejected@gmail.com` |
| `ARCHIVE_MIN` | `0.8` | Classifier probability needed to archive |
| `ATTENTION_MAX` | `0.1` | Most the attention categories may share when archiving |
| `AI_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Workers AI model |

Optional secrets (`npx wrangler secret put <NAME>`, or the Deploy form; see
[`.dev.vars.example`](.dev.vars.example)):

| Secret | Turns on |
|---|---|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Pings and the weekly digest. Create a bot with [@BotFather](https://t.me/BotFather), message it once, then read `chat.id` from `https://api.telegram.org/bot<token>/getUpdates`. |
| `TYPESAFE_API_KEY` | The Jev classifier |

### 2. Verify the destinations

Cloudflare only forwards to verified addresses. In the dashboard, **Email Routing → Destination
addresses**, add each `FORWARD_*` address and click the link Cloudflare mails to it. Or:

```bash
npx wrangler email routing addresses create name+jobs-attention@gmail.com
```

An unverified address is not fatal: mail meant for it goes to `FORWARD_TO` until it is verified.

### 3. Route mail to the worker

In **Email Routing → Routing rules**, add a custom address (e.g. `jobs@your-domain.com`) with the
action **Send to a Worker** → `job-mail-worker`. With subaddressing on (**Email Routing →
Settings**), every `jobs+<anything>@your-domain.com` reaches the worker too.

Then apply with `jobs+<company>@your-domain.com`. The `+company` tag is logged as `slug` on every
row, so replies tie back to the application even when the sender's name says nothing.

### 4. Mail filters

The worker only picks the address; the mailbox does the filing. In Gmail, create one filter per
address (**Settings → Filters → Create a new filter**, put the address in **To**, which also
matches `deliveredto:`):

| To | Actions |
|---|---|
| `name+jobs-attention@gmail.com` | Apply label `Jobs/Attention`, Star it, Always mark as important, Categorize as **Primary**, Never send to Spam |
| `name+jobs-ack@gmail.com` | Skip the Inbox, Apply label `Jobs/Auto`, Never send to Spam |
| `name+jobs-rejected@gmail.com` | Skip the Inbox, Apply label `Jobs/Rejected`, Never send to Spam |

### 5. Test

Send an email to `jobs+selftest@your-domain.com`, then:

```bash
npx wrangler tail
npx wrangler d1 execute job-mail --remote --command "SELECT at, category, confidence, routed_to, error FROM mail ORDER BY id DESC LIMIT 10"
```

`wrangler dev` cannot test the email handler against real mail, so test on the deployed worker.

## Customizing

All text lives in [`content/`](content/), not in the code:

- `categories.json`: what each category means. Descriptions are free to edit; the keys are fixed.
- `classify.txt`, `summarize.txt`: Workers AI prompts.
- `messages.json`: Telegram messages. Several variants per kind; one is picked at random.

## Development

```bash
npm install
npm test          # vitest in the Workers runtime (@cloudflare/vitest-plugin), AI and fetch stubbed
npm run typecheck
```

```
src/
  index.ts            email + scheduled handlers: parse, classify, route, forward, log, ping
  config.ts           env -> validated Config
  categories.ts       category keys, attention and archive sets
  mail.ts             MIME parsing (postal-mime), text cleanup, +tag
  classify/           Jev and Workers AI classifiers, fallback chain
  route.ts            category + probabilities -> destination
  summarize.ts        company / role / summary for pings
  telegram.ts         Telegram messages
  log.ts, digest.ts   D1 log, weekly digest
content/              prompts, categories, messages
migrations/           D1 schema
```

## Cost

Workers, D1 and Email Routing fit in Cloudflare's free tier for one person's job search. Workers AI
has a free daily allowance; one call per email, two for attention mail. TypeSafe is billed by
TypeSafe.

## License

MIT
