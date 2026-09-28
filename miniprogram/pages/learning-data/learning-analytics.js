"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealthLevel = getHealthLevel;
exports.calculateHealthScore = calculateHealthScore;
exports.generateFallbackInsights = generateFallbackInsights;
exports.enrichDevicesWithStatus = enrichDevicesWithStatus;
exports.aggregateFamilyTrend = aggregateFamilyTrend;
const learning_data_utils_1 = require("./learning-data.utils");
const HEALTH_LEVELS = [
  { min: 85, level: "excellent" },
  { min: 70, level: "good" },
  { min: 55, level: "average" },
  { min: 0, level: "attention" },
];
function getHealthLevel(score) {
  const normalized = Math.max(0, Math.min(100, score));
  for (const item of HEALTH_LEVELS) {
    if (normalized >= item.min) {
      return item.level;
    }
  }
  return "attention";
}
/**
 * 计算学习健康度。
 * 当后端未提供 health 接口时，前端基于已有数据本地计算兜底。
 */
function calculateHealthScore(input) {
  const { dashboard, trend, topics, range } = input;
  // 活跃度：基于总时长和练习次数，按范围归一化
  const referenceDuration =
    range === "today" ? 30 : range === "week" ? 180 : 600;
  const activity = Math.min(
    100,
    Math.round((dashboard.totalDurationMinutes / referenceDuration) * 100),
  );
  // 坚持度：基于连续学习天和设备今日是否学习
  const todayMinutes = dashboard.devices.reduce(
    (sum, d) => sum + (d.todayDurationMinutes || 0),
    0,
  );
  const consistency = Math.min(
    100,
    Math.round(
      (Math.min(dashboard.continuousDays, 7) / 7) * 70 +
        (todayMinutes > 0 ? 30 : 0),
    ),
  );
  // 内容均衡度：基于主题分布的熵
  const balance = calculateBalanceScore(topics);
  // 互动深度：基于平均每次练习的轮数/时长
  const avgSessionDuration =
    dashboard.totalSessions > 0
      ? dashboard.totalDurationMinutes / dashboard.totalSessions
      : 0;
  const engagement = Math.min(100, Math.round((avgSessionDuration / 20) * 100));
  // 综合分：加权平均
  let score = Math.round(
    activity * 0.3 + consistency * 0.3 + balance * 0.2 + engagement * 0.2,
  );
  // 今天没有学习记录时，健康分上限为 54，强制触发 attention
  if (todayMinutes === 0) {
    score = Math.min(score, 54);
  }
  const level = getHealthLevel(score);
  const suggestion = buildHealthSuggestion(
    level,
    todayMinutes,
    dashboard.continuousDays,
  );
  return {
    score,
    level,
    dimensions: {
      activity,
      consistency,
      balance,
      engagement,
    },
    suggestion,
  };
}
function calculateBalanceScore(topics) {
  if (topics.length <= 1) return 100;
  const total = topics.reduce((sum, t) => sum + t.count, 0);
  if (total === 0) return 100;
  // 使用简化熵：主题占比越均匀分数越高
  const entropy = topics.reduce((sum, t) => {
    const p = t.count / total;
    return p > 0 ? sum - p * Math.log(p) : sum;
  }, 0);
  const maxEntropy = Math.log(topics.length);
  const ratio = maxEntropy > 0 ? entropy / maxEntropy : 1;
  return Math.round(ratio * 100);
}
function buildHealthSuggestion(level, todayMinutes, continuousDays) {
  if (todayMinutes === 0) {
    return "今天还没有学习记录，建议提醒孩子开始今天的练习。";
  }
  if (level === "excellent") {
    return `学习状态很棒，已连续学习 ${continuousDays} 天，继续保持！`;
  }
  if (level === "good") {
    return "学习状态良好，可以适当增加练习频次或尝试新主题。";
  }
  if (level === "average") {
    return "学习状态一般，建议制定固定学习计划，提升连续性。";
  }
  return "学习投入不足，建议关注孩子的学习时间和内容分布。";
}
/**
 * 当后端未提供 insights 接口时，前端基于已有数据生成兜底洞察。
 */
