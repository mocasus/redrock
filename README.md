<p align="center">
  <img src="assets/logo.png" width="100" /><br>
  <h1>Redrock</h1>
  <strong>Deploy Telegram bots to Vercel.<br>No VPS. No fees. One command.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-red?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square" />
</p>

---

## Install

```bash
npm i -g redrock
```

[▶️ **Tonton demo**](docs/demo.mp4) — 60 detik dari init ke live

---

## Why

A simple Telegram bot shouldn't need a $6/month server running 24/7. Vercel's serverless platform handles this for free — but setting up webhooks, configuring serverless functions, and registering with Telegram is tedious.

**Redrock makes it one command.**

---

## Quick Start

```bash
npx redrock init my-bot -t YOUR_BOT_TOKEN
cd my-bot && npx redrock deploy
```

That's it. Your bot is live. Open Telegram and send `/start`.

**You need:** Node.js 18+, a [BotFather token](https://t.me/BotFather), and a free [Vercel account](https://vercel.com).

---

## What you get

After `redrock init`, your project looks like this:

```
my-bot/
├── api/webhook.py     ← your bot lives here (Python, zero dependencies)
├── redrock.json       ← project config
├── vercel.json        ← Vercel deploy settings
└── .env.example
```

The webhook handler handles messages, Vercel runs it on the edge, and Telegram delivers updates instantly. When nobody is chatting, it scales to zero — no cost.

---

## Commands

```
redrock init <name>           scaffold a new bot
redrock deploy                push to Vercel, register webhook
redrock logs                  stream live logs
redrock db init               setup Vercel KV database
redrock db migrate --to X     switch to Supabase or Firebase
redrock switch <webhook|poll> change update mode
```

---

## Frameworks

Redrock generates a **Python** bot by default (pure stdlib, no pip install). TypeScript and JavaScript templates are on the way.

---

## Database (optional)

Need to store user data or state? Redrock supports three backends:

- **Vercel KV** (default) — 256 MB, simple key-value
- **Supabase** — 500 MB PostgreSQL, free tier
- **Firebase** — 1 GB Firestore, real-time

---

## VPS vs Redrock

| | VPS | Redrock |
|---|---|---|
| Price | $6+/month | $0 |
| Setup | 30+ minutes | 60 seconds |
| Maintenance | You handle it | None |
| Downtime cost | Paying anyway | Free when idle |

---

## License

MIT

---

<p align="center">
  <sub>v0.1.0 · <a href="https://github.com/mocasus/redrock">GitHub</a> · MIT</sub>
</p>
