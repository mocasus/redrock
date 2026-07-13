const { spawn } = require('child_process');
const chalk = require('chalk');

module.exports = async function logs(opts = {}) {
  const follow = opts.follow !== false;  // default true
  const limit = opts.limit || 50;
  const json = opts.json || false;
  const since = opts.since || '';

  const args = ['logs'];

  if (follow) args.push('--follow');
  if (json) args.push('--json');
  if (limit) args.push('--limit', String(limit));
  if (since) args.push('--since', since);
  if (opts.query) args.push('--query', opts.query);
  if (opts.statusCode) args.push('--status-code', String(opts.statusCode));
  if (opts.level) args.push('--level', opts.level);

  console.log(chalk.dim(`$ vercel ${args.join(' ')}`));
  console.log(chalk.dim('─'.repeat(60)));

  const child = spawn('vercel', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  child.stdout.on('data', (data) => {
    const text = data.toString();
    if (json) {
      // Parse JSON lines, pretty-print
      text.split('\n').filter(Boolean).forEach(line => {
        try {
          const entry = JSON.parse(line);
          const ts = entry.timestamp ? new Date(entry.timestamp).toISOString().slice(11, 19) : '--:--:--';
          const method = (entry.requestMethod || '---').padEnd(6);
          const path = (entry.requestPath || entry.path || '/').slice(0, 40);
          const status = entry.statusCode || entry.proxy?.statusCode || '---';
          const color = status < 300 ? chalk.green : status < 500 ? chalk.yellow : chalk.red;
          console.log(
            chalk.dim(ts),
            chalk.cyan(method),
            path.padEnd(42),
            color(String(status).padStart(3)),
            entry.message || ''
          );
        } catch {
          process.stdout.write(text);
        }
      });
    } else {
      process.stdout.write(text);
    }
  });

  child.stderr.on('data', (data) => {
    const text = data.toString();
    if (text.includes('Error') || text.includes('error')) {
      process.stderr.write(chalk.red(text));
    } else if (text.includes('not linked')) {
      console.log(chalk.yellow('⚠️  Project not linked to Vercel.'));
      console.log(chalk.dim('   Run: vercel link'));
    } else {
      process.stderr.write(chalk.dim(text));
    }
  });

  child.on('close', (code) => {
    if (code !== 0 && !follow) {
      console.log(chalk.yellow(`\n⚠️  vercel logs exited with code ${code}`));
    }
  });

  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.log(chalk.red('❌ Vercel CLI not installed.'));
      console.log(chalk.dim('   npm i -g vercel'));
    } else {
      console.log(chalk.red(`❌ Failed: ${err.message}`));
    }
  });

  // Keep process alive for streaming
  return new Promise((resolve) => {
    if (!follow) {
      child.on('close', resolve);
    } else {
      // For --follow, wait for SIGINT or timeout
      const timeout = setTimeout(() => {
        child.kill();
        resolve();
      }, 60000); // 60s auto-stop

      process.on('SIGINT', () => {
        clearTimeout(timeout);
        child.kill();
        resolve();
      });
    }
  });
};