function generateFallbackInsights(input) {
  const { dashboard, trend, topics, range } = input;
  const insights = [];
  // 1. 里程碑：连续学习
  if (dashboard.continuousDays >= 3) {
    insights.push({
      id: "milestone-streak",
      type: "milestone",
      title: "坚持学习",
      content: `家庭已连续学习 ${dashboard.continuousDays} 天，再坚持一下就能养成好习惯！`,
      metricValue: dashboard.continuousDays,
      metricUnit: "天",
    });
  }
  // 2. 活跃度：本周/本月总时长
  if (dashboard.totalDurationMinutes > 0) {
    const rangeText =
      range === "today" ? "今天" : range === "week" ? "本周" : "本月";
    insights.push({
      id: "strength-activity",
      type: "strength",
      title: "学习活跃",
      content: `${rangeText}累计学习 ${dashboard.totalDurationMinutes} 分钟，共完成 ${dashboard.totalSessions} 次练习。`,
      metricValue: dashboard.totalDurationMinutes,
      metricUnit: "分钟",
    });
  }
  // 3. 设备级洞察
  dashboard.devices.forEach((device) => {
    if (device.status === "offline") {
      insights.push({
        id: `alert-offline-${device.deviceId}`,
        type: "alert",
        title: "设备离线",
        content: `${device.childName || device.deviceName} 的设备当前离线，请检查网络连接。`,
        deviceId: device.deviceId,
        deviceName: device.childName || device.deviceName,
      });
    }
    if (device.todayDurationMinutes === 0 && device.status !== "offline") {
      insights.push({
        id: `alert-no-today-${device.deviceId}`,
        type: "alert",
        title: "今日未学习",
        content: `${device.childName || device.deviceName} 今天还没有学习记录。`,
        deviceId: device.deviceId,
        deviceName: device.childName || device.deviceName,
      });
    }
  });
  // 4. 内容均衡度
  const balance = calculateBalanceScore(topics);
  if (topics.length > 1 && balance < 50) {
    const dominant = topics.reduce(
      (max, t) => (t.count > max.count ? t : max),
      topics[0],
    );
    insights.push({
      id: "weakness-balance",
      type: "weakness",
      title: "内容偏科",
      content: `${formatTopicName(dominant)} 占比过高，建议适当补充其他主题内容。`,
      metricValue: balance,
      metricUnit: "分",
    });
  }
  // 5. 趋势对比：本周 vs 上周（需要至少两周数据）
  if (trend.length >= 7) {
    const mid = Math.floor(trend.length / 2);
    const firstHalf = trend.slice(0, mid);
    const secondHalf = trend.slice(mid);
    const firstSum = firstHalf.reduce((s, p) => s + p.durationMinutes, 0);
    const secondSum = secondHalf.reduce((s, p) => s + p.durationMinutes, 0);
    if (firstSum > 0) {
      const change = Math.round(((secondSum - firstSum) / firstSum) * 100);
      if (Math.abs(change) >= 20) {
        insights.push({
          id: "suggestion-trend",
          type: change > 0 ? "strength" : "suggestion",
          title: "趋势变化",
          content:
            change > 0
              ? `学习时长较上半段增长 ${change}%，势头不错，继续保持。`
              : `学习时长较上半段下降 ${Math.abs(change)}%，建议关注学习安排。`,
          metricValue: change,
          metricUnit: "%",
        });
      }
    }
  }
  return insights.slice(0, 3);
}
function formatTopicName(topic) {
  return (
    topic.conversationModeName ||
    [topic.textbookName, topic.unitName].filter(Boolean).join(" · ") ||
    topic.mode
  );
}
/**
 * 用实时设备状态校正 dashboard 中的设备状态。
 * 纯函数，便于单元测试。
 */
function enrichDevicesWithStatus(devices, statusMap) {
  return devices.map((device) => {
    const status = statusMap[device.deviceId];
    if (!status) return device;
    return Object.assign(Object.assign({}, device), {
      status: status.status,
      battery: status.battery,
      isCharging: status.isCharging,
      lastActiveAt: status.lastActiveAt,
    });
  });
}
/**
 * 把日粒度趋势聚合为适合家庭总览的柱图数据。
 */
function aggregateFamilyTrend(daily, range) {
  if (daily.length === 0) return [];
  let buckets = [];
  if (range === "month") {
    buckets = (0, learning_data_utils_1.aggregateDailyToWeekly)(daily);
  } else {
    buckets = daily.map((p) => ({
      label: p.date,
      durationMinutes: p.durationMinutes,
      sessionCount: p.sessionCount,
    }));
  }
  const referenceMax = range === "today" ? 60 : range === "week" ? 120 : 300;
  const heights = (0, learning_data_utils_1.scaleBarHeights)(
    buckets.map((b) => b.durationMinutes),
    160,
    referenceMax,
  );
  return buckets.map((b, i) => ({
    label: b.label,
    value: b.durationMinutes,
    height: heights[i],
  }));
}
