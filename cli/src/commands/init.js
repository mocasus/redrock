const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');

// Valid templates and their descriptions
const TEMPLATES = {
  'basic':       'Simple /start + echo bot (default)',
  'broadcast':   'Admin broadcast to subscribers',
  'reminder':    'Set reminders via /remind <minutes> <message>',
  'group_mod':   'Group moderation: /warn, /ban, /rules, spam filter',
  'echo_custom': 'Echo bot with custom /setreply rules',
  'api_poller':  'Monitor URLs for status changes',
};

module.exports = async function init(name = 'my-redrock-bot', opts = {}) {
  const token = opts.token || process.env.BOT_TOKEN;
  const framework = opts.framework || 'python-telegram-bot';
  const template = opts.template || 'basic';

  if (!token) {
    console.log(chalk.red('❌ Bot token required.'));
    console.log(chalk.yellow('   Get one from @BotFather: https://t.me/BotFather'));
    console.log(chalk.dim('   Then run: npx redrock init -t <token>'));
    return;
  }

  // Validate template
  if (!TEMPLATES[template]) {
    console.log(chalk.red(`❌ Unknown template: "${template}"`));
    console.log(chalk.yellow('   Available templates:'));
    for (const [name, desc] of Object.entries(TEMPLATES)) {
      console.log(chalk.dim(`   ${name.padEnd(14)} ${desc}`));
    }
    return;
  }

  const projectDir = path.resolve(process.cwd(), name);
  if (fs.existsSync(projectDir)) {
    console.log(chalk.red(`❌ Directory "${name}" already exists.`));
    return;
  }

  const spinner = ora(`Creating project (${template} template)...`).start();

  // Create project structure
  fs.mkdirSync(projectDir);
  fs.mkdirSync(path.join(projectDir, 'api'));

  // Determine webhook handler path per framework
  const handlerPaths = {
    'python-telegram-bot': 'api/webhook.py',
    'grammy': 'api/webhook.ts',
    'telegraf': 'api/webhook.js',
  };
  const handlerPath = handlerPaths[framework] || 'api/webhook.py';

  // Create vercel.json
  const projectName = path.basename(name);
  const vercelConfig = {
    name: projectName,
    functions: {
      [handlerPath]: { memory: 128, maxDuration: 10 }
    },
    env: {
      BOT_TOKEN: '@redrock-bot-token'
    }
  };
  fs.writeFileSync(
    path.join(projectDir, 'vercel.json'),
    JSON.stringify(vercelConfig, null, 2)
  );

  // Create .env.example
  fs.writeFileSync(
    path.join(projectDir, '.env.example'),
`# Bot token from @BotFather (https://t.me/BotFather)
BOT_TOKEN=${token}
# Optional second bot token (max 2)
# BOT_TOKEN_2=your_second_bot_token_here

# Database (optional — uncomment to use)
# VERCEL_KV_URL=
# SUPABASE_URL=
# SUPABASE_KEY=
# FIREBASE_PROJECT_ID=
`
  );

  // Create redrock.json (config)
  const redrockConfig = {
    version: '0.1.0',
    framework: framework,
    mode: 'webhook',
    template: template,
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
    copyTemplate(templateDir, projectDir, template, framework);
  } else {
    // Generate default python-telegram-bot webhook
    createDefaultBot(projectDir, token);
  }

  spinner.succeed('Project created!');

  console.log(chalk.green(`\n🚀 ${name} ready!`));
  console.log(chalk.dim(`   cd ${name}`));
  console.log(chalk.dim('   npx redrock deploy'));

  // Show template-specific next steps
  showNextSteps(template);
};

function copyTemplate(srcDir, destDir, template, framework) {
  // For each file in the template directory, copy it over
  // If a template-specific variant exists for webhook.py, use that instead
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);

    if (entry.isDirectory()) {
      const destSubDir = path.join(destDir, entry.name);
      fs.mkdirSync(destSubDir, { recursive: true });

      // Handle api/ directory — pick the right template variant
      if (entry.name === 'api') {
        copyApiDir(srcPath, destSubDir, template, framework);
      } else {
        copyDir(srcPath, destSubDir, template, framework);
      }
    } else {
      fs.copyFileSync(srcPath, path.join(destDir, entry.name));
    }
  }
}

