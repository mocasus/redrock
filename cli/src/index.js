#!/usr/bin/env node
const { program } = require('commander');
const pkg = require('../../package.json');

program
  .name('redrock')
  .description('Deploy Telegram bots to Vercel in 60 seconds 🚀')
  .version(pkg.version);

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
  .action(() => require('./commands/logs')());

program
  .command('db <action>')
  .description('Database setup: init, migrate')
  .option('-t, --to <provider>', 'Target provider: supabase, firebase')
  .action((action, opts) => require('./commands/db')(action, opts));

program
  .command('switch <mode>')
  .description('Switch between webhook and polling')
  .action((mode) => require('./commands/switch')(mode));

program.parse();
