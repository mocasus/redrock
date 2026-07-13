const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');

module.exports = async function init(name = 'my-redrock-bot', opts = {}) {
  const token = opts.token || process.env.BOT_TOKEN;
  const framework = opts.framework || 'python-telegram-bot';

  if (!token) {
    console.log(chalk.red('❌ Bot token required.'));
    console.log(chalk.yellow('   Get one from @BotFather: https://t.me/BotFather'));
    console.log(chalk.dim('   Then run: npx redrock init -t <token>'));
    return;
  }

  const projectDir = path.resolve(process.cwd(), name);
  if (fs.existsSync(projectDir)) {
    console.log(chalk.red(`❌ Directory "${name}" already exists.`));
    return;
  }

  const spinner = ora('Creating project...').start();

  // Create project structure
  fs.mkdirSync(projectDir);
  fs.mkdirSync(path.join(projectDir, 'api'));

  // Create vercel.json
  const vercelConfig = {
    name: name,
    functions: {
      'api/webhook.py': { memory: 128, maxDuration: 10 }
    },
    env: {
      BOT_TOKEN: '@redrock-bot-token',
      ...(framework === 'python-telegram-bot' ? {} : {})
    }
  };
  fs.writeFileSync(
    path.join(projectDir, 'vercel.json'),
    JSON.stringify(vercelConfig, null, 2)
  );

  // Create .env.example
  fs.writeFileSync(
    path.join(projectDir, '.env.example'),
    `BOT_TOKEN=${token}\n# BOT_TOKEN_2=your_second_bot_token\n`
  );

  // Create redrock.json (config)
  const redrockConfig = {
    version: '0.1.0',
    framework: framework,
    mode: 'webhook',
    db: { provider: 'vercel-kv' },
    tokens: { primary: token, secondary: '' },
    maxTokens: 2
  };
  fs.writeFileSync(
    path.join(projectDir, 'redrock.json'),
    JSON.stringify(redrockConfig, null, 2)
  );

  // Copy template based on framework
  const templateDir = path.join(__dirname, '..', 'templates', framework);
  if (fs.existsSync(templateDir)) {
    copyDir(templateDir, projectDir);
  } else {
    // Generate default python-telegram-bot webhook
    createDefaultBot(projectDir, token);
  }

  spinner.succeed('Project created!');

  console.log(chalk.green(`\n🚀 ${name} ready!`));
  console.log(chalk.dim(`   cd ${name}`));
  console.log(chalk.dim('   npx redrock deploy'));
};

function createDefaultBot(dir, token) {
  // api/webhook.py
  const webhook = `from http.server import BaseHTTPRequestHandler
import json, os, sys

# TeleBot lightweight — no deps, pure stdlib
# Install: pip install pyTelegramBotAPI (only if you need advanced features)

BOT_TOKEN = os.environ.get("BOT_TOKEN", "${token}")

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
`;

  fs.writeFileSync(path.join(dir, 'api', 'webhook.py'), webhook);

  // requirements.txt
  fs.writeFileSync(path.join(dir, 'requirements.txt'), '');
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
