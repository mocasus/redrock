# Redrock — API Poller Bot Template
# ----------------------------------------------------------------
# Bot that monitors a configurable URL and notifies when status changes.
#
# Features:
#   - /monitor <url> <interval_minutes> — Start monitoring a URL
#   - /status — Show current monitoring status
#   - /stop — Stop all monitoring
#
# ⚠️  Vercel serverless limitation:
#   There is no long-running process. Status checks happen on each webhook
#   call. For reliable periodic checks, set up a Vercel Cron Job:
#
#   Add this to vercel.json:
#     "crons": [{ "path": "/api/webhook", "schedule": "*/5 * * * *" }]
#
#   The bot also tracks the last check time and won't re-check within
#   the configured interval.
#
# Customization:
#   - Edit DEFAULT_INTERVAL for the default polling interval
#   - Add custom headers/auth for the monitored URL
#   - Add regex/pattern matching on response body
#   - Extend to monitor multiple URLs per user
#
# ENV vars:
#   BOT_TOKEN          — from @BotFather (required)
#   MONITOR_USER_AGENT — custom User-Agent for monitored requests (optional)

from http.server import BaseHTTPRequestHandler
import json, os, sys, time
import urllib.request
import urllib.error

BOT_TOKEN = os.environ.get("BOT_TOKEN", "YOUR_BOT_TOKEN")
MONITOR_UA = os.environ.get("MONITOR_USER_AGENT", "Redrock-API-Monitor/1.0")

# ⚠️ In-memory storage — resets on Vercel cold starts.
# For production, use Vercel KV or another DB to persist monitor state.
monitors = {}  # {chat_id: {"url": str, "interval_min": int, "last_status": int|None, "last_check": float}}


def send_message(chat_id, text, reply_markup=None):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data,
        headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"[redrock] send_message failed: {e}", file=sys.stderr)


