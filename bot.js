// ============================================================
//  Telegram News Bot — bot.js
//  Real-time RSS news delivery via Telegram
// ============================================================

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const cron        = require("node-cron");
const {
  fetchLatestNews,
  fetchFromSourceByName,
  formatArticle,
  RSS_SOURCES,
  RSS_SOURCE,
} = require("./rss");
const {
  loadSubscribers,
  addSubscriber,
  removeSubscriber,
  getAllSubscribers,
} = require("./subscribers");

// ── Bot initialisation ───────────────────────────────────────
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("❌  TOKEN environment variable is missing. Set it in .env");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
console.log("🤖  Bot is starting…");

// ── In-memory state ──────────────────────────────────────────
// Menyimpan judul artikel yang sudah dikirim agar tidak duplikat
let lastSentTitles = [];

// ── /start ───────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name   = msg.from.first_name || "there";

  const welcome = `
👋 *Halo, ${name}!*

Saya adalah *Bot Berita Real-Time* 🇮🇩
Sumber berita: Republika, Tribunnews, Merdeka.com, Suara.com

📋 *Daftar Perintah:*
• /subscribe   — Aktifkan update berita otomatis
• /unsubscribe — Nonaktifkan update berita
• /latest      — Tampilkan 5 berita terbaru sekarang
• /sources     — Pilih berita dari sumber tertentu
• /start       — Tampilkan pesan bantuan ini

⚡ Berita dicek setiap *1 menit* — tidak ada berita yang terlewat!
  `.trim();

  bot.sendMessage(chatId, welcome, { parse_mode: "Markdown" });
});

// ── /subscribe ───────────────────────────────────────────────
bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;
  const result = addSubscriber(chatId);

  if (result.added) {
    bot.sendMessage(
      chatId,
      "✅ *Berhasil subscribe!* Kamu akan menerima update berita otomatis setiap menit.\n\nGunakan /unsubscribe untuk berhenti.",
      { parse_mode: "Markdown" }
    );
  } else {
    bot.sendMessage(
      chatId,
      "ℹ️ Kamu *sudah subscribe*. Gunakan /unsubscribe jika ingin berhenti.",
      { parse_mode: "Markdown" }
    );
  }
});

// ── /unsubscribe ─────────────────────────────────────────────
bot.onText(/\/unsubscribe/, (msg) => {
  const chatId = msg.chat.id;
  const result = removeSubscriber(chatId);

  if (result.removed) {
    bot.sendMessage(
      chatId,
      "👋 *Berhasil unsubscribe.* Kamu tidak akan menerima update otomatis lagi.\n\nGunakan /subscribe kapan saja untuk aktifkan kembali.",
      { parse_mode: "Markdown" }
    );
  } else {
    bot.sendMessage(
      chatId,
      "ℹ️ Kamu *belum subscribe*. Gunakan /subscribe untuk mulai.",
      { parse_mode: "Markdown" }
    );
  }
});

// ── /latest ──────────────────────────────────────────────────
bot.onText(/\/latest/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    bot.sendMessage(chatId, "🔄 Mengambil berita terbaru dari semua sumber…");

    // ambil 3 artikel per sumber, tampilkan 5 terbaik
    const articles = await fetchLatestNews(3, 5);
    if (!articles.length) {
      return bot.sendMessage(chatId, "⚠️ Tidak dapat mengambil berita saat ini. Coba lagi nanti.");
    }

    for (const article of articles) {
      await bot.sendMessage(chatId, formatArticle(article), {
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      });
      await sleep(400);
    }
  } catch (err) {
    console.error("❌  /latest error:", err.message);
    bot.sendMessage(chatId, "⚠️ Terjadi kesalahan saat mengambil berita. Silakan coba lagi.");
  }
});

// ── /sources ─────────────────────────────────────────────────
// Tampilkan daftar sumber, lalu user bisa ketik nama sumber
bot.onText(/\/sources(?:\s+(.+))?/, async (msg, match) => {
  const chatId    = msg.chat.id;
  const sourceName = match[1] ? match[1].trim() : null;

  // Jika tidak ada argumen → tampilkan daftar sumber dengan tombol
  if (!sourceName) {
    const sourceList = RSS_SOURCES
      .map((s) => `${s.emoji} *${s.name}*`)
      .join("\n");

    const keyboard = {
      reply_markup: {
        inline_keyboard: RSS_SOURCES.map((s) => ([{
          text:          `${s.emoji} ${s.name}`,
          callback_data: `source:${s.name}`,
        }])),
      },
    };

    return bot.sendMessage(
      chatId,
      `📡 *Pilih Sumber Berita:*\n\n${sourceList}\n\nAtau ketik: \`/sources Republika\``,
      { parse_mode: "Markdown", ...keyboard }
    );
  }

  // Ada argumen → langsung fetch dari sumber tersebut
  await sendSourceArticles(chatId, sourceName);
});

