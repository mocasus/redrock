# Redrock — Reminder Bot Template
# ----------------------------------------------------------------
# Bot that accepts /remind <minutes> <message> and sends a reminder
# when the time is up. Reminders are stored in memory.
#
# ⚠️  Vercel serverless limitation:
#   There is no long-running process, so reminders are checked on each
#   incoming webhook call. This means reminders only fire when the bot
#   receives a message. For reliable timed reminders, set up a Vercel
#   Cron Job (vercel.json crons) that pings your webhook every 60s.
#
#   Add this to vercel.json:
#     "crons": [{ "path": "/api/webhook", "schedule": "* * * * *" }]
#
# Customization:
#   - Max reminder duration (default 1440 min = 24h)
#   - Add persistent storage via redrock db for production
#
# ENV vars:
#   BOT_TOKEN — from @BotFather (required)

from http.server import BaseHTTPRequestHandler
import json, os, sys, time
import urllib.request

BOT_TOKEN = os.environ.get("BOT_TOKEN", "YOUR_BOT_TOKEN")
MAX_REMINDER_MINUTES = 1440  # 24 hours max

# ⚠️ In-memory storage — resets on Vercel cold starts.
# Key: chat_id, Value: list of {"at": timestamp, "message": str}
reminders = {}


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


def check_reminders():
    """Fire any due reminders. Called on each webhook hit."""
    now = time.time()
    for chat_id in list(reminders.keys()):
        due = [r for r in reminders[chat_id] if r["at"] <= now]
        for r in due:
            send_message(chat_id,
                f"⏰ <b>Reminder!</b>\n{r['message']}\n\n"
                f"<i>(set {int((now - (r['at'] - r['duration']*60)) // 60)} min ago)</i>"
            )
        # Keep only future reminders
        reminders[chat_id] = [r for r in reminders[chat_id] if r["at"] > now]
        if not reminders[chat_id]:
            del reminders[chat_id]


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Check due reminders on every incoming request
        check_reminders()

        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length))

        if "message" in body:
            msg = body["message"]
            chat_id = msg["chat"]["id"]
            text = msg.get("text", "")

            # --- /start ---
            if text == "/start":
                send_message(chat_id,
                    "⏰ <b>Reminder Bot</b>\n\n"
                    "I'll remind you about anything. Just tell me when.\n\n"
                    "Usage: /remind &lt;minutes&gt; &lt;message&gt;\n"
                    "Example: /remind 30 Call the dentist\n\n"
                    "Commands:\n"
                    "  /remind — Set a reminder\n"
                    "  /myreminders — List your pending reminders\n"
                    "  /cancel — Cancel your most recent reminder\n"
                    "  /help — Show this message"
                )

            # --- /help ---
            elif text == "/help":
                send_message(chat_id,
                    "⏰ <b>Reminder Bot Help</b>\n\n"
                    "<b>Commands:</b>\n"
                    "  /remind &lt;minutes&gt; &lt;message&gt;\n"
                    "    Example: /remind 15 Take the pizza out!\n"
                    f"    Max: {MAX_REMINDER_MINUTES} minutes (24h)\n\n"
                    "  /myreminders — Show your active reminders\n"
                    "  /cancel — Cancel the last reminder you set\n\n"
                    "<i>Reminders are checked when the bot receives any message.</i>"
                )

            # --- /remind <minutes> <message> ---
            elif text.startswith("/remind"):
                parts = text[len("/remind"):].strip().split(" ", 1)
                if len(parts) < 2:
                    send_message(chat_id, "Usage: /remind &lt;minutes&gt; &lt;message&gt;\nExample: /remind 10 Buy milk")
                else:
                    try:
                        minutes = int(parts[0])
                    except ValueError:
                        send_message(chat_id, "❌ Please provide a valid number of minutes.")
                        self._finish()
                        return

                    message = parts[1]

                    if minutes <= 0:
                        send_message(chat_id, "❌ Minutes must be positive.")
                    elif minutes > MAX_REMINDER_MINUTES:
                        send_message(chat_id, f"❌ Max reminder is {MAX_REMINDER_MINUTES} minutes (24 hours).")
                    else:
                        at_time = time.time() + (minutes * 60)
                        if chat_id not in reminders:
                            reminders[chat_id] = []
                        reminders[chat_id].append({
                            "at": at_time,
                            "message": message,
                            "duration": minutes
                        })
                        local_time = time.strftime("%H:%M", time.localtime(at_time))
                        send_message(chat_id,
                            f"✅ <b>Reminder set!</b>\n"
                            f"I'll remind you at <b>{local_time}</b> ({minutes} min from now):\n"
                            f"<i>\"{message}\"</i>"
                        )

            # --- /myreminders ---
            elif text == "/myreminders":
                user_reminders = reminders.get(chat_id, [])
                if not user_reminders:
                    send_message(chat_id, "📭 You have no active reminders.")
                else:
                    lines = [f"📋 <b>Your reminders ({len(user_reminders)}):</b>\n"]
                    for i, r in enumerate(user_reminders, 1):
                        remaining = int((r["at"] - time.time()) // 60)
                        local_time = time.strftime("%H:%M", time.localtime(r["at"]))
                        lines.append(f"  {i}. <b>{local_time}</b> ({remaining}m) — {r['message']}")
                    send_message(chat_id, "\n".join(lines))

            # --- /cancel ---
            elif text == "/cancel":
                if chat_id not in reminders or not reminders[chat_id]:
                    send_message(chat_id, "📭 You have no reminders to cancel.")
                else:
                    removed = reminders[chat_id].pop()
                    send_message(chat_id,
                        f"🗑️ <b>Cancelled:</b> \"{removed['message']}\"\n"
                        f"<i>Type /myreminders to see remaining.</i>"
                    )
                    if not reminders[chat_id]:
                        del reminders[chat_id]

            else:
                send_message(chat_id, "Use /help to see available commands.")

        self._finish()

    def _finish(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def do_GET(self):
        # Also check reminders on GET (triggers from cron pings)
        check_reminders()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Redrock Reminder Bot is running!")