def check_url(url):
    """Check a URL and return (status_code, error_message)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": MONITOR_UA})
        resp = urllib.request.urlopen(req, timeout=10)
        return resp.getcode(), None
    except urllib.request.HTTPError as e:
        return e.code, f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return None, f"Connection error: {e.reason}"
    except Exception as e:
        return None, f"Error: {e}"


def check_all_monitors():
    """Check all monitored URLs and notify on status changes."""
    for chat_id in list(monitors.keys()):
        m = monitors[chat_id]
        now = time.time()

        # Respect the interval — don't check too often
        if m["last_check"] and (now - m["last_check"]) < (m["interval_min"] * 60):
            continue

        status, error = check_url(m["url"])
        m["last_check"] = now

        prev_status = m.get("last_status")
        current_status = status if status else error

        if prev_status is not None and str(prev_status) != str(current_status):
            # Status changed!
            if status and 200 <= status < 300:
                emoji = "✅"
                detail = f"Status: <b>{status}</b>"
            elif status:
                emoji = "⚠️"
                detail = f"Status: <b>{status}</b>"
            else:
                emoji = "🔴"
                detail = f"Error: <b>{error}</b>"

            send_message(chat_id,
                f"{emoji} <b>Status Changed!</b>\n"
                f"URL: {m['url']}\n"
                f"Previous: <i>{prev_status}</i>\n"
                f"Current: {detail}\n"
                f"<i>Checked at {time.strftime('%H:%M:%S')}</i>"
            )
        elif prev_status is None:
            # First check — just record, notify user
            if status:
                emoji = "✅" if 200 <= status < 300 else "⚠️"
                detail = f"Status: <b>{status}</b>"
            else:
                emoji = "🔴"
                detail = f"Error: <b>{error}</b>"

            send_message(chat_id,
                f"{emoji} <b>Initial check complete</b>\n"
                f"URL: {m['url']}\n"
                f"{detail}\n"
                f"<i>I'll notify you if this changes.</i>"
            )

        m["last_status"] = status if status else error


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Check monitors on every incoming request
        check_all_monitors()

        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length))

        if "message" in body:
            msg = body["message"]
            chat_id = msg["chat"]["id"]
            text = msg.get("text", "")

            # --- /start ---
            if text == "/start":
                send_message(chat_id,
                    "🔍 <b>API Poller Bot</b>\n\n"
                    "I monitor URLs and notify you when their status changes.\n\n"
                    "<b>Commands:</b>\n"
                    "  /monitor &lt;url&gt; &lt;interval_minutes&gt;\n"
                    "    Example: /monitor https://example.com/api/health 5\n\n"
                    "  /status — Show current monitoring status\n"
                    "  /stop — Stop all monitoring\n"
                    "  /help — This message\n\n"
                    "<i>Status checks happen when the bot receives messages.\n"
                    "For reliable periodic checks, set up a Vercel Cron Job.</i>"
                )

            # --- /help ---
            elif text == "/help":
                send_message(chat_id,
                    "🔍 <b>API Poller Bot — Help</b>\n\n"
                    "<b>Start monitoring:</b>\n"
                    "  /monitor &lt;url&gt; &lt;interval_minutes&gt;\n"
                    "  Example: /monitor https://api.example.com/health 5\n\n"
                    "<b>View status:</b>\n"
                    "  /status\n\n"
                    "<b>Stop monitoring:</b>\n"
                    "  /stop\n\n"
                    "<b>How it works:</b>\n"
                    "• Each incoming message triggers a check (if interval has passed)\n"
                    "• You get notified when status code changes\n"
                    "• For reliable scheduled checks, add a Vercel Cron Job:\n"
                    '  <code>"crons": [{"path": "/api/webhook", "schedule": "*/5 * * * *"}]</code>\n\n'
                    "<b>Supported checks:</b>\n"
                    "• HTTP status codes (200, 404, 500, etc.)\n"
                    "• Connection errors (timeout, DNS failure)\n"
                    "• Custom User-Agent via MONITOR_USER_AGENT env var"
                )

            # --- /monitor <url> [interval_minutes] ---
            elif text.startswith("/monitor"):
                parts = text[len("/monitor"):].strip().split()
                if not parts:
                    send_message(chat_id,
                        "Usage: /monitor &lt;url&gt; [interval_minutes]\n"
                        "Example: /monitor https://example.com/api/health 5"
                    )
                    self._finish()
                    return

                url = parts[0]
                if not url.startswith("http://") and not url.startswith("https://"):
                    url = "https://" + url

                interval = 5  # default 5 minutes
                if len(parts) > 1:
                    try:
                        interval = int(parts[1])
                    except ValueError:
                        send_message(chat_id, "❌ Invalid interval. Use a number (minutes).")
                        self._finish()
                        return

                if interval < 1:
                    interval = 1

                monitors[chat_id] = {
                    "url": url,
                    "interval_min": interval,
                    "last_status": None,
                    "last_check": None
                }

                send_message(chat_id,
                    f"🔍 <b>Monitoring started!</b>\n"
                    f"URL: <code>{url}</code>\n"
                    f"Interval: every {interval} min\n\n"
                    "<i>I'll check the URL on the next message and notify you of changes.</i>"
                )

            # --- /status ---
            elif text == "/status":
                if chat_id not in monitors:
                    send_message(chat_id,
                        "📭 <b>Not monitoring anything.</b>\n"
                        "Use /monitor &lt;url&gt; [minutes] to start."
                    )
                else:
                    m = monitors[chat_id]
                    last_status = m.get("last_status", "Not checked yet")
                    last_check = m.get("last_check")
                    if last_check:
                        ago = int((time.time() - last_check) // 60)
                        last_check_str = f"{ago} min ago"
                    else:
                        last_check_str = "never"

                    if isinstance(last_status, int) and 200 <= last_status < 300:
                        status_emoji = "✅"
                    elif isinstance(last_status, int):
                        status_emoji = "⚠️"
                    elif last_status and "Not checked" in str(last_status):
                        status_emoji = "⏳"
                    else:
                        status_emoji = "🔴"

                    send_message(chat_id,
                        f"{status_emoji} <b>Monitor Status</b>\n\n"
                        f"URL: <code>{m['url']}</code>\n"
                        f"Interval: every {m['interval_min']} min\n"
                        f"Last status: <b>{last_status}</b>\n"
                        f"Last check: {last_check_str}\n\n"
                        "Use /stop to end monitoring."
                    )

            # --- /stop ---
            elif text == "/stop":
                if chat_id in monitors:
                    url = monitors[chat_id]["url"]
                    del monitors[chat_id]
                    send_message(chat_id,
                        f"🛑 <b>Monitoring stopped.</b>\n"
                        f"No longer checking: <code>{url}</code>"
                    )
                else:
                    send_message(chat_id, "📭 You weren't monitoring anything.")

            else:
                send_message(chat_id,
                    "🔍 Use /help for available commands.\n"
                    "Start monitoring with /monitor &lt;url&gt; [minutes]"
                )

        self._finish()

    def _finish(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def do_GET(self):
        # Also check monitors on GET (triggers from cron pings)
        check_all_monitors()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Redrock API Poller Bot is running!")