function copyApiDir(srcDir, destDir, template, framework) {
  // Determine which file should become api/webhook.py
  // Template variants are named api/<template>.py
  // The basic template is api/webhook.py (the default)

  let handlerFile;
  if (template === 'basic') {
    handlerFile = 'webhook.py';
  } else {
    // Map template names to their variant filenames
    const variantFile = `${template}.py`;
    const variantPath = path.join(srcDir, variantFile);

    if (fs.existsSync(variantPath)) {
      handlerFile = variantFile;
    } else {
      // Fallback: use basic webhook.py
      console.log(chalk.yellow(`⚠️  Template "${template}" not found for ${framework}, using basic.`));
      handlerFile = 'webhook.py';
    }
  }

  // Copy the selected handler as webhook.py
  const srcHandler = path.join(srcDir, handlerFile);
  const destHandler = path.join(destDir, 'webhook.py');
  fs.copyFileSync(srcHandler, destHandler);

  // Also copy any other files in the api/ directory (e.g., if templates add helpers)
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name !== handlerFile && entry.name !== destHandler) {
      // Skip other template variants — only copy non-template files
      const isVariant = Object.keys(TEMPLATES).some(t => `${t}.py` === entry.name);
      if (!isVariant) {
        fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
      }
    }
  }
}

function copyDir(src, dest, template, framework) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, template, framework);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function showNextSteps(template) {
  console.log(chalk.cyan('\n📋 Next steps:'));
  switch (template) {
    case 'broadcast':
      console.log(chalk.dim('   1. Set ADMIN_ID env var in Vercel dashboard'));
      console.log(chalk.dim('   2. Get your ID from @userinfobot on Telegram'));
      console.log(chalk.dim('   3. Deploy and send /start to subscribe'));
      break;
    case 'reminder':
      console.log(chalk.dim('   1. Deploy your bot'));
      console.log(chalk.dim('   2. Set up Vercel Cron Job for reliable reminders'));
      console.log(chalk.dim('   3. Add to vercel.json: "crons": [{"path":"/api/webhook","schedule":"* * * * *"}]'));
      break;
    case 'group_mod':
      console.log(chalk.dim('   1. Set ADMIN_IDS env var (comma-separated user IDs)'));
      console.log(chalk.dim('   2. Add bot to your group as admin with delete/ban permissions'));
      console.log(chalk.dim('   3. Customize rules via GROUP_RULES env var'));
      break;
    case 'echo_custom':
      console.log(chalk.dim('   1. Deploy and use /setreply trigger:response'));
      console.log(chalk.dim('   2. ⚠️  Reply rules reset on cold start — use DB for production'));
      console.log(chalk.dim('   3. Or set REPLY_RULES_JSON env var for persistent defaults'));
      break;
    case 'api_poller':
      console.log(chalk.dim('   1. Deploy and use /monitor <url> <minutes>'));
      console.log(chalk.dim('   2. ⚠️  Set up Vercel Cron Job for reliable checks'));
      console.log(chalk.dim('   3. Add to vercel.json: "crons": [{"path":"/api/webhook","schedule":"*/5 * * * *"}]'));
      break;
    default:
      console.log(chalk.dim('   1. Customize api/webhook.py with your commands'));
      console.log(chalk.dim('   2. Deploy to Vercel'));
  }
}

function createDefaultBot(dir, token) {
  // api/webhook.py
  const webhook = `from http.server import BaseHTTPRequestHandler
import json, os, sys

# TeleBot lightweight — no deps, pure stdlib
# Install: pip install pyTelegramBotAPI (only if you need advanced features)

BOT_TOKEN = os.environ.get("BOT_TOKEN", "YOUR_BOT_TOKEN")

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
