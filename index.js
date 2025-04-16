require("dotenv").config();
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const axios = require("axios");

const bot = new Telegraf(process.env.BOT_TOKEN);

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

    const response = await axios.get(
      "https://instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com/convert",
      {
        params: { url },
        headers: {
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
          "x-rapidapi-host":
            "instagram-downloader-download-instagram-stories-videos4.p.rapidapi.com",
        },
      }
    );

    const mediaUrl = response.data.media[0].url;

    const fileType = await axios.head(mediaUrl);

    const contentType = fileType.headers["content-type"];

    if (contentType.startsWith("image")) {
      await ctx.replyWithPhoto({ url: mediaUrl });
    } else {
      await ctx.replyWithVideo({ url: mediaUrl });
    }
  } catch (err) {
    console.error(err);
    ctx.reply(
      "Failed to fetch media. The link may be private or API quota exceeded."
    );
  }
});

bot.launch().then(() => {
  console.log("🤖 Bot is running!");
});
