<p align="center">
  <img src="assets/logo.png" alt="Redrock" width="120" />
</p>

<h1 align="center">Redrock 🪨⚡</h1>

<p align="center">
  <strong>Deploy Telegram bots to Vercel in 60 seconds. No VPS. No monthly fees. Just code.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/redrock"><img src="https://img.shields.io/badge/npm-redrock-red?style=flat-square" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT"></a>
  <a href="https://vercel.com"><img src="https://img.shields.io/badge/runs%20on-Vercel-black?style=flat-square&logo=vercel" alt="Vercel"></a>
  <a href="#"><img src="https://img.shields.io/badge/cost-%240%2Fmonth-brightgreen?style=flat-square" alt="Cost"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-success?style=flat-square" alt="Node">
  <img src="https://img.shields.io/badge/python-3.9%2B-blue?style=flat-square" alt="Python">
</p>

---

## 🎯 The Goal

**Stop renting VPS just to keep a Telegram bot alive.**

A simple `/start`, `/help`, or notification bot doesn't need a $5/month server running 24/7. Vercel's serverless platform handles this perfectly — but nobody made it easy to deploy a Telegram bot there. Until now.

**Redrock bridges that gap.** One command scaffolds your bot. One command deploys it. Zero server maintenance. Zero monthly bills.

---

## 🪨 What is Redrock?

Redrock is a **CLI tool** that turns Vercel into your Telegram bot's home. It:

1. **Generates a complete bot project** — webhook handler, Vercel config, database setup
2. **Deploys to Vercel** — your bot lives on Vercel's global edge network
3. **Manages webhooks** — auto-registers with Telegram API so messages reach your bot
4. **Handles databases** — pick Vercel KV, Supabase, or Firebase for persistent storage

