import { config } from "dotenv";
config();
import { fetchResultWithCluster } from "./utils/LoginAndFetchResult.js";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import Redis from "ioredis";
import { roastResult } from "./utils/groqAi.js";

const redis = new Redis(process.env.REDIS_URL || "");
const WAITING_FOR_PASSWORD = new Map<number, boolean>();
const WAITING_FOR_SEMESTER = new Map<number, boolean>();
const WAITING_FOR_COOKIE_CONSENT = new Map<number, { cookie: string }>();
const USER_LOGGED_IN = new Map<number, boolean>();
const COOKIE_KEY_PREFIX = "session_cookie:";

const bot = new Telegraf(process.env.BOT_TOKEN || "");

bot.command("start", (ctx) => {
  ctx.reply(
    `Welcome to the Result Bot! 😃 \n` +
      ` Use /result to fetch your academic📚 result. \n` +
      `Use menu button for more commands.`,
    {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    } as {
      parse_mode: "Markdown";
      disable_web_page_preview: boolean;
    }
  );
});

bot.command("result", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return ctx.reply("Unable to identify your user ID.");

  const cachedCookie = await redis.get(`${COOKIE_KEY_PREFIX}${userId}`);
  if (cachedCookie) {
    WAITING_FOR_SEMESTER.set(userId, true);
    return ctx.reply("Which semester result do you want to view?", {
      reply_markup: {
        inline_keyboard: Array.from({ length: 8 }, (_, i) => [
          { text: `${i + 1}`, callback_data: `semester_${i + 1}` },
        ]),
      },
    });
  } else {
    WAITING_FOR_PASSWORD.set(userId, true);
    return ctx.reply(
      "Please enter your university rollno and password (separated by a space)."
    );
  }
});

bot.command("logout", async (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    await redis.del(`${COOKIE_KEY_PREFIX}${userId}`);
    USER_LOGGED_IN.delete(userId);
    ctx.reply("You have been logged out.👋");
  } else {
    ctx.reply("You are not currently logged in.");
  }
});

bot.command("help", (ctx) => {
  ctx.reply(
    `/result - View your result (select semester).\n` +
      `/logout - Clear your current session.\n` +
      `/help - Show this help message`
  );
});

bot.on(message("text"), async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = ctx.message.text;

  if (WAITING_FOR_PASSWORD.get(userId)) {
    const [username, password] = text.split(" ").map((s) => s.trim());
    if (username && password) {
      WAITING_FOR_PASSWORD.delete(userId);
      ctx.reply("Logging in...");
      try {
        const { cookie } = await fetchResultWithCluster({ username, password });
        if (cookie) {
          // Instead of immediately storing the cookie, ask for consent
          WAITING_FOR_COOKIE_CONSENT.set(userId, { cookie });
          return ctx.reply(
            "Login successful! Would you like to store your session for future use? This will keep you logged in for 10 minutes.",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Yes, store session",
                      callback_data: "store_cookie_yes",
                    },
                    {
                      text: "No, don't store",
                      callback_data: "store_cookie_no",
                    },
                  ],
                ],
              },
            }
          );
        } else {
          return ctx.reply(
            "Login failed.❗ Please check your credentials and try again."
          );
        }
      } catch (error: any) {
        console.error("Login error:", error.message);
        return ctx.reply(`Login failed❗`);
      }
    } else {
      return ctx.reply(
        "Please provide both username and password separated by a space."
      );
    }
  }

  const knownCommands = ["/result", "/logout", "/help", "/start"];
  if (!text.startsWith("/") && !knownCommands.includes(text)) {
    ctx.reply(
      `❗ Unknown command.\n\nHere are the available commands:\n` +
        `/result - View your result.\n` +
        `/logout - Logout your session.\n` +
        `/help - Show help message`
    );
  }
});

// Handle cookie storage consent
bot.action("store_cookie_yes", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const cookieData = WAITING_FOR_COOKIE_CONSENT.get(userId);
  if (!cookieData) {
    return ctx.reply(
      "Session expired. Please try logging in again with /result"
    );
  }

  // Store the cookie with user's consent
  await redis.setex(`${COOKIE_KEY_PREFIX}${userId}`, 600, cookieData.cookie);
  USER_LOGGED_IN.set(userId, true);
  WAITING_FOR_COOKIE_CONSENT.delete(userId);

  ctx.reply(
    "Your session has been stored. Now, which semester result do you want to view?",
    {
      reply_markup: {
        inline_keyboard: Array.from({ length: 8 }, (_, i) => [
          { text: `${i + 1}`, callback_data: `semester_${i + 1}` },
        ]),
      },
    }
  );
});

bot.action("store_cookie_no", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const cookieData = WAITING_FOR_COOKIE_CONSENT.get(userId);
  if (!cookieData) {
    return ctx.reply(
      "Session expired. Please try logging in again with /result"
    );
  }

  // Don't store the cookie, but proceed with a temporary session
  USER_LOGGED_IN.set(userId, true);
  WAITING_FOR_COOKIE_CONSENT.delete(userId);

  // Proceeding with temporary cookie usage
  ctx.reply(
    "Session will not be stored. Which semester result do you want to view?",
    {
      reply_markup: {
        inline_keyboard: Array.from({ length: 8 }, (_, i) => [
          { text: `${i + 1}`, callback_data: `semester_${i + 1}_temp` },
        ]),
      },
    }
  );
});

bot.action(/semester_(\d+)(_temp)?/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const semester = ctx.match[1];
  const isTemporary = ctx.match[2] === "_temp";
  let cookie;

  ctx.reply(`Fetching result for semester ${semester}, please wait...`);

  if (isTemporary) {
    // For temporary sessions, check if we still have the cookie in memory
    const cookieData = WAITING_FOR_COOKIE_CONSENT.get(userId);
    if (!cookieData) {
      return ctx.reply(
        "Your temporary session has expired. Please use /result to log in again."
      );
    }
    cookie = cookieData.cookie;
  } else {
    // For stored sessions, retrieve from Redis
    cookie = await redis.get(`${COOKIE_KEY_PREFIX}${userId}`);
    if (!cookie) {
      return ctx.reply(
        "Your session has expired. Please use /result again to log in."
      );
    }
  }

  try {
    const result = await fetchResultWithCluster({
      semester,
      cachedCookie: cookie,
    });

    if (result.screenshot == null || result.pdf == null) {
      await ctx.reply(`${result.text}`);
      return;
    }

    const pdfBuffer = Buffer.from(result.pdf);
    await ctx.replyWithDocument({
      source: pdfBuffer,
      filename: `result_semester_${semester}.pdf`,
    });

    const screenshotBuffer = Buffer.from(result.screenshot);
    await ctx.replyWithPhoto(
      { source: screenshotBuffer },
      { caption: `Screenshot of your semester ${semester} result page` }
    );

    const roast = await roastResult(result.text!);
    await ctx.reply(roast);

    // If this was a temporary session, clean up after use
    if (isTemporary) {
      WAITING_FOR_COOKIE_CONSENT.delete(userId);
    }
  } catch (err: any) {
    console.error(
      `Error fetching result for semester ${semester}:`,
      err.message
    );
    ctx.reply(`Error fetching result for semester ${semester}`);
  }
});

bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("An error occurred while processing your request.");
});

console.log("Starting bot...");
bot
  .launch()
  .then(() => console.log("Bot started successfully"))
  .catch((err) => console.error("Failed to start bot:", err));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
