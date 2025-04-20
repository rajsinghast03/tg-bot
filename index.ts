import { config } from "dotenv";
config();
import fetchResult from "./utils/LoginAndFetchResult.js";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import Redis from "ioredis";
import { roastResult } from "./utils/groqAi.js";

const redis = new Redis(process.env.REDIS_URL || "");
const WAITING_FOR_PASSWORD = new Map<number, boolean>();
const WAITING_FOR_SEMESTER = new Map<number, boolean>();
const USER_LOGGED_IN = new Map<number, boolean>();
const COOKIE_KEY_PREFIX = "session_cookie:";

const bot = new Telegraf(process.env.BOT_TOKEN || "");

bot.command("start", (ctx) => {
  ctx.reply(
    `Welcome to the Result Bot! 😃 \n` +
      ` Use /result to fetch your academic📚 result. \n` +
      `Use menu buttton for more commands.
`,
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
  if (!userId) {
    return ctx.reply("Unable to identify your user ID.");
  }

  const cachedCookie = await redis.get(`${COOKIE_KEY_PREFIX}${userId}`);

  if (cachedCookie) {
    WAITING_FOR_SEMESTER.set(userId, true);
    return ctx.reply("Which semester result do you want to view?", {
      reply_markup: {
        inline_keyboard: Array.from(
          {
            length: 8,
          },
          (_, i) => [
            {
              text: `${i + 1}`,
              callback_data: `semester_${i + 1}`,
            },
          ]
        ),
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
    `/result - View your result (select semester). You might be asked for credentials initially.\n` +
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
        const { cookie } = await fetchResult(username, password);
        if (cookie) {
          await redis.setex(`${COOKIE_KEY_PREFIX}${userId}`, 600, cookie);
          USER_LOGGED_IN.set(userId, true);
          WAITING_FOR_SEMESTER.set(userId, true);
          return ctx.reply(
            "Login successful. Which semester result do you want to view?",
            {
              reply_markup: {
                inline_keyboard: Array.from(
                  {
                    length: 8,
                  },
                  (_, i) => [
                    {
                      text: `${i + 1}`,
                      callback_data: `semester_${i + 1}`,
                    },
                  ]
                ),
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
  if (
    !text.startsWith("/") &&
    !knownCommands.includes(text) &&
    !WAITING_FOR_PASSWORD.get(userId)
  ) {
    ctx.reply(
      `❗ Unknown command.\n\nHere are the available commands:\n` +
        `/result - View your result (select semester).\n` +
        `/logout - Clear your current session.\n` +
        `/help - Show this help message`
    );
  }
});

bot.action(/semester_(\d+)/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !WAITING_FOR_SEMESTER.get(userId)) return;
  WAITING_FOR_SEMESTER.delete(userId);
  const semester = ctx.match[1];
  ctx.reply(`Fetching result for semester ${semester}, please wait...`);

  const cachedCookie = await redis.get(`${COOKIE_KEY_PREFIX}${userId}`);

  if (!cachedCookie) {
    return ctx.reply(
      "Your session has expired. Please use /result again to log in."
    );
  }

  try {
    const result = await fetchResult(
      undefined,
      undefined,
      semester,
      cachedCookie
    );
    console.log(`Result fetched successfully for semester ${semester}`);

    if (result.screenshot == null || result.pdf == null) {
      await ctx.reply(`${result.text}`);
      console.log(`Result not declared yet for semester ${semester}!`);
      return;
    }

    const pdfUint8Array: Uint8Array = result.pdf;
    const pdfBuffer: Buffer = Buffer.from(pdfUint8Array);
    console.log(`PDF generated successfully for semester ${semester}`);

    await ctx.replyWithDocument({
      source: pdfBuffer,
      filename: `result_semester_${semester}.pdf`,
    });

    const screenshotUint8Array: Uint8Array = result.screenshot;
    const screenshotBuffer: Buffer = Buffer.from(screenshotUint8Array);

    await ctx.replyWithPhoto(
      { source: screenshotBuffer },
      { caption: `Screenshot of your semester ${semester} result page` }
    );

    const resultText = result.text;
    const roast = await roastResult(resultText!);
    await ctx.reply(roast);

    console.log(`Result for semester ${semester} sent to user`);
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
