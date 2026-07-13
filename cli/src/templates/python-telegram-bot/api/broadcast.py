# Redrock — Broadcast Bot Template
# ----------------------------------------------------------------
# Broadcast bot that lets an admin send messages to all subscribers.
# Subscribers are stored in an in-memory set (resets on cold start).
# For production use with persistent subscribers, wire up a database
# (Vercel KV, Supabase, or Firebase) via redrock db init.
#
# Customization:
#   - Set ADMIN_ID env var to your Telegram user ID (get it from @userinfobot)
#   - Subscribers auto-join on /start
#   - Admin commands: /broadcast <text>, /subscribers (list count)
#
# ENV vars:
#   BOT_TOKEN   — from @BotFather (required)
#   ADMIN_ID    — your Telegram numeric user ID (required for admin commands)

from http.server import BaseHTTPRequestHandler
import json, os, sys
import urllib.request

BOT_TOKEN = os.environ.get("BOT_TOKEN", "YOUR_BOT_TOKEN")
ADMIN_ID = int(os.environ.get("ADMIN_ID", "0"))

# ⚠️ In-memory storage — resets on Vercel cold starts.
# Use a database for production.
subscribers = set()


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


def broadcast_to_all(message_text):
    """Send a message to every subscriber."""
    count = 0
    for uid in list(subscribers):
        try:
            send_message(uid, message_text)
            count += 1
        except Exception:
            pass
    return count


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length))

        if "message" in body:
            msg = body["message"]
            chat_id = msg["chat"]["id"]
            text = msg.get("text", "")
            username = msg.get("from", {}).get("username", "unknown")

            # --- /start — subscribe ---
            if text == "/start":
                subscribers.add(chat_id)
                send_message(chat_id,
                    "📢 <b>You're subscribed!</b>\n"
                    "You'll receive broadcast messages from the admin.\n"
                    "Send /stop to unsubscribe."
                )

            # --- /stop — unsubscribe ---
            elif text == "/stop":
                subscribers.discard(chat_id)
                send_message(chat_id, "👋 You've been unsubscribed. Send /start to rejoin.")

            # --- /subscribers — admin only ---
            elif text == "/subscribers":
                if chat_id != ADMIN_ID:
                    send_message(chat_id, "⛔ Admin only.")
                else:
                    send_message(chat_id,
                        f"📊 <b>Subscribers:</b> {len(subscribers)}\n"
                        f"<i>IDs: {list(subscribers)[:10]}{'...' if len(subscribers) > 10 else ''}</i>"
                    )

            # --- /broadcast <text> — admin only ---
            elif text.startswith("/broadcast"):
                if chat_id != ADMIN_ID:
                    send_message(chat_id, "⛔ Admin only.")
                else:
                    broadcast_text = text[len("/broadcast"):].strip()
                    if not broadcast_text:
                        send_message(chat_id, "Usage: /broadcast <message>")
                    else:
                        count = broadcast_to_all(f"📢 <b>Broadcast:</b>\n{broadcast_text}")
                        send_message(chat_id, f"✅ Sent to {count} subscriber(s).")

            # --- /help ---
            elif text == "/help":
                send_message(chat_id,
                    "🤖 <b>Broadcast Bot</b>\n\n"
                    "<b>Everyone:</b>\n"
                    "  /start — Subscribe to broadcasts\n"
                    "  /stop — Unsubscribe\n"
                    "  /help — This message\n\n"
                    "<b>Admin only:</b>\n"
                    "  /broadcast &lt;text&gt; — Send to all subscribers\n"
                    "  /subscribers — View subscriber count"
                )

            else:
                send_message(chat_id, "Use /help to see available commands.")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Redrock Broadcast Bot is running!")
