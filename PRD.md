# Redrock — PRD v1.0

> Deploy Telegram bots to Vercel in 60 seconds. No VPS, no monthly fees.

---

## 1. Problem Statement

Developer bot Telegram saat ini harus sewa VPS (minimal $5/bulan) atau cloud server hanya untuk menjalankan bot. Untuk bot sederhana (auto-reply, reminder, notifikasi), ini overkill dan mahal. Platform serverless seperti Vercel ideal untuk workload ini — tetapi tidak ada tool yang memudahkan deploy bot Telegram langsung ke Vercel.

---

## 2. Solution

**Redrock** — CLI + Web UI yang memungkinkan siapapun (developer maupun non-developer) membuat dan deploy bot Telegram ke Vercel dalam hitungan detik. Bot hidup di Vercel serverless functions, dengan webhook sebagai default dan polling opsional.

---

## 3. Target Users

| Persona | Need | Pain Point |
|---------|------|------------|
| **Bot Builder Pemula** | Bikin bot Telegram tanpa ngerti server | Takut VPS, bingung deploy, budget minim |
| **Freelance Developer** | Deploy bot klien dengan cepat | Setup server manual tiap project boros waktu |
| **Startup/Tim Kecil** | Bot notifikasi/internal tools gratis | Tidak butuh VPS mahal untuk bot sederhana |
| **Power User** | Bot custom tanpa coding | Ingin template siap pakai, click-to-deploy |

---

## 4. Core Features (v1.0)

### 4.1 One-Click Deploy
- `npx redrock deploy` — single command deploy ke Vercel
- Auto-generate `vercel.json`, `api/webhook.py|ts`, environment variables
- User hanya perlu: Bot Token dari @BotFather + OAuth Vercel
- Output: URL webhook bot langsung aktif

### 4.2 Multi-Framework Support
| Framework | Language | Default |
|-----------|----------|---------|
| python-telegram-bot | Python | ✅ |
| grammY | TypeScript | |
| Telegraf | JavaScript | |
| Pyrogram | Python | |

- Template starter untuk masing-masing framework
- User bisa pilih saat `redrock init`

### 4.3 Webhook vs Polling
- **Default: Webhook** — optimal untuk Vercel serverless
- Webhook auto-register via Telegram API (`setWebhook`)
- Opsi polling via Vercel Cron Jobs (free tier: 1 cron job)
- User bisa switch di `redrock.json`

### 4.4 Database Integration
| Provider | Free Tier | Cocok Untuk |
|----------|-----------|-------------|
| **Vercel KV** (default) | 256MB | State sederhana, cache |
| **Supabase** | 500MB PostgreSQL | Data relasional, query kompleks |
| **Firebase Firestore** | 1GB | Real-time sync, NoSQL |

- `redrock db init` — auto-setup database provider
- Abstraction layer: user tulis `db.get()` / `db.set()` — backend otomatis ke provider yg dipilih
- Migrasi antar provider: `redrock db migrate --to supabase`

### 4.5 Bot Templates Library
- `/start` handler with keyboard
- Broadcast bot (kirim pesan ke semua user)
- Reminder bot (set jadwal, auto-notify)
- Group moderation bot
- File converter bot
- API poller bot (monitor endpoint → notify)

### 4.6 Logs & Monitoring (v1.0 basic)
- **Vercel Logs** — stream real-time dari Vercel dashboard
- **Redrock Dashboard** — lightweight: uptime %, total requests, error rate
- Alert: bot down detection via health check endpoint
- Future: integrate Sentry / Axiom

---

## 5. Architecture

```
┌─────────────────────────────────────────────┐
│                  Redrock CLI                  │
│  redrock init → deploy → logs → db → switch  │
└─────────────────┬───────────────────────────┘
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
┌─────────┐ ┌──────────┐ ┌──────────┐
│ Vercel  │ │ Supabase │ │ Firebase │
│ Server  │ │   (opt)  │ │  (opt)   │
│  less   │ │          │ │          │
└────┬────┘ └──────────┘ └──────────┘
     │
     ▼
┌─────────┐
│Telegram │
│   API   │
└─────────┘
```

