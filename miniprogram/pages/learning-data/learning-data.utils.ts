import {
  LearningStatsUnitProgress,
  LearningStatsTopic,
  LearningStatsDailyPoint,
} from "../../api/api";

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

/**
 * 自然历口径的天数（用于 daily?days=N）：
 * today=1；week=今日是本周第几天（周一=1 … 周日=7）；month=今日是本月几号。
 * now 可注入以便测试。
 */
export function getCalendarRangeDays(
  range: "today" | "week" | "month",
  now = new Date(),
): number {
  if (range === "today") return 1;
  if (range === "week") {
    // getDay(): 周日=0,周一=1…周六=6 → 周一为第 1 天
    return ((now.getDay() + 6) % 7) + 1;
  }
  return now.getDate();
}

export function formatTopicScore(score?: number | null): string {
  return score == null ? "--" : `${score}分`;
}

export interface WeeklyTrendBucket {
  /** 桶首末日期标签,如 9/1-9/7;单日桶为 M/D */
  label: string;
  durationMinutes: number;
  sessionCount: number;
}

/**
 * 把日粒度趋势（约 30 天,最早在前）聚合为 7 天一个的周桶。
 * 用于「本月」视图,避免 30 根柱与标签溢出。
 */
export function aggregateDailyToWeekly(
  points: LearningStatsDailyPoint[],
): WeeklyTrendBucket[] {
  const buckets: WeeklyTrendBucket[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const chunk = points.slice(i, i + 7);
    const first = chunk[0].date;
    const last = chunk[chunk.length - 1].date;
    buckets.push({
      label: first === last ? first : `${first}-${last}`,
      durationMinutes: chunk.reduce((sum, p) => sum + p.durationMinutes, 0),
      sessionCount: chunk.reduce((sum, p) => sum + p.sessionCount, 0),
    });
  }
  return buckets;
}

/**
 * 把数值序列按当前最大值（或参考上限）相对缩放为柱高（rpx）。
 * 零值给地板高度 4rpx,非零最小 8rpx 保证可见。
 */
export function scaleBarHeights(
  values: number[],
  maxHeightRpx: number,
  referenceMax: number,
): number[] {
  if (values.length === 0) return [];
  const dataMax = Math.max(...values, 0);
  // 数据超过参考上限时按数据最大值缩放,否则用参考上限
  const divisor = dataMax > referenceMax ? dataMax : referenceMax;
  return values.map((v) => {
    if (v <= 0) return 4;
    const h = Math.round((Math.min(v, divisor) / divisor) * maxHeightRpx);
    return Math.max(h, 8);
  });
}

export interface ContextOption {
  /** 'default' 或 `${textbookId}|${unitId}` 或 `free_chat|${conversationModeKey}` */
  key: string;
  label: string;
  /** 传给统计端点的显式语境参数;空对象 = 服务端按设备当前配置族默认 */
  params: {
    textbookId?: string;
    unitId?: string;
    mode?: string;
    conversationModeKey?: string;
  };
}

/**
 * 组装智能分析页的语境选择器选项。
 * 首项为「默认（当前配置）」;其后为全部练过的语境（topics 已是全量）。
 * 查看任何语境都是只读操作,不修改设备配置。
 */
export function buildContextOptions(
  topics: LearningStatsTopic[],
): ContextOption[] {
  const active = topics.find((t) => t.isActive);
  const activeLabel = active
    ? `当前（${topicContextLabel(active)}）`
    : "当前语境";

  const options: ContextOption[] = [
    { key: "default", label: activeLabel, params: {} },
  ];

  for (const t of topics) {
    if (t.mode === "free_chat") {
      options.push({
        key: `free_chat|${t.conversationModeKey}`,
        label: `自由对话 · ${t.conversationModeName ?? t.conversationModeKey}`,
        params: {
          mode: "free_chat",
          conversationModeKey: t.conversationModeKey ?? undefined,
        },
      });
    } else {
      options.push({
        key: `${t.textbookId}|${t.unitId}`,
        label: topicContextLabel(t),
        params: {
          textbookId: t.textbookId ?? undefined,
          unitId: t.unitId ?? undefined,
        },
      });
    }
  }

  return options;
}

function topicContextLabel(t: LearningStatsTopic): string {
  const textbook = t.textbookName ?? t.textbookId ?? "";
  const unit = t.unitName ?? t.unitId ?? "";
  return [textbook, unit].filter(Boolean).join(" · ");
}
