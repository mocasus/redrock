<p align="center">
  <img src="assets/logo.png" width="120" />
</p>

<p align="center">
  <h1>Redrock</h1>
  <strong>Deploy Telegram bots to Vercel.<br>No VPS. No fees. One command.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@mocasus/redrock?color=C83C28&style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square" />
  <img src="https://img.shields.io/badge/platform-Vercel-black?style=flat-square" />
</p>

<p align="center">
  <img src="docs/demo.gif" width="800" />
</p>

---

## What is Redrock?

You have a Telegram bot idea. Normally you'd need a VPS ($6/mo), configure nginx, set up webhooks, manage SSL certs, and keep a server running 24/7 just to echo "hello."

**Redrock makes it one command.** Your bot runs on Vercel's free tier — scales to zero when nobody's chatting, wakes up instantly on the next message. Zero cost, zero maintenance.

```bash
npm i -g @mocasus/redrock
redrock init my-bot -t YOUR_BOT_TOKEN
cd my-bot && redrock deploy
```

Done. Open Telegram, send `/start`. Your bot is live.

---

## Features

- **⚡ 60-second deploy** — scaffold → deploy → webhook registered. One flow.
- **🆓 100% free** — Vercel free tier: 100GB bandwidth, 500K function executions/month
- **🐍 Python stdlib** — generated bot uses zero pip dependencies. Just works.
- **🔗 Webhook default** — optimal for serverless. Auto-registers with Telegram API.
- **🗄️ Built-in database** — Vercel KV, Supabase, or Firebase. One command setup.
- **📋 Live logs** — `redrock logs --follow` streams requests in real-time.
- **🔀 Mode switch** — toggle between webhook and polling anytime.

---

## Quick Start

### Prerequisites
- Node.js 18+
- [BotFather token](https://t.me/BotFather)
- [Vercel account](https://vercel.com)

### Install

```bash
npm i -g @mocasus/redrock
```

### Create & Deploy

```bash
# Scaffold a new bot
redrock init my-bot -t YOUR_BOT_TOKEN

# Deploy to Vercel
cd my-bot
vercel login        # first time only
redrock deploy
```

That's it. Open Telegram and send `/start` to your bot.

---

## Project Structure

After `redrock init`, you get:

```
my-bot/
├── api/
│   └── webhook.py       ← your bot logic (Python, zero deps)
├── redrock.json         ← project config
├── vercel.json          ← Vercel deploy settings
└── .env.example
```

The webhook handler receives Telegram updates, Vercel runs it on the edge, and you never touch a server.

---

## Commands

```
redrock init <name>             scaffold a new bot
redrock deploy                  push to Vercel + register webhook
redrock logs --follow           stream live request logs
redrock logs --json --status-code 500   filter errors
redrock db init                 setup Vercel KV database
redrock db migrate --to supabase   switch database provider
redrock switch webhook|polling  change update mode
```

---

## Database

Add persistence to your bot with one command:

```bash
redrock db init
```

This provisions a Vercel KV store, injects environment variables, and generates `api/db.py`:

```python
from api.db import db

db.set("visits", 0)
count = db.incr("visits")   # → 1
users = db.get("user:123")  # auto-deserializes JSON
```

Three backends supported:

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| **Vercel KV** (default) | 256 MB | Key-value, counters, cache |
| **Supabase** | 500 MB PostgreSQL | Relational data, complex queries |
| **Firebase Firestore** | 1 GB | Real-time sync, NoSQL |

---

## VPS vs Redrock

| | VPS | Redrock |
|---|---|---|
| **Price** | $6+/month | $0 |
| **Setup** | 30-60 min | 60 seconds |
| **Maintenance** | You handle OS, nginx, certs, updates | None |
| **Scaling** | Manual | Auto (Vercel edge) |
| **Idle cost** | Paying anyway | Scales to zero |

---

## Framework Support

| Framework | Language | Status |
|-----------|----------|--------|
| **python-telegram-bot** | Python | ✅ Default |
| grammY | TypeScript | Coming soon |
| Telegraf | JavaScript | Coming soon |

---

## Documentation

- [Setup Guide](docs/README.md) — full walkthrough
- [▶️ Full demo video](docs/demo.mp4) — 24-second showcase

---

## License

MIT

---

<p align="center">
  <sub>v0.1.0 · <a href="https://github.com/mocasus/redrock">GitHub</a> · <a href="https://www.npmjs.com/package/@mocasus/redrock">npm</a> · MIT</sub>
</p>