### Tech Stack
- **CLI:** Node.js (Commander.js + Inquirer)
- **Web Dashboard:** Next.js + Vercel (optional, v1.5)
- **Bot Runtime:** Python 3.11+ / Node 20+
- **Auth:** Vercel OAuth + Telegram Bot Token
- **Config:** `redrock.json` di repo root

---

## 6. User Flow

### Flow 1: Developer (CLI)

```
$ npx redrock init my-bot
  → Pilih framework: [python-telegram-bot]
  → Bot Token: [masukkan token]
  → Deploy ke Vercel? [Y/n]
  → Logging in to Vercel...
  → Deploying... ✓
  ✅ Bot hidup di: https://my-bot.vercel.app
  ✅ Webhook terdaftar
```

### Flow 2: Non-Developer (Web UI)

```
Buka redrock.dev → Login Vercel → Pilih template → Isi token → Deploy
```

---

## 7. Project Structure

```
redrock/
├── cli/                    # Redrock CLI
│   ├── src/
│   │   ├── commands/
│   │   │   ├── init.ts     # redrock init
│   │   │   ├── deploy.ts   # redrock deploy
│   │   │   ├── logs.ts     # redrock logs
│   │   │   ├── db.ts       # redrock db
│   │   │   └── switch.ts   # redrock switch (polling/webhook)
│   │   ├── templates/      # Bot starter templates
│   │   │   ├── python-telegram-bot/
│   │   │   ├── grammy/
│   │   │   └── telegraf/
│   │   ├── providers/      # Database adapters
│   │   │   ├── vercel-kv.ts
│   │   │   ├── supabase.ts
│   │   │   └── firebase.ts
│   │   └── utils/
│   ├── package.json
│   └── README.md
├── web/                    # Dashboard (v1.5+)
├── docs/                   # Documentation
├── LICENSE
└── README.md
```

---

## 8. Milestones

| Phase | Deliverables | Timeline |
|-------|-------------|----------|
| **v1.0** | CLI: init + deploy (python-telegram-bot only), Vercel KV, webhook, 3 templates | 3-4 minggu |
| **v1.1** | grammY + Telegraf support, polling mode | +2 minggu |
| **v1.2** | Supabase + Firebase integration, db migration | +2 minggu |
| **v1.3** | Logs streaming, health check, uptime alert | +2 minggu |
| **v1.5** | Web Dashboard, GitHub integration, one-click deploy | +3 minggu |
| **v2.0** | Bot marketplace, monetization (tier premium) | +4 minggu |

---

## 9. Key Metrics

- **Time to deploy:** < 60 detik dari init ke live
- **Cold start:** < 3 detik (Vercel serverless)
- **Free tier coverage:** 100% — tidak butuh biaya selain bot token
- **User activation rate:** sign up → bot live dalam 1 session

---

## 10. Competitor Landscape

| Solution | Monthly Cost | Setup Time | Learning Curve |
|----------|-------------|------------|----------------|
| VPS (DigitalOcean) | $6+ | 30-60 min | High |
| Railway | $5+ | 15 min | Medium |
| Fly.io | $1.94+ | 20 min | Medium |
| **Redrock** | **$0** | **60 sec** | **Low** |

---

## 11. Open Questions (Answered)

1. **Traffic target?** Bot kecil (100-1000 req/hari). Vercel free tier cukup.
2. **Multi-token?** Max 2 bot per project. Konfigurasi via `BOT_TOKEN` dan `BOT_TOKEN_2`.
3. **CI/CD?** GitHub Actions auto-deploy ready, tapi user bisa matiin.
4. **Interface?** CLI-first + Web Dashboard. Keduanya dari awal.
