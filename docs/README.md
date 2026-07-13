# Redrock Docs

## Setup Guide

### Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org)
- **Telegram Bot Token** — Get one from [@BotFather](https://t.me/BotFather)
- **Vercel Account** — [Sign up free](https://vercel.com)

### 1. Install Redrock

```bash
npm i -g @mocasus/redrock
```

### 2. Create Your Bot

```bash
redrock init my-bot -t YOUR_BOT_TOKEN
cd my-bot
```

This scaffolds:
```
my-bot/
├── api/webhook.py    ← Your bot logic
├── redrock.json      ← Project config
├── vercel.json       ← Vercel settings
└── .env.example
```

### 3. Deploy

```bash
# First time: login to Vercel
vercel login

# Set your Vercel token
export VERCEL_TOKEN=your_vercel_token

# Deploy
redrock deploy
```

Your bot is live! Open Telegram and send `/start`.

### 4. Switch Mode

```bash
# Webhook (default, best for Vercel)
redrock switch webhook

# Polling (uses Vercel Cron Jobs)
redrock switch polling
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `redrock init <name> -t <token>` | Create new bot project |
| `redrock deploy` | Deploy to Vercel + register webhook |
| `redrock logs` | Stream Vercel logs |
| `redrock db init` | Setup database (Vercel KV default) |
| `redrock db migrate --to <provider>` | Switch database provider |
| `redrock switch <mode>` | Toggle webhook / polling |

## Frameworks

| Framework | Language | Status |
|-----------|----------|--------|
| python-telegram-bot | Python | ✅ Default |
| grammY | TypeScript | Coming soon |
| Telegraf | JavaScript | Coming soon |

## Database Providers

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| Vercel KV | 256 MB | Simple state, cache |
| Supabase | 500 MB PostgreSQL | Relational data |
| Firebase Firestore | 1 GB | Real-time sync |

## FAQ

**Q: Is it really free?**
Yes. Vercel free tier includes 100 GB bandwidth, 500K function executions/month. More than enough for small-to-medium bots.

**Q: What happens when my bot has no traffic?**
Vercel scales to zero — no cost, no cold-start fees. Next message wakes it instantly.

**Q: Can I use other Python libraries?**
Yes. Add them to `requirements.txt` and Vercel installs them on deploy.

**Q: How do I add a database?**
```bash
redrock db init              # Setup Vercel KV
redrock db migrate --to supabase  # Switch to Supabase
```
