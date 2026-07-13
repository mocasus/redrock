const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

module.exports = async function deploy(opts = {}) {
  const isProd = opts.prod || false;

  // Check if redrock.json exists
  if (!fs.existsSync('redrock.json')) {
    console.log(chalk.red('❌ Not a Redrock project. Run "redrock init" first.'));
    return;
  }

  // Check if vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'pipe' });
  } catch {
    console.log(chalk.yellow('📦 Installing Vercel CLI...'));
    execSync('npm i -g vercel', { stdio: 'inherit' });
  }

  const spinner = ora('Deploying to Vercel...').start();

  try {
    // Set bot token as env var
    const config = JSON.parse(fs.readFileSync('redrock.json', 'utf8'));
    const token = config.tokens?.primary || process.env.BOT_TOKEN;

    if (!token) {
      spinner.fail('No bot token found in redrock.json');
      return;
    }

    // Deploy to Vercel
    const prodFlag = isProd ? '--prod' : '';
    execSync(`vercel ${prodFlag} --token ${process.env.VERCEL_TOKEN || ''}`, {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    // Set webhook
    const projectName = path.basename(process.cwd());
    const webhookUrl = `https://${projectName}.vercel.app/api/webhook`;

    const https = require('https');
    const telegramUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`;
    https.get(telegramUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.ok) {
          spinner.succeed('Bot deployed!');
          console.log(chalk.green(`\n🚀 Bot live at: ${webhookUrl}`));
          console.log(chalk.dim('   Try /start on your bot!'));
        } else {
          spinner.warn('Deployed but webhook setup failed.');
          console.log(chalk.yellow(`   Manually set webhook: ${telegramUrl}`));
        }
      });
    });

  } catch (err) {
    spinner.fail('Deploy failed.');
    console.log(chalk.red(err.message));
    console.log(chalk.dim('\nTry manually: vercel --prod'));
  }
};
