import { DeviceTodayUsage } from "../../api/api";

export interface CardCopy {
  title: string;
  subtitle: string;
  desc: string;
}

export interface StatusTagInput {
  status?: "online" | "offline";
  statusLoading?: boolean;
  statusNotFound?: boolean;
}

export interface StatusTag {
  label: string;
  tone: "online" | "offline";
}

/** 顶部状态标签：加载中不提前判离线，404 用设备不存在兜底 */
export function buildStatusTag(input: StatusTagInput): StatusTag {
  if (input.statusNotFound) {
    return { label: "设备不存在", tone: "offline" };
  }
  if (input.statusLoading) {
    return { label: "连接中", tone: "offline" };
  }
  if (input.status === "online") {
    return { label: "在线", tone: "online" };
  }
  return { label: "离线", tone: "offline" };
}

/** 分钟 → 卡片文案；整小时不展示 0 分钟 */
export function formatDurationMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe} 分钟`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`;
}

/** 本地日期键 YYYY-MM-DD，用于判断缓存里的今日数据是否跨天 */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 缓存中的 todayUsage 是否仍是「今天」的数据 */
export function isTodayUsageFresh(
  usage: DeviceTodayUsage | null | undefined,
  now: Date = new Date(),
): boolean {
  return !!usage && usage.date === localDateKey(now);
}

/**
 * 设备卡正文：只回答「孩子今天和 Elly 过得怎么样」。
 * 在线/离线/连接中/设备不存在都在卡片顶部展示，正文不再复述；
 * 没有今日数据时正文留空，由「最近活跃」行承担信息。
 */
export function buildCardCopy(todayUsage?: DeviceTodayUsage | null): CardCopy {
  if (!todayUsage) {
    return { title: "", subtitle: "", desc: "" };
  }

  if (todayUsage.turnCount > 0) {
    return {
      title: `今天陪伴 ${formatDurationMinutes(todayUsage.durationMinutes)}`,
      subtitle: `说了 ${todayUsage.turnCount} 句话`,
      desc: "",
    };
  }

  return { title: "今天还没和 Elly 聊天", subtitle: "", desc: "" };
}
