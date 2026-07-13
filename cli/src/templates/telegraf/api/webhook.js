// Redrock — Telegraf Telegram Bot (JavaScript, CommonJS)
// Deploys as a Vercel serverless function in api/ directory.

const { Telegraf } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  await ctx.reply("👋 Hello from Redrock! Your Telegraf bot is live on Vercel.");
});

bot.help(async (ctx) => {
  await ctx.reply("Just send me any message and I'll echo it back!");
});

bot.on("text", async (ctx) => {
  await ctx.reply(`You said: ${ctx.message.text}`);
});

// Vercel serverless handler — Telegraf webhook callback
module.exports = bot.webhookCallback("/api/webhook");
