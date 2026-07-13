# Redrock — Group Moderation Bot Template
# ----------------------------------------------------------------
# Group moderation bot with /warn, /ban, /rules, and auto spam deletion.
# Designed for Telegram groups (add bot as admin for full functionality).
#
# Features:
#   - /warn @username — warn a user (3 warns = mention ban notice)
#   - /rules — display group rules
#   - Auto-detect spam: messages with URLs from non-admin users
#     get auto-deleted with a warning
#   - All warns are stored in memory only (resets on cold start —
#     use a DB for persistent moderation)
#
# Customization:
#   - Edit GROUP_RULES text below
#   - Set ADMIN_IDS env var to comma-separated Telegram user IDs
#     that are exempt from spam filtering
#   - Adjust WARN_LIMIT to change how many warns before ban notice
#
# ENV vars:
#   BOT_TOKEN    — from @BotFather (required)
#   ADMIN_IDS    — comma-separated admin user IDs (optional)
#   GROUP_RULES  — custom rules text (optional, uses default if unset)

from http.server import BaseHTTPRequestHandler
import json, os, re, sys
import urllib.request

BOT_TOKEN = os.environ.get("BOT_TOKEN", "YOUR_BOT_TOKEN")
ADMIN_IDS = set(
    int(x.strip()) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip()
)
WARN_LIMIT = 3

DEFAULT_RULES = (
    "📜 <b>Group Rules</b>\n\n"
    "1. Be respectful to all members\n"
    "2. No spam or unsolicited links\n"
    "3. No hate speech or harassment\n"
    "4. Stay on topic\n"
    "5. Follow admin instructions\n\n"
    "<i>Violations may result in a warn or ban.</i>"
)
GROUP_RULES = os.environ.get("GROUP_RULES", DEFAULT_RULES)

# ⚠️ In-memory storage — resets on Vercel cold starts.
# Use a database (redrock db init) for production.
warns = {}  # {chat_id: {user_id: [warn_messages]}}


def send_message(chat_id, text, reply_markup=None, reply_to_message_id=None):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    if reply_to_message_id:
        payload["reply_to_message_id"] = reply_to_message_id
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data,
        headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"[redrock] send_message failed: {e}", file=sys.stderr)


