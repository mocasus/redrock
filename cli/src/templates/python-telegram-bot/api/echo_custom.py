# Redrock — Echo Custom Bot Template
# ----------------------------------------------------------------
# Enhanced echo bot with custom reply rules.
# Stores reply rules in a JSON file so they persist across warm requests.
#
# Features:
#   - /setreply <trigger>:<response> — Add a custom reply rule
#   - /delreply <trigger> — Delete a reply rule
#   - /listreplies — List all custom reply rules
#   - Default echo behavior for unrecognized text
#
# ⚠️  Vercel /tmp limitation:
#   /tmp is ephemeral and resets on cold starts. Reply rules stored in
#   /tmp/replies.json will be lost periodically. For production, either:
#   - Use a database (redrock db init → Vercel KV, Supabase, Firebase)
#   - Store rules in an env var (REPLY_RULES_JSON) for small, static sets
#   - Accept that rules reset on deploy/cold start (fine for demos)
#
# Customization:
#   - Edit DEFAULT_REPLIES for built-in rules
#   - Change REPLIES_FILE path for different storage location
#   - Add more complex pattern matching (regex, fuzzy)
#
# ENV vars:
#   BOT_TOKEN         — from @BotFather (required)
#   REPLY_RULES_JSON  — JSON string of rules, e.g. '{"hi":"Hello!","bye":"Goodbye!"}'

from http.server import BaseHTTPRequestHandler
import json, os, sys
import urllib.request

BOT_TOKEN = os.environ.get("BOT_TOKEN", "YOUR_BOT_TOKEN")
REPLIES_FILE = "/tmp/redrock_replies.json"

# Default built-in reply rules (overridden by env var or /setreply)
DEFAULT_REPLIES = {
    "hello": "Hi there! 👋",
    "hey": "Hey! How can I help?",
    "bye": "Goodbye! 👋",
    "thanks": "You're welcome! 😊",
    "ping": "pong! 🏓",
}


def load_replies():
    """Load reply rules from multiple sources.
    Priority: env var > JSON file > defaults
    """
    rules = dict(DEFAULT_REPLIES)

    # Load from env var (highest priority bindings)
    env_rules = os.environ.get("REPLY_RULES_JSON", "")
    if env_rules:
        try:
            rules.update(json.loads(env_rules))
        except json.JSONDecodeError:
            print(f"[redrock] Invalid REPLY_RULES_JSON: {env_rules}", file=sys.stderr)

    # Load from file (overrides defaults, but env var takes precedence)
    try:
        with open(REPLIES_FILE, "r") as f:
            file_rules = json.load(f)
            # File rules override defaults but not env
            for k, v in file_rules.items():
                if k not in rules:
                    rules[k] = v
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    return rules


def save_replies(rules):
    """Save reply rules to JSON file."""
    try:
        with open(REPLIES_FILE, "w") as f:
            json.dump(rules, f)
    except Exception as e:
        print(f"[redrock] save_replies failed: {e}", file=sys.stderr)


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


def match_reply(rules, text):
    """Check if incoming text matches any reply rule.
    Returns the response if matched, None otherwise.
    Case-insensitive match.
    """
    lower = text.lower().strip()
    return rules.get(lower)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length))

        if "message" in body:
            msg = body["message"]
            chat_id = msg["chat"]["id"]
            text = msg.get("text", "")

            # --- /start ---
            if text == "/start":
                send_message(chat_id,
                    "🔊 <b>Echo Custom Bot</b>\n\n"
                    "I echo your messages back — but you can teach me custom replies!\n\n"
                    "<b>Commands:</b>\n"
                    "  /setreply &lt;trigger&gt;:&lt;response&gt;\n"
                    "    Example: /setreply hello:Hi there!\n\n"
                    "  /delreply &lt;trigger&gt;\n"
                    "    Example: /delreply hello\n\n"
                    "  /listreplies — Show all custom reply rules\n"
                    "  /help — This message\n\n"
                    "<i>All other messages are echoed back.</i>"
                )

            # --- /help ---
            elif text == "/help":
                send_message(chat_id,
                    "🔊 <b>Echo Custom Bot — Help</b>\n\n"
                    "<b>Adding custom replies:</b>\n"
                    "  /setreply trigger:response\n"
                    "  Example: /setreply hello:Hello there! 👋\n\n"
                    "<b>Removing replies:</b>\n"
                    "  /delreply trigger\n"
                    "  Example: /delreply hello\n\n"
                    "<b>Viewing replies:</b>\n"
                    "  /listreplies\n\n"
                    "<b>Default rules:</b>\n"
                    f"  {', '.join(DEFAULT_REPLIES.keys())}\n\n"
                    "<i>Rules are case-insensitive. Multiple rules for the same trigger "
                    "overwrite the previous one.</i>"
                )

            # --- /setreply <trigger>:<response> ---
            elif text.startswith("/setreply"):
                arg = text[len("/setreply"):].strip()
                if ":" not in arg:
                    send_message(chat_id,
                        "Usage: /setreply &lt;trigger&gt;:&lt;response&gt;\n"
                        "Example: /setreply hello:Hi there!"
                    )
                else:
                    trigger, response = arg.split(":", 1)
                    trigger = trigger.strip().lower()
                    response = response.strip()

                    if not trigger or not response:
                        send_message(chat_id, "❌ Both trigger and response are required.")
                    else:
                        rules = load_replies()
                        rules[trigger] = response
                        save_replies(rules)
                        send_message(chat_id,
                            f"✅ <b>Reply rule set!</b>\n"
                            f"When someone says <i>\"{trigger}\"</i>, I'll reply:\n"
                            f"<i>\"{response}\"</i>"
                        )

            # --- /delreply <trigger> ---
            elif text.startswith("/delreply"):
                trigger = text[len("/delreply"):].strip().lower()
                if not trigger:
                    send_message(chat_id, "Usage: /delreply &lt;trigger&gt;")
                else:
                    rules = load_replies()
                    if trigger in rules:
                        del rules[trigger]
                        save_replies(rules)
                        send_message(chat_id,
                            f"🗑️ <b>Deleted:</b> reply rule for <i>\"{trigger}\"</i>"
                        )
                    else:
                        send_message(chat_id,
                            f"❌ No reply rule found for <i>\"{trigger}\"</i>.\n"
                            "Use /listreplies to see all rules."
                        )

            # --- /listreplies ---
            elif text == "/listreplies":
                rules = load_replies()
                if not rules:
                    send_message(chat_id, "📭 No custom reply rules set.")
                else:
                    lines = [f"📋 <b>Reply Rules ({len(rules)}):</b>\n"]
                    for i, (trigger, response) in enumerate(sorted(rules.items()), 1):
                        resp_preview = response[:50] + "..." if len(response) > 50 else response
                        lines.append(f"  {i}. <b>{trigger}</b> → {resp_preview}")
                    send_message(chat_id, "\n".join(lines))

            # --- Default: try custom reply, else echo ---
            else:
                rules = load_replies()
                reply = match_reply(rules, text)
                if reply:
                    send_message(chat_id, reply)
                else:
                    send_message(chat_id, f"You said: {text}")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Redrock Echo Custom Bot is running!")
