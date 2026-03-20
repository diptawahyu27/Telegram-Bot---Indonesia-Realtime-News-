// ============================================================
//  rss.js — Multi-source RSS fetching & article formatting
//  Sources: Republika, Tribunnews, Merdeka.com, Suara.com
// ============================================================

const Parser = require("rss-parser");

// ── RSS Sources (dari OPML export Plenary) ───────────────────
const RSS_SOURCES = [
  {
    name:  "Republika",
    url:   "https://www.republika.co.id/rss/",
    emoji: "🕌",
  },
  {
    name:  "Tribunnews",
    url:   "https://www.tribunnews.com/rss",
    emoji: "🗞️",
  },
  {
    name:  "Merdeka.com",
    url:   "https://www.merdeka.com/feed/",
    emoji: "🇮🇩",
  },
  {
    name:  "Suara.com",
    url:   "https://www.suara.com/rss",
    emoji: "📢",
  },
];

// RSS_SOURCE singular — dipakai di bot.js untuk log startup
const RSS_SOURCE = RSS_SOURCES.map((s) => s.name).join(", ");

const parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; TelegramNewsBot/2.0; +https://github.com/your-username/news-bot)",
    "Accept":     "application/rss+xml, application/xml, text/xml, */*",
  },
});

// ── Fetch satu sumber ─────────────────────────────────────────
/**
 * Ambil artikel dari satu sumber RSS.
 * Mengembalikan [] jika gagal tanpa melempar error.
 */
async function fetchFromSource(source, count = 3) {
  try {
    const feed = await parser.parseURL(source.url);
    return feed.items.slice(0, count).map((item) => ({
      title:   (item.title   || "Tanpa Judul").trim(),
      link:    (item.link    || item.guid    || "").trim(),
      pubDate: (item.pubDate || item.isoDate || "").trim(),
      source:  source.name,
      emoji:   source.emoji,
    }));
  } catch (err) {
    console.warn(`⚠️  Gagal fetch dari ${source.name}: ${err.message}`);
    return [];
  }
}

// ── Fetch semua sumber secara paralel ────────────────────────
/**
 * Ambil artikel dari semua sumber secara paralel,
 * gabungkan & urutkan berdasarkan tanggal terbaru.
 *
 * @param {number} countPerSource  Artikel per sumber (default 3)
 * @param {number} totalLimit      Batas total artikel dikembalikan (default 5)
 */
async function fetchLatestNews(countPerSource = 3, totalLimit = 5) {
  const results = await Promise.allSettled(
    RSS_SOURCES.map((src) => fetchFromSource(src, countPerSource))
  );

  const allArticles = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.length > 0) {
      allArticles.push(...result.value);
    }
  }

  if (!allArticles.length) return [];

  // Urutkan: terbaru di atas
  allArticles.sort((a, b) => {
    const tA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const tB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return tB - tA;
  });

  return allArticles.slice(0, totalLimit);
}

// ── Fetch berdasarkan nama sumber (untuk command /sources) ────
async function fetchFromSourceByName(sourceName, count = 3) {
  const source = RSS_SOURCES.find(
    (s) => s.name.toLowerCase() === sourceName.toLowerCase()
  );
  if (!source) return [];
  return fetchFromSource(source, count);
}

// ── Format pesan Telegram ─────────────────────────────────────
function formatArticle(article) {
  const date = article.pubDate
    ? `\n🕐 _${formatDate(article.pubDate)}_`
    : "";

  const sourceTag = article.source
    ? `\n🏷️ _${article.emoji} ${article.source}_`
    : "";

  return (
    `📰 *BERITA TERKINI*\n\n` +
    `*${escapeMarkdown(article.title)}*` +
    `${date}` +
    `${sourceTag}\n\n` +
    `🔗 ${article.link}`
  );
}

// ── Helpers ───────────────────────────────────────────────────
function formatDate(pubDate) {
  try {
    return new Date(pubDate).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday:  "short",
      day:      "2-digit",
      month:    "short",
      year:     "numeric",
      hour:     "2-digit",
      minute:   "2-digit",
    });
  } catch {
    return pubDate;
  }
}

function escapeMarkdown(text) {
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

module.exports = {
  fetchLatestNews,
  fetchFromSource,
  fetchFromSourceByName,
  formatArticle,
  RSS_SOURCES,
  RSS_SOURCE,
};
