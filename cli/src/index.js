#!/usr/bin/env node
const { program } = require('commander');
const chalk = require('chalk');
const pkg = require('../../package.json');

// ── ASCII Banner ──
const BANNER = [
  '    ╔═══════════════════════════════════════╗',
  '    ║                                       ║',
  '    ║   ██████╗ ███████╗██████╗ ██████╗  ██████╗  ██████╗██╗  ██╗',
  '    ║   ██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝',
  '    ║   ██████╔╝█████╗  ██║  ██║██████╔╝██║   ██║██║     █████╔╝ ',
  '    ║   ██╔══██╗██╔══╝  ██║  ██║██╔══██╗██║   ██║██║     ██╔═██╗ ',
  '    ║   ██║  ██║███████╗██████╔╝██║  ██║╚██████╔╝╚██████╗██║  ██╗',
  '    ║   ╚═╝  ╚═╝╚══════╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝',
  '    ║                                       ║',
  '    ║   Deploy Telegram bots to Vercel      ║',
  '    ║   No VPS. No fees. One command.        ║',
  '    ╚═══════════════════════════════════════╝',
].join('\n');

function printBanner() {
  const lines = BANNER.split('\n');
  lines.forEach((line, i) => {
    if (i === 0 || i === lines.length - 1) {
      console.log(chalk.hex('#C83C28')(line));
    } else if (i >= 2 && i <= 7) {
      console.log(chalk.hex('#DC5537')(line));
    } else if (i === 9 || i === 10) {
      console.log(chalk.hex('#FF9070')(line));
    } else {
      console.log(chalk.hex('#C83C28')(line));
    }
  });
}

// ── No args? Show banner + hint ──
const args = process.argv.slice(2);
const hasArgs = args.length > 0;
const skipBanner = args.includes('--no-banner');

if (!hasArgs) {
  printBanner();
  console.log('');
  console.log(chalk.dim('  Try'), chalk.cyan('redrock --help'), chalk.dim('for all commands'));
  console.log(chalk.dim('  Or'), chalk.cyan('redrock init my-bot -t <token>'), chalk.dim('to get started'));
  console.log('');
  process.exit(0);
}

// ── CLI Setup ──
program
  .name('redrock')
  .description('Deploy Telegram bots to Vercel in 60 seconds 🚀')
  .version(pkg.version)
  .option('--no-banner', 'Skip welcome banner');

// Add banner before help text
program.addHelpText('beforeAll', () => {
  if (skipBanner) return '';
  return chalk.hex('#DC5537')(BANNER) + '\n';
});

program
  .command('init [name]')
  .description('Create a new Telegram bot project')
  .option('-t, --token <token>', 'Bot token from @BotFather')
  .option('-f, --framework <fw>', 'Framework: python-telegram-bot, grammy, telegraf', 'python-telegram-bot')
  .action((name, opts) => require('./commands/init')(name, opts));

program
  .command('deploy')
  .description('Deploy bot to Vercel')
  .option('-p, --prod', 'Production deploy', false)
  .action((opts) => require('./commands/deploy')(opts));

program
  .command('logs')
  .description('Stream Vercel deployment logs')
  .option('-j, --json', 'JSON output')
  .option('-n, --limit <n>', 'Max results', '50')
  .option('-s, --since <time>', 'Start time (1h, 30m, ISO)')
  .option('-q, --query <q>', 'Search query (e.g. "status:500 error")')
  .option('--status-code <code>', 'Filter by HTTP status')
  .option('--level <level>', 'Filter: error, warning, info, fatal')
  .option('--no-follow', 'One-shot, don\'t stream')
  .action((opts) => require('./commands/logs')(opts));

program
  .command('db <action>')
  .description('Database setup: init, migrate')
  .option('-p, --provider <name>', 'Provider: vercel-kv, supabase, firebase', 'vercel-kv')
  .option('-t, --to <provider>', 'Target provider for migrate: supabase, firebase')
  .action((action, opts) => require('./commands/db')(action, opts));

program
  .command('switch <mode>')
  .description('Switch between webhook and polling')
  .action((mode) => require('./commands/switch')(mode));

program.parse();
