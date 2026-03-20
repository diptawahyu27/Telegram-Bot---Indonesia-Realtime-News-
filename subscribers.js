// ============================================================
//  subscribers.js — Persistent subscriber list (JSON file)
// ============================================================

const fs   = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "subscribers.json");

// ── Internal state ────────────────────────────────────────────
let subscribers = new Set();

// ── Load from disk on startup ─────────────────────────────────
function loadSubscribers() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw  = fs.readFileSync(DATA_FILE, "utf8");
      const list = JSON.parse(raw);
      subscribers = new Set(list);
      console.log(`📂  Loaded ${subscribers.size} subscriber(s) from disk.`);
    } else {
      console.log("📂  No subscribers file found — starting fresh.");
    }
  } catch (err) {
    console.error("❌  Could not load subscribers.json:", err.message);
    subscribers = new Set();
  }
}

// ── Persist to disk ───────────────────────────────────────────
function saveSubscribers() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify([...subscribers], null, 2), "utf8");
  } catch (err) {
    console.error("❌  Could not save subscribers.json:", err.message);
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Add a chat ID to the subscriber list.
 * @param {number|string} chatId
 * @returns {{ added: boolean }}
 */
function addSubscriber(chatId) {
  const id = String(chatId);
  if (subscribers.has(id)) return { added: false };
  subscribers.add(id);
  saveSubscribers();
  console.log(`✅  Subscribed: ${id}  (total: ${subscribers.size})`);
  return { added: true };
}

/**
 * Remove a chat ID from the subscriber list.
 * @param {number|string} chatId
 * @returns {{ removed: boolean }}
 */
function removeSubscriber(chatId) {
  const id = String(chatId);
  if (!subscribers.has(id)) return { removed: false };
  subscribers.delete(id);
  saveSubscribers();
  console.log(`👋  Unsubscribed: ${id}  (total: ${subscribers.size})`);
  return { removed: true };
}

/**
 * Return all current subscriber IDs as an array.
 * @returns {string[]}
 */
function getAllSubscribers() {
  return [...subscribers];
}

// Load existing subscribers when module is first imported
loadSubscribers();

module.exports = { loadSubscribers, addSubscriber, removeSubscriber, getAllSubscribers };
