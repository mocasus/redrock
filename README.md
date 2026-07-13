<p align="center">
  <img src="assets/logo.png" alt="Redrock" width="80" />
</p>

<h1 align="center">Redrock</h1>

<p align="center">
  Deploy Telegram bots to Vercel. <strong>No VPS. No fees. 60 seconds.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/npm-redrock-red?style=flat" alt="npm">
  <img src="https://img.shields.io/badge/runs%20on-Vercel-black?style=flat&logo=vercel" alt="Vercel">
  <img src="https://img.shields.io/badge/cost-%240%2Fmonth-green?style=flat" alt="Cost">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat" alt="MIT">
</p>

## Quick Start

```bash
npx redrock init my-bot -t YOUR_BOT_TOKEN
cd my-bot && npx redrock deploy
```

Done. Bot is live. Try `/start`.

**Prerequisites:** Node.js 18+, [@BotFather token](https://t.me/BotFather), [Vercel account](https://vercel.com) (free).

## What It Does

Telegram bots don't need a VPS. Vercel's free serverless tier handles them perfectly — but deploying a webhook-based bot there is manual and annoying.

Redrock automates everything: scaffold → config → deploy → register webhook. One tool, two commands, zero servers to maintain.

## How It Works

```
Your laptop               Vercel                      Telegram
    │                       │                            │
    │  redrock init         │                            │
    ├──────────────────────►│                            │
    │  redrock deploy       │                            │
    │  (generates files,    │                            │
    │   pushes to Vercel)   │                            │
    │                       │  POST /api/webhook (msg)   │
    │                       │◄───────────────────────────│
    │                       │  sendMessage (reply)       │
    │                       ├───────────────────────────►│
```

## Commands

```
redrock init <name>           Create new bot project
redrock deploy                Deploy to Vercel
redrock logs                  Stream Vercel logs
redrock db <init|migrate>     Database setup & migration
redrock switch <webhook|poll> Toggle webhook/polling mode
```

## Project Output

```
my-bot/
├── api/webhook.py     # Bot handler (Python, zero deps)
├── redrock.json       # Your config
├── vercel.json        # Vercel deploy config
└── .env.example
```

## Frameworks

- **python-telegram-bot** (Python stdlib, zero pip install) — available now
- grammY (TypeScript) — coming soon
- Telegraf (JavaScript) — coming soon

## Database (optional)

| Provider | Free Tier | Switch via |
|----------|-----------|------------|
| Vercel KV | 256 MB | default |
| Supabase | 500 MB | `redrock db migrate --to supabase` |
| Firebase | 1 GB | `redrock db migrate --to firebase` |

## Why Not a VPS?

| | VPS $6/mo | Redrock + Vercel |
|---|---|---|
| Cost | $72/year | $0/year |
| Setup | 30 min | 60 sec |
| Maintenance | You | Zero |
| Sleep cost | Always paying | $0 when idle |

## Local Dev

```bash
vercel dev
curl -X POST localhost:3000/api/webhook -H 'Content-Type: application/json' -d '{"message":{"chat":{"id":1},"text":"/start"}}'
```

## License

MIT © [mocasus](https://github.com/mocasus)