You bring a **Bot Token** from [@BotFather](https://t.me/BotFather). Redrock does the rest.

---

## ⚡ Quick Start

```bash
# 1. Create your bot project
npx redrock init my-bot -t YOUR_BOT_TOKEN

# 2. Deploy to Vercel
cd my-bot
npx redrock deploy

# 3. Try your bot!
# Open Telegram → search your bot → /start
```

**That's it.** Your bot is live at `https://my-bot.vercel.app/api/webhook`.

### Prerequisites

| Requirement | How to Get |
|-------------|------------|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) |
| **Bot Token** | Talk to [@BotFather](https://t.me/BotFather) on Telegram (free) |
| **Vercel Account** | Sign up at [vercel.com](https://vercel.com) (free tier) |
| **Vercel CLI** | `npm i -g vercel` (auto-installed by Redrock if missing) |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                      You                                │
│   $ npx redrock init → $ npx redrock deploy            │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│                     Redrock CLI                         │
│   Scaffold project · Generate config · Register webhook │
└───────────────────────┬────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  Vercel  │  │ Supabase │  │ Firebase │
   │ Server-  │  │   (opt)  │  │  (opt)   │
   │  less    │  │          │  │          │
   └────┬─────┘  └──────────┘  └──────────┘
        │
        ▼
   ┌──────────┐
   │ Telegram │
   │   API    │  ← Webhook
   └────┬─────┘
        │
        ▼
   ┌──────────┐
   │  Users   │
   │  /start  │
   └──────────┘
```

**How it works:**  
1. Telegram sends incoming messages to your Vercel webhook URL  
2. Vercel's serverless function handles the request (Python/Node.js)  
3. Your bot logic runs, sends response back via Telegram API  
4. Vercel scales to zero when idle — no cost  

---

## 🔧 Commands

| Command | What it does |
|---------|-------------|
| `redrock init <name>` | Scaffold a new bot project with all config files |
| `redrock deploy` | Deploy to Vercel, auto-register webhook with Telegram |
| `redrock logs` | Stream deployment logs from Vercel |
| `redrock db init` | Initialize Vercel KV database (default) |
| `redrock db migrate --to <provider>` | Switch database to Supabase or Firebase |
| `redrock switch webhook` | Use webhook mode (best for Vercel) |
| `redrock switch polling` | Use polling mode via Vercel Cron Jobs |

### Init Options

```bash
npx redrock init my-bot \
  -t "123456:ABC-DEF" \    # Bot token from @BotFather
  -f python-telegram-bot    # Framework (python-telegram-bot | grammy | telegraf)
```

---

## 🐍 Supported Frameworks

| Framework | Language | Status |
|-----------|----------|--------|
| **python-telegram-bot** | Python (stdlib, zero deps) | ✅ v0.1.0 |
| **grammY** | TypeScript | 🔜 v0.1.1 |
| **Telegraf** | JavaScript | 🔜 v0.1.1 |

> Redrock's Python template uses **pure stdlib** — no pip install required. Just works on Vercel.

---

## 🗄️ Database Providers

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| **Vercel KV** | 256 MB | Sessions, cache, simple key-value |
| **Supabase** | 500 MB PostgreSQL | Relational data, complex queries |
| **Firebase** | 1 GB Firestore | Real-time sync, NoSQL |

```bash
# Switch database anytime
redrock db migrate --to supabase
redrock deploy  # apply changes
```

---

## 📦 Project Structure

After `redrock init my-bot`:

```
my-bot/
├── api/
│   └── webhook.py        # 🎯 Your bot webhook handler
├── redrock.json           # ⚙️  Redrock project config
├── vercel.json            # ▲  Vercel deployment config
├── .env.example           # 🔑 Environment variable template
└── requirements.txt       # 📦 Python deps (if any)
```

---

## 🧪 Local Development

```bash
# Start local dev server
vercel dev

# Test webhook locally
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"chat":{"id":123},"text":"/start"}}'
```

---

## 🚦 Webhook vs Polling

| | Webhook (default) | Polling |
|---|---|---|
| **How** | Telegram pushes updates to your URL | Bot checks for updates periodically |
| **Vercel** | ✅ Optimized for serverless | Vercel Cron Jobs (free: 1 job) |
| **Latency** | Instant | Up to poll interval |
| **Cost** | $0 | $0 |
| **Best for** | 99% of bots | Restricted environments |

```bash
# Switch modes anytime
redrock switch polling
redrock deploy
```

---

## 🔮 Roadmap

| Version | Features |
|---------|----------|
| **v0.1.1** | grammY + Telegraf templates, Vercel OAuth |
| **v0.1.2** | Supabase + Firebase integration, db migration tool |
| **v0.1.3** | Logs dashboard, health check monitoring, uptime alerts |
| **v0.2.0** | Web Dashboard, GitHub integration, one-click deploy button |
| **v1.0.0** | Bot template marketplace, premium tier, analytics |

---

## 📊 Why Vercel?

| | VPS (DigitalOcean) | Railway | **Redrock + Vercel** |
|---|---|---|---|
| **Monthly cost** | $6+ | $5+ | **$0** |
| **Setup time** | 30–60 min | 15 min | **< 60 sec** |
| **Scaling** | Manual | Auto | **Auto (global edge)** |
| **Maintenance** | You | Minimal | **Zero** |
| **Cold start** | N/A | ~500ms | **< 2s** |
| **Sleep mode** | Never (always paying) | On free tier | **Scales to zero (no cost)** |

---

## 💡 Use Cases

- 📝 **Auto-reply bot** — `/start`, `/help`, FAQ, welcome messages
- 📢 **Broadcast bot** — send messages to all subscribers
- ⏰ **Reminder bot** — set recurring reminders via Vercel Cron
- 📊 **Status bot** — poll API/endpoint, notify on change
- 🛒 **Shop bot** — simple product catalog + order handling
- 👥 **Group bot** — moderation, welcome, anti-spam

---

## 🤝 Contributing

```bash
git clone https://github.com/mocasus/redrock.git
cd redrock
npm install
npm link  # test locally
```

PRs welcome. See [PRD.md](PRD.md) for the full product spec.

---

## 📝 License

MIT © [mocasus](https://github.com/mocasus)

---

<p align="center">
  <sub>Built with 🪨 + ⚡ + ☕</sub>
</p>