// ── Callback query untuk tombol inline /sources ───────────────
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data;

  if (data && data.startsWith("source:")) {
    const sourceName = data.replace("source:", "");
    // Jawab query agar tombol tidak loading terus
    await bot.answerCallbackQuery(query.id, { text: `Mengambil dari ${sourceName}…` });
    await sendSourceArticles(chatId, sourceName);
  }
});

// ── Helper kirim artikel dari 1 sumber ───────────────────────
async function sendSourceArticles(chatId, sourceName) {
  const found = RSS_SOURCES.find(
    (s) => s.name.toLowerCase() === sourceName.toLowerCase()
  );

  if (!found) {
    const names = RSS_SOURCES.map((s) => s.name).join(", ");
    return bot.sendMessage(
      chatId,
      `❌ Sumber *${sourceName}* tidak ditemukan.\n\nSumber tersedia: ${names}`,
      { parse_mode: "Markdown" }
    );
  }

  bot.sendMessage(chatId, `🔄 Mengambil berita dari *${found.emoji} ${found.name}*…`, {
    parse_mode: "Markdown",
  });

  const articles = await fetchFromSourceByName(found.name, 3);
  if (!articles.length) {
    return bot.sendMessage(
      chatId,
      `⚠️ Tidak ada berita dari *${found.name}* saat ini.`,
      { parse_mode: "Markdown" }
    );
  }

  for (const article of articles) {
    await bot.sendMessage(chatId, formatArticle(article), {
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    });
    await sleep(400);
  }
}

// ── Cron job — broadcast artikel baru setiap 1 menit ─────────
cron.schedule("* * * * *", async () => {
  console.log(`[${timestamp()}] ⏰ Cron — memeriksa artikel baru dari semua sumber…`);

  try {
    // ambil 3 dari tiap sumber, limit 6 total untuk broadcast
    const articles    = await fetchLatestNews(3, 6);
    const subscribers = getAllSubscribers();

    if (!articles.length) {
      console.log(`[${timestamp()}] ⚠️  Tidak ada artikel dari feed.`);
      return;
    }

    // Filter artikel yang belum pernah dikirim
    const newArticles = articles.filter(
      (a) => !lastSentTitles.includes(a.title)
    );

    if (!newArticles.length) {
      console.log(`[${timestamp()}] ✔  Tidak ada artikel baru.`);
      return;
    }

    if (!subscribers.length) {
      console.log(`[${timestamp()}] ℹ️  ${newArticles.length} artikel baru, tapi belum ada subscriber.`);
      updateLastSentTitles(newArticles.map((a) => a.title));
      return;
    }

    console.log(
      `[${timestamp()}] 📢 Broadcast ${newArticles.length} artikel ke ${subscribers.length} subscriber.`
    );

    for (const chatId of subscribers) {
      for (const article of newArticles) {
        try {
          await bot.sendMessage(chatId, formatArticle(article), {
            parse_mode: "Markdown",
            disable_web_page_preview: false,
          });
          await sleep(350);
        } catch (sendErr) {
          console.warn(`[${timestamp()}] ⚠️  Gagal kirim ke ${chatId}: ${sendErr.message}`);
        }
      }
      await sleep(300);
    }

    updateLastSentTitles(newArticles.map((a) => a.title));

  } catch (err) {
    console.error(`[${timestamp()}] ❌  Cron error:`, err.message);
  }
});

// ── Helpers ───────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function timestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Keep lastSentTitles bounded to the last 20 entries so memory
 * doesn't grow unbounded over long-running sessions.
 */
function updateLastSentTitles(newTitles) {
  lastSentTitles = [...lastSentTitles, ...newTitles].slice(-20);
}

// ── Graceful shutdown ─────────────────────────────────────────
process.once("SIGINT",  () => { console.log("\n👋  Bot berhenti…"); bot.stopPolling(); process.exit(0); });
process.once("SIGTERM", () => { console.log("\n👋  Bot berhenti…"); bot.stopPolling(); process.exit(0); });

console.log(`✅  Bot aktif. Sumber RSS: ${RSS_SOURCE}`);
console.log("📡  Polling Telegram untuk pesan baru…");
