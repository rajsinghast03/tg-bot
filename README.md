
# 📸 Instagram Downloader Telegram Bot

A simple Telegram bot built with **Node.js**, **Telegraf**, and **Redis** that allows users to download Instagram reels, photos, and videos just by sending a link.  


## 🚀 Features

- 🔗 Accepts Instagram post/reel/video URLs
- 📥 Downloads and sends media directly in chat
- ⚡️ Caches responses using Redis to improve performance
- 🔐 Handles API rate limits and basic error handling
- 🧠 Auto-detects media type (image or video)

---

## 🛠️ Tech Stack

- **Node.js**
- **Telegraf.js** – Telegram bot framework
- **Axios** – for API requests
- **Redis (via ioredis)** – used for caching
- **Instagram Download API** – via RapidAPI

---

## 📦 Setup Instructions

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-username/insta-downloader-bot.git
   cd insta-downloader-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a `.env` file**
   ```env
   BOT_TOKEN=your_telegram_bot_token
   REDIS_URL=your_redis_url # e.g., redis://localhost:6379
   RAPIDAPI_KEY=your_rapidapi_key
   ```

4. **Run the bot**
   ```bash
   node index.js
   ```

---

## 💡 How It Works

1. User sends a public Instagram reel/photo/video link
2. Bot checks Redis cache:
   - If found → sends cached media
   - If not → fetches media using RapidAPI and caches it
3. Bot replies with the photo or video file based on media type

---

## 🌐 Deployment

You can deploy this bot to:
- [Railway](https://railway.app)
- [Render](https://render.com)
- [Heroku](https://heroku.com)
- Or your own VPS

Make sure your `.env` is properly configured in the platform.

---

## 🧪 Example Usage

1. Start the bot on Telegram (`/start`)
2. Send a link like:
   ```
   https://www.instagram.com/reel/xyz/
   ```
3. Bot replies with the media file 📷🎥

---

## ⚠️ Notes

- The bot only works with **public** Instagram content
- Cached media is stored for **1 hour**
- Hitting API rate limits may cause delays or failures

---

## 👨‍💻 Author

Made with ❤️ by [Raj Singh](https://github.com/rajsinghast03)
