// Simple blocklist.
const blocklist = [
  'anjing', 'bangsat', 'kontol', 'memek', 'ngentot', 'babi',
  'tolol', 'goblok'
];

function containsBadWord(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return blocklist.some(word => lowerText.includes(word));
}

module.exports = {
  containsBadWord
};
