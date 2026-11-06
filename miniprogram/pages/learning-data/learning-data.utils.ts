import {
  LearningStatsDailyPoint,
  LearningStatsTimelineEvent,
} from "../../api/api";

/**
 * 使用最大余数法分配整数百分比：先取整数下限，再按小数余数从大到小
 * 补齐剩余百分点。余数相同时按原始顺序分配，确保结果稳定且合计为 100。
 */
export function allocateIntegerPercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) return counts.map(() => 0);

  const allocations = counts.map((count, index) => {
    const exactPercent = (count / total) * 100;
    const percent = Math.floor(exactPercent);
    return {
      index,
      percent,
      remainder: exactPercent - percent,
    };
  });
  const remaining =
    100 - allocations.reduce((sum, item) => sum + item.percent, 0);
  const byRemainder = [...allocations].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );

  for (let index = 0; index < remaining; index += 1) {
    byRemainder[index].percent += 1;
  }
  return allocations.map((item) => item.percent);
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

export interface TrendSeries {
  deviceId: string;
  deviceName: string;
  color: string;
  values: number[];
  heights: number[];
}

export interface MultiDeviceTrend {
  labels: string[];
  series: TrendSeries[];
  maxValue: number;
}

const TREND_COLORS = [
  "var(--color-trend-1)",
  "var(--color-trend-2)",
  "var(--color-trend-3)",
  "var(--color-trend-4)",
  "var(--color-trend-5)",
  "var(--color-trend-6)",
];

function sortDateLabels(a: string, b: string): number {
  const [aMonth, aDay] = a.split("/").map(Number);
  const [bMonth, bDay] = b.split("/").map(Number);
  if (aMonth !== bMonth) return aMonth - bMonth;
  return aDay - bDay;
}

/**
 * 把多个设备的日粒度趋势合并为多系列趋势数据。
 * 所有设备共享同一组 labels（取并集，按时间正序）。
 * 缺失的日期补 0，保证各 series.values 长度一致。
 */
export function aggregateMultiDeviceTrend(
  deviceTrends: Array<{
    deviceId: string;
    deviceName: string;
    points: LearningStatsDailyPoint[];
  }>,
  range: "today" | "week" | "month",
): MultiDeviceTrend {
  if (deviceTrends.length === 0) {
    return { labels: [], series: [], maxValue: 0 };
  }

  // 收集所有日期并按自然历排序（M/D 格式）
  const dateSet = new Set<string>();
  for (const dt of deviceTrends) {
    for (const p of dt.points) {
      dateSet.add(p.date);
    }
  }
  const labels = Array.from(dateSet).sort(sortDateLabels);

  // 月视图：把日粒度聚合为周桶
  if (range === "month" && labels.length > 7) {
    return aggregateMultiDeviceTrendToWeekly(deviceTrends);
  }

  const referenceMax = range === "today" ? 60 : range === "week" ? 120 : 300;
  const series: TrendSeries[] = deviceTrends.map((dt, index) => {
    const valueMap = new Map(dt.points.map((p) => [p.date, p.durationMinutes]));
    const values = labels.map((label) => valueMap.get(label) || 0);
    const dataMax = Math.max(...values, 0);
    const divisor = dataMax > referenceMax ? dataMax : referenceMax;
    const heights = values.map((v) => {
      if (v <= 0) return 4;
      const h = Math.round((Math.min(v, divisor) / divisor) * 160);
      return Math.max(h, 8);
    });
    return {
      deviceId: dt.deviceId,
      deviceName: dt.deviceName,
      color: TREND_COLORS[index % TREND_COLORS.length],
      values,
      heights,
    };
  });

  const allValues = series.reduce(
    (sum: number[], s: TrendSeries) => sum.concat(s.values),
    [],
  );
  const maxValue = Math.max(...allValues, referenceMax);

  return { labels, series, maxValue };
}

