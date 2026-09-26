import { LearningStatsUnitProgress, LearningStatsTopic } from "../../api/api";

export interface TextbookUnitProgress {
  textbookId: string;
  textbookName: string;
  units: LearningStatsUnitProgress[];
}

export function groupUnitProgressByTextbook(
  items: LearningStatsUnitProgress[],
): TextbookUnitProgress[] {
  const map = new Map<string, TextbookUnitProgress>();

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

export function formatTopicDisplayName(topic: LearningStatsTopic): string {
  const main = topic.conversationModeName || topic.textbookName || topic.mode;
  return topic.unitName ? `${main} · ${topic.unitName}` : main;
}

export function getRangeDays(range: "today" | "week" | "month"): number {
  const map: Record<typeof range, number> = {
    today: 1,
    week: 7,
    month: 30,
  };
  return map[range];
}

export function formatTopicScore(score?: number | null): string {
  return score == null ? "--" : `${score}分`;
}
