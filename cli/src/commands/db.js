const chalk = require('chalk');

module.exports = async function db(action, opts = {}) {
  if (action === 'init') {
    console.log(chalk.green('🗄️  Database initialized with Vercel KV (default)'));
    console.log(chalk.dim('   Switch: redrock db migrate --to supabase'));
  } else if (action === 'migrate') {
    const to = opts.to || 'supabase';
    console.log(chalk.yellow(`🔄 Migration to ${to} — coming in v1.2`));
  } else {
    console.log(chalk.red(`Unknown action: ${action}`));
  }
};