function aggregateMultiDeviceTrendToWeekly(
  deviceTrends: Array<{
    deviceId: string;
    deviceName: string;
    points: LearningStatsDailyPoint[];
  }>,
): MultiDeviceTrend {
  // 先按日合并，再统一分桶
  const dateSet = new Set<string>();
  for (const dt of deviceTrends) {
    for (const p of dt.points) dateSet.add(p.date);
  }
  const sortedDates = Array.from(dateSet).sort(sortDateLabels);
  if (sortedDates.length === 0) {
    return { labels: [], series: [], maxValue: 0 };
  }

  const weeklyLabels: string[] = [];
  for (let i = 0; i < sortedDates.length; i += 7) {
    const chunk = sortedDates.slice(i, i + 7);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    weeklyLabels.push(first === last ? first : `${first}-${last}`);
  }

  const referenceMax = 300;
  const series: TrendSeries[] = deviceTrends.map((dt, index) => {
    const valueMap = new Map(dt.points.map((p) => [p.date, p.durationMinutes]));
    const values: number[] = [];
    for (let i = 0; i < sortedDates.length; i += 7) {
      const chunk = sortedDates.slice(i, i + 7);
      values.push(
        chunk.reduce((sum, date) => sum + (valueMap.get(date) || 0), 0),
      );
    }
    const dataMax = Math.max(...values, 0);
    const divisor = dataMax > referenceMax ? dataMax : referenceMax;
    const heights = values.map((v) => {
      if (v <= 0) return 4;
      const h = Math.round((Math.min(v, divisor) / divisor) * 160);
      return Math.max(h, 8);
    });
    return {
      deviceId: dt.deviceId,
      deviceName: dt.deviceName,
      color: TREND_COLORS[index % TREND_COLORS.length],
      values,
      heights,
    };
  });

  const allValues = series.reduce(
    (sum: number[], s: TrendSeries) => sum.concat(s.values),
    [],
  );
  const maxValue = Math.max(...allValues, referenceMax);

  return { labels: weeklyLabels, series, maxValue };
}

export interface TimelineDeviceGroup {
  deviceId: string;
  deviceName: string;
  childName?: string | null;
  childEnglishName?: string | null;
  totalDurationMinutes: number;
  events: LearningStatsTimelineEvent[];
  expanded: boolean;
}

export interface TimelineDayGroup {
  date: string;
  displayDate: string;
  devices: TimelineDeviceGroup[];
}

/**
 * 把扁平时间线按日期 + 设备分组。
 * 同一设备同一天的事件聚合为一个可折叠的卡片。
 */
export function groupTimelineByDayAndDevice(
  items: LearningStatsTimelineEvent[],
): TimelineDayGroup[] {
  if (!items || items.length === 0) return [];

  const dayMap = new Map<string, Map<string, TimelineDeviceGroup>>();

  for (const item of items) {
    const date = item.createdAt.slice(0, 10);
    let deviceMap = dayMap.get(date);
    if (!deviceMap) {
      deviceMap = new Map<string, TimelineDeviceGroup>();
      dayMap.set(date, deviceMap);
    }

    let group = deviceMap.get(item.deviceId);
    if (!group) {
      group = {
        deviceId: item.deviceId,
        deviceName: item.deviceName,
        totalDurationMinutes: 0,
        events: [],
        expanded: true,
      };
      deviceMap.set(item.deviceId, group);
    }

    group.events.push(item);
    // 后端目前未返回单条时长，先用 0.5 分钟/轮估算，后续可替换为真实值
    group.totalDurationMinutes += 0.5;
  }

  const sortedDays = Array.from(dayMap.keys()).sort().reverse();
  return sortedDays.map((date) => {
    const deviceMap = dayMap.get(date)!;
    const devices = Array.from(deviceMap.values()).map((g) => ({
      ...g,
      totalDurationMinutes: Math.round(g.totalDurationMinutes),
    }));
    return {
      date,
      displayDate: formatTimelineDisplayDate(date),
      devices,
    };
  });
}

function formatTimelineDisplayDate(dateStr: string): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const d = new Date(dateStr);
  const fmt = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  if (fmt(d) === fmt(today)) return "今天";
  if (fmt(d) === fmt(yesterday)) return "昨天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
