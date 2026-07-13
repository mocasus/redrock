# 🪨 Redrock

> Deploy Telegram bots to Vercel in 60 seconds. No VPS, no monthly fees.

[![npm](https://img.shields.io/badge/npm-redrock-red)](https://npmjs.com/package/redrock)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Quick Start

```bash
npx redrock init my-bot -t YOUR_BOT_TOKEN
cd my-bot
npx redrock deploy
```

Your bot is live at `https://my-bot.vercel.app/api/webhook` — try `/start`!

## Features

- 🔥 **60-second deploy** — init to live in under a minute
- 💰 **$0/month** — runs entirely on Vercel free tier
- 🐍 **Multi-framework** — python-telegram-bot, grammY, Telegraf
- 🔄 **Webhook + Polling** — default webhook, polling via Vercel Cron
- 🗄️ **Database choice** — Vercel KV, Supabase, or Firebase
- 📊 **Built-in monitoring** — logs, uptime, health checks
- 🤖 **2 bots max** — run dual bots from one project

## Commands

| Command | Description |
|---------|-------------|
| `redrock init [name]` | Create new bot project |
| `redrock deploy` | Deploy to Vercel |
| `redrock logs` | Stream deployment logs |
| `redrock db init` | Setup database |
| `redrock db migrate` | Switch database provider |
| `redrock switch <mode>` | Toggle webhook/polling |

## Supported Frameworks

- **python-telegram-bot** — Python, mature ecosystem (default)
- **grammY** — TypeScript, modern & type-safe
- **Telegraf** — JavaScript, simple & minimal

## Database Providers

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| Vercel KV | 256 MB | Simple state |
| Supabase | 500 MB | Relational data |
| Firebase | 1 GB | Real-time sync |

## Project Structure

```
my-bot/
├── api/
│   └── webhook.py        # Bot webhook handler
├── redrock.json           # Redrock config
├── vercel.json            # Vercel deploy config
└── .env.example
```

## License

MIT © [mocasus](https://github.com/mocasus)
