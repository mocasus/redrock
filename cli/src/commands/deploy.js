const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const chalk = require('chalk');
const ora = require('ora');

function getWebhookUrl(token, url) {
  return new Promise((resolve, reject) => {
    const telegramUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${url}`;
    https.get(telegramUrl, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid Telegram response: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Failed to reach Telegram API: ${err.message}`));
    }).on('timeout', () => {
      reject(new Error('Telegram API timeout'));
    });
  });
}

module.exports = async function deploy(opts = {}) {
  const isProd = opts.prod || false;

  // Check if redrock.json exists
  if (!fs.existsSync('redrock.json')) {
    console.log(chalk.red('❌ Not a Redrock project. Run "redrock init" first.'));
    return;
  }

  // Warn if user has custom vercel.json (don't overwrite)
  const config = JSON.parse(fs.readFileSync('redrock.json', 'utf8'));
  if (fs.existsSync('vercel.json')) {
    const existing = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    if (existing.functions || existing.env || existing.builds) {
      console.log(chalk.yellow('⚠️  Custom vercel.json detected — Redrock will merge, not overwrite.'));
    }
  }

  // Check if vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'pipe' });
  } catch {
    console.log(chalk.yellow('📦 Installing Vercel CLI...'));
    execSync('npm i -g vercel', { stdio: 'inherit' });
  }

  // Load config
  const token = config.tokens?.primary || process.env.BOT_TOKEN;

  if (!token) {
    console.log(chalk.red('❌ No bot token found.'));
    console.log(chalk.dim('   Set it in redrock.json or BOT_TOKEN env var.'));
    return;
  }

  // Check Vercel auth
  const vercelToken = process.env.VERCEL_TOKEN;
  if (!vercelToken) {
    console.log(chalk.yellow('⚠️  VERCEL_TOKEN not set. You may need to login first:'));
    console.log(chalk.dim('   vercel login'));
    console.log(chalk.dim('   Then run: npx redrock deploy'));
    return;
  }

  const spinner = ora('Deploying to Vercel...').start();

  try {
    const prodFlag = isProd ? '--prod' : '';
    const deployOutput = execSync(
      `vercel ${prodFlag} --token ${vercelToken} -c`,
      { stdio: 'pipe', cwd: process.cwd(), timeout: 120000 }
    ).toString();

    // Extract deployment URL from vercel output
    const urlMatch = deployOutput.match(/https?:\/\/[^\s]+\.vercel\.app/);
    const projectName = config.name || path.basename(process.cwd());
    const webhookUrl = urlMatch
      ? `${urlMatch[0]}/api/webhook`
      : `https://${projectName}.vercel.app/api/webhook`;

    spinner.text = 'Registering webhook...';

    const result = await getWebhookUrl(token, webhookUrl);

    if (result.ok) {
      spinner.succeed('Bot deployed!');
      console.log(chalk.green(`\n🚀 Bot live at: ${webhookUrl}`));
      console.log(chalk.dim('   Try /start on your bot!'));
    } else {
      spinner.warn('Deployed but webhook setup failed.');
      console.log(chalk.yellow(`   Error: ${result.description || 'Unknown'}`));
      console.log(chalk.dim(`   Manual: curl "https://api.telegram.org/bot<token>/setWebhook?url=${webhookUrl}"`));
    }

  } catch (err) {
    spinner.fail('Deploy failed.');
    console.log(chalk.red(err.message));
    if (err.message.includes('not authenticated') || err.message.includes('login')) {
      console.log(chalk.dim('\nRun: vercel login'));
    } else {
      console.log(chalk.dim('\nTry manually: vercel --prod'));
    }
  }
};
