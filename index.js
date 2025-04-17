require("dotenv").config();
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const axios = require("axios");
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);
redis.set("test", "Redis is running fine");
redis.get("test").then(console.log);

const bot = new Telegraf(process.env.BOT_TOKEN);

async function getMediaUrl(url) {
  try {
    const cached = await redis.get(url);
    if (cached) {
      console.log("Serving from cache");
      return cached;
    }
  } catch (err) {
    console.warn("Redis GET failed:", err.message);
  }

  try {
    const response = await axios.get(
      "https://instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com/convert",
      {
        params: { url },
        timeout: 5000,
        headers: {
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
          "x-rapidapi-host":
            "instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com",
        },
      }
    );

    const mediaUrl = response?.data?.media?.[0]?.url;

    if (!mediaUrl) {
      throw new Error("Invalid response from API.");
    }

    try {
      await redis.set(url, mediaUrl, "EX", 3600);
    } catch (err) {
      console.warn("Redis SET failed:", err.message);
    }

    return mediaUrl;
  } catch (err) {
    throw new Error("Media fetch failed: " + err.message);
  }
}

bot.start((ctx) => {
  ctx.reply(
    "📸 Send me an Instagram link (reel or photo) and I’ll fetch it for you."
  );
});

bot.on(message("text"), async (ctx) => {
  const url = ctx.message.text;

  if (!url.includes("instagram.com")) {
    return ctx.reply("Please send a valid Instagram URL.");
  }

  try {
    ctx.reply("Downloading...");

    const mediaUrl = await getMediaUrl(url);

    const fileType = await axios.head(mediaUrl);

    const contentType = fileType.headers["content-type"];

    if (contentType.startsWith("image")) {
      await ctx.replyWithPhoto({ url: mediaUrl });
    } else {
      await ctx.replyWithVideo({ url: mediaUrl });
    }
  } catch (err) {
    console.error("Download error:", err.message);
    ctx.reply(
      "⚠️ Oops! Something went wrong.\n" +
        "- The link might be private or expired\n" +
        "- The API may be down or slow\n" +
        "- Or we've hit the request limit\n\nTry again in a bit!"
    );
  }
});

bot.launch();
