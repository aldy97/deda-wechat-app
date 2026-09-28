"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupUnitProgressByTextbook = groupUnitProgressByTextbook;
exports.formatTopicDisplayName = formatTopicDisplayName;
exports.getRangeDays = getRangeDays;
exports.formatTopicScore = formatTopicScore;
function groupUnitProgressByTextbook(items) {
  const map = new Map();
  for (const item of items) {
    const existing = map.get(item.textbookId);
    if (existing) {
      existing.units.push(item);
    } else {
      map.set(item.textbookId, {
        textbookId: item.textbookId,
        textbookName: item.textbookName,
        units: [item],
      });
    }
  }
  return Array.from(map.values());
}
function formatTopicDisplayName(topic) {
  const main = topic.conversationModeName || topic.textbookName || topic.mode;
  return topic.unitName ? `${main} · ${topic.unitName}` : main;
}
function getRangeDays(range) {
  const map = {
    today: 1,
    week: 7,
    month: 30,
  };
  return map[range];
}
function formatTopicScore(score) {
  return score == null ? "--" : `${score}分`;
}
