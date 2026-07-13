from http.server import BaseHTTPRequestHandler
import json, os, sys

# TeleBot lightweight — no deps, pure stdlib
# Install: pip install pyTelegramBotAPI (only if you need advanced features)

BOT_TOKEN = os.environ.get("BOT_TOKEN", "123:abc")

def send_message(chat_id, text):
    import urllib.request
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = json.dumps({"chat_id": chat_id, "text": text}).encode()
    req = urllib.request.Request(url, data=data,
        headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req)

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(content_length))
        
        if "message" in body:
            msg = body["message"]
            chat_id = msg["chat"]["id"]
            text = msg.get("text", "")
            
            if text == "/start":
                send_message(chat_id, "👋 Hello from Redrock! Your bot is live on Vercel.")
            else:
                send_message(chat_id, f"You said: {text}")
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode())

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Redrock bot is running!")
