const chalk = require('chalk');
const fs = require('fs');

module.exports = async function switchMode(mode) {
  if (!['webhook', 'polling'].includes(mode)) {
    console.log(chalk.red('❌ Mode must be "webhook" or "polling"'));
    return;
  }

  if (fs.existsSync('redrock.json')) {
    const config = JSON.parse(fs.readFileSync('redrock.json', 'utf8'));
    config.mode = mode;
    fs.writeFileSync('redrock.json', JSON.stringify(config, null, 2));
    console.log(chalk.green(`✅ Switched to ${mode} mode`));
    console.log(chalk.dim('   Run "redrock deploy" to apply changes'));
  } else {
    console.log(chalk.red('❌ Not a Redrock project'));
  }
};
