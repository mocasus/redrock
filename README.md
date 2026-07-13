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

You have a Telegram bot idea. Normally you'd need a VPS ($6/mo), nginx, webhooks, SSL — just to echo "hello."

**Redrock makes it one command.** Your bot runs on Vercel's free tier. Scales to zero when idle. Wakes instantly on the next message.

```bash
npm i -g @mocasus/redrock
redrock init my-bot -t YOUR_BOT_TOKEN
cd my-bot && redrock deploy
```

Done. Open Telegram, send `/start`. Bot is live.

---

## Usage

After install, the `redrock` command is available globally:

```bash
$ redrock                    # show welcome banner
$ redrock --help             # list all commands
$ redrock --version          # v0.1.0
```

All commands:

```
redrock init <name>             scaffold a new bot
redrock deploy                  push to Vercel + register webhook
redrock logs --follow           stream live request logs
redrock db init                 setup Vercel KV database
redrock db migrate --to supabase   switch database provider
redrock switch webhook|polling  change update mode
```

---

## Quick Start

**Prerequisites:** Node.js 18+, [@BotFather](https://t.me/BotFather) token, [Vercel](https://vercel.com) account.

```bash
# 1. Install globally
npm i -g @mocasus/redrock

# 2. Create a bot
redrock init my-bot -t YOUR_BOT_TOKEN

# 3. Deploy
cd my-bot
vercel login          # first time only
redrock deploy
```

That's it. Send `/start` to your bot on Telegram.

---

## Features

| | |
|---|---|
| ⚡ **60-second deploy** | scaffold → deploy → webhook. One flow. |
| 🆓 **100% free** | Vercel free tier: 100GB bandwidth, 500K exec/month |
| 🐍 **Python stdlib** | Zero pip deps. Generated bot just works. |
| 🔗 **Webhook default** | Auto-registers with Telegram API. |
| 🗄️ **Built-in database** | Vercel KV, Supabase, Firebase. `redrock db init`. |
| 📋 **Live logs** | `redrock logs --follow` streams in real-time. |
| 🔀 **Mode switch** | Toggle webhook ↔ polling anytime. |

---

## Project Structure

```
my-bot/
├── api/
│   └── webhook.py       ← your bot logic (Python, zero deps)
├── redrock.json         ← project config
├── vercel.json          ← Vercel deploy settings
└── .env.example
```

---

## Database

```bash
redrock db init
```

Provisions Vercel KV, injects env vars, generates `api/db.py`:

```python
from api.db import db

db.set("visits", 0)
count = db.incr("visits")   # → 1
users = db.get("user:123")  # auto-deserializes JSON
```

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| **Vercel KV** | 256 MB | Key-value, counters |
| **Supabase** | 500 MB PostgreSQL | Relational data |
| **Firebase** | 1 GB | Real-time sync |

---

## VPS vs Redrock

| | VPS | Redrock |
|---|---|---|
| **Price** | $6+/mo | **$0** |
| **Setup** | 30-60 min | **60 sec** |
| **Maintenance** | OS, nginx, certs | **None** |
| **Scaling** | Manual | **Auto (Vercel)** |
| **Idle cost** | Paying | **$0** |

---

## Documentation

- [Setup Guide](docs/README.md) — full walkthrough
- [▶️ Demo video](docs/demo.mp4) — 24s showcase

---

## License

MIT

---

<p align="center">
  <sub>
    v0.1.0 ·
    <a href="https://github.com/mocasus/redrock">GitHub</a> ·
    <a href="https://www.npmjs.com/package/@mocasus/redrock">npm</a> ·
    MIT
  </sub>
</p>
