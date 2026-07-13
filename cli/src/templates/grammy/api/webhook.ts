// Redrock — grammY Telegram Bot (TypeScript, ES modules)
// Deploys as a Vercel serverless function in api/ directory.

import { Bot, webhookCallback } from "grammy";

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  await ctx.reply("👋 Hello from Redrock! Your grammY bot is live on Vercel.");
});

bot.command("help", async (ctx) => {
  await ctx.reply("Just send me any message and I'll echo it back!");
});

bot.on("message:text", async (ctx) => {
  await ctx.reply(`You said: ${ctx.message.text}`);
});

// Vercel serverless handler — grammY webhookCallback
export default webhookCallback(bot, "http");
