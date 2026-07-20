// Word filter — reads from JSON file for hot-reload from dashboard
const fs = require('fs');
const path = require('path');

const FILTER_PATH = path.join(__dirname, '../../data/wordfilter.json');

// Default blocklist
const DEFAULT_WORDS = ['anjing', 'bangsat', 'kontol', 'memek', 'ngentot', 'babi', 'tolol', 'goblok', 'sange', 'vcs'];

// Create file if not exists
function ensureFilterFile() {
  const dir = path.dirname(FILTER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILTER_PATH)) {
    fs.writeFileSync(FILTER_PATH, JSON.stringify(DEFAULT_WORDS, null, 2));
  }
}

// Read words from file (with cache)
let cachedWords = null;
let lastModified = 0;

function getWords() {
  ensureFilterFile();
  try {
    const stat = fs.statSync(FILTER_PATH);
    if (cachedWords === null || stat.mtimeMs > lastModified) {
      cachedWords = JSON.parse(fs.readFileSync(FILTER_PATH, 'utf8'));
      lastModified = stat.mtimeMs;
    }
    return cachedWords;
  } catch (e) {
    return DEFAULT_WORDS;
  }
}

function containsBadWord(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const words = getWords();
  return words.some(word => lowerText.includes(word));
}

module.exports = {
  containsBadWord,
  getWords,
  FILTER_PATH
};
