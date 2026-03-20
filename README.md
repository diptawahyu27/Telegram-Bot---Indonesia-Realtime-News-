# 📰 Telegram News Bot

A lightweight, real-time Telegram news bot built with Node.js that delivers breaking news from **Detik.com** RSS feed to subscribed users — updating every **1 minute**.

---

## 🗂️ Project Structure

```
news-bot/
├── bot.js            ← Entry point — bot commands & cron job
├── rss.js            ← RSS fetching & message formatting
├── subscribers.js    ← Subscriber management (JSON persistence)
├── subscribers.json  ← Auto-created when first user subscribes
├── .env              ← Your secret bot token (never commit!)
├── .gitignore
└── package.json
```

---

## ⚙️ Installation

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18 or newer

### 2. Clone / create the project folder
```bash
mkdir news-bot && cd news-bot
# (copy all files here)
```

### 3. Install dependencies
```bash
npm install
```

This installs:
| Package | Purpose |
|---|---|
| `node-telegram-bot-api` | Telegram Bot interface |
| `rss-parser` | Parse RSS/Atom feeds |
| `node-cron` | Schedule recurring jobs |
| `dotenv` | Load `.env` variables |

### 4. Configure your token

Edit `.env`:
```env
TOKEN=your_bot_token_from_BotFather
```

> ⚠️ Never share or commit your `.env` file!

---

## 🚀 Running the Bot

```bash
node bot.js
```

You should see:
```
📂  No subscribers file found — starting fresh.
🤖  Bot is starting…
✅  Bot is running. RSS source: https://rss.detik.com/index.php/detikcom
📡  Polling Telegram for messages…
```

---

## 💬 Bot Commands

| Command | Description |
|---|---|
| `/start` | Welcome message & command list |
| `/subscribe` | Subscribe to automatic news updates |
| `/unsubscribe` | Stop receiving updates |
| `/latest` | Fetch the 3 newest articles right now |

---

## 📲 Example Telegram Output

**`/latest` response:**

```
📰 LATEST NEWS

*Jokowi Resmikan Tol Baru di Jawa Tengah*
🕐 Jumat, 20 Maret 2026, 09.15

🔗 https://news.detik.com/...
```

**Automatic broadcast (every minute when new article detected):**
```
📰 LATEST NEWS

*Rupiah Menguat ke Level Rp15.600 Per Dolar AS*
🕐 Jumat, 20 Maret 2026, 09.22

🔗 https://finance.detik.com/...
```

---

## 🔄 How Real-Time Updates Work

```
Every 60 seconds
      │
      ▼
Fetch RSS feed (top 3 articles)
      │
      ▼
Compare titles with lastSentTitles[]
      │
   New? ──YES──► Send to all subscribers
      │                    │
      NO                   ▼
      │           Update lastSentTitles[]
      ▼
  Do nothing
```

---

## 🛡️ Security Notes

- Bot token is loaded from environment variable — never hardcoded
- `.env` and `subscribers.json` are excluded from git via `.gitignore`
- User chat IDs are stored locally in `subscribers.json` — no external database needed

---

## 🔧 Customisation Ideas

- **Change RSS source** → edit `RSS_SOURCE` in `rss.js`
- **Change broadcast frequency** → edit the cron expression in `bot.js` (`"* * * * *"` = every minute)
- **Broadcast more articles** → change `BROADCAST_COUNT` in `bot.js`
- **Add keyword filter** → filter `articles` array by `.title.toLowerCase().includes("keyword")`

---

## 📦 Dependencies

```json
{
  "node-telegram-bot-api": "^0.66.0",
  "rss-parser": "^3.13.0",
  "node-cron": "^3.0.3",
  "dotenv": "^16.4.5"
}
```