def delete_message(chat_id, message_id):
    """Try to delete a message. Requires bot to have delete permissions."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/deleteMessage"
    data = json.dumps({"chat_id": chat_id, "message_id": message_id}).encode()
    req = urllib.request.Request(url, data=data,
        headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"[redrock] delete_message failed: {e}", file=sys.stderr)


def has_url(text):
    """Check if text contains a URL."""
    url_pattern = re.compile(
        r'https?://\S+|www\.\S+|\S+\.(com|org|net|io|dev|gg|me|xyz|ru|tk|ml|ga|cf)\b',
        re.IGNORECASE
    )
    return bool(url_pattern.search(text))


def is_admin(user_id):
    """Check if a user ID is in the configured admin list."""
    return user_id in ADMIN_IDS


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length))

        if "message" in body:
            msg = body["message"]
            chat_id = msg["chat"]["id"]
            chat_type = msg["chat"].get("type", "private")
            text = msg.get("text", "")
            message_id = msg.get("message_id", 0)
            from_user = msg.get("from", {})
            user_id = from_user.get("id", 0)
            username = from_user.get("username", "")
            first_name = from_user.get("first_name", "User")

            # Determine display name for mentions
            display_name = f"@{username}" if username else first_name

            # --- Auto spam detection (group/supergroup only) ---
            if chat_type in ("group", "supergroup") and not is_admin(user_id):
                if has_url(text) and not text.startswith("/"):
                    try:
                        delete_message(chat_id, message_id)
                    except Exception:
                        pass
                    send_message(chat_id,
                        f"⚠️ {display_name}, links are not allowed.\n"
                        "This is a warning.",
                        reply_to_message_id=message_id
                    )
                    self._finish()
                    return

            # --- /start ---
            if text == "/start":
                if chat_type == "private":
                    send_message(chat_id,
                        "🛡️ <b>Group Mod Bot</b>\n\n"
                        "Add me to your group as an admin to get:\n"
                        "• Auto spam (link) detection\n"
                        "• /warn, /ban commands\n"
                        "• /rules for group rules\n\n"
                        "Make sure I have <b>delete messages</b> and "
                        "<b>ban users</b> permissions!"
                    )
                else:
                    send_message(chat_id, "🛡️ Group Mod Bot is active. Type /rules for group rules.")

            # --- /rules ---
            elif text == "/rules":
                send_message(chat_id, GROUP_RULES)

            # --- /warn @username [reason] ---
            elif text.startswith("/warn"):
                parts = text[len("/warn"):].strip().split(" ", 1)
                if not parts or not parts[0]:
                    send_message(chat_id,
                        "Usage: /warn @username [reason]\n"
                        "Example: /warn @spammer Flooding chat",
                        reply_to_message_id=message_id
                    )
                    self._finish()
                    return

                target = parts[0].lstrip("@")
                reason = parts[1] if len(parts) > 1 else "No reason given"

                # Try to find target user ID from mention or reply
                target_user_id = None
                target_display = target

                # Check if replying to a message
                if "reply_to_message" in msg:
                    target_user_id = msg["reply_to_message"]["from"]["id"]
                    target_display = msg["reply_to_message"]["from"].get("username",
                        msg["reply_to_message"]["from"].get("first_name", "User"))
                # Check entities for mention
                elif "entities" in msg:
                    for entity in msg.get("entities", []):
                        if entity.get("type") == "mention":
                            mentioned = text[entity["offset"]:entity["offset"] + entity["length"]]
                            if mentioned.lstrip("@").lower() == target.lower():
                                # We have the mention but not the user ID reliably
                                # Store by username
                                target_user_id = target.lower()
                                break

                if target_user_id is None:
                    target_user_id = target.lower()

                # Initialize warns structure
                if chat_id not in warns:
                    warns[chat_id] = {}
                if target_user_id not in warns[chat_id]:
                    warns[chat_id][target_user_id] = []

                warns[chat_id][target_user_id].append(reason)
                warn_count = len(warns[chat_id][target_user_id])

                warn_msg = (
                    f"⚠️ <b>Warning {warn_count}/{WARN_LIMIT}</b> for {target_display}\n"
                    f"Reason: {reason}"
                )

                if warn_count >= WARN_LIMIT:
                    warn_msg += (
                        f"\n\n🚫 <b>Ban recommended!</b>\n"
                        f"{target_display} has reached {WARN_LIMIT} warnings.\n"
                        f"Admins should consider banning this user."
                    )
                    # Reset warns after ban recommendation
                    del warns[chat_id][target_user_id]

                send_message(chat_id, warn_msg, reply_to_message_id=message_id)

            # --- /ban <@username or reply> ---
            elif text.startswith("/ban"):
                parts = text[len("/ban"):].strip()
                target_display = parts.lstrip("@") if parts else "that user"

                # Reply-based ban
                if "reply_to_message" in msg:
                    target_display = msg["reply_to_message"]["from"].get("username",
                        msg["reply_to_message"]["from"].get("first_name", "User"))

                send_message(chat_id,
                    f"🔨 {target_display} has been noted for ban.\n"
                    f"<i>Bot cannot ban users directly — group admins must ban manually.\n"
                    f"To enable auto-ban, give the bot ban permissions and customize this template.</i>",
                    reply_to_message_id=message_id
                )

            # --- /help ---
            elif text == "/help":
                send_message(chat_id,
                    "🛡️ <b>Group Mod Bot — Help</b>\n\n"
                    "<b>Commands:</b>\n"
                    "  /rules — Show group rules\n"
                    "  /warn @username [reason] — Warn a user\n"
                    "  /ban @username — Flag user for ban\n"
                    "  /help — This message\n\n"
                    "<b>Auto-moderation:</b>\n"
                    "• Messages with URLs from non-admins are auto-deleted\n"
                    f"• {WARN_LIMIT} warns triggers a ban recommendation"
                )

            else:
                if chat_type == "private":
                    send_message(chat_id,
                        "🛡️ Add me to a group as admin for moderation features.\n"
                        "Type /help for commands."
                    )
                # In groups, silently ignore non-command text

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def _finish(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Redrock Group Mod Bot is running!")
