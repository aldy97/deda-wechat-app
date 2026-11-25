import { DeviceTodayUsage } from "../../api/api";

export interface CardCopyInput {
  status?: "online" | "offline";
  statusLoading?: boolean;
  statusNotFound?: boolean;
  todayUsage?: DeviceTodayUsage | null;
}

export interface CardCopy {
  title: string;
  subtitle: string;
  desc: string;
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
 * 设备卡正文：优先回答「孩子今天和 Elly 过得怎么样」，
 * 数据缺失时退回设备状态文案，不展示模式与固定营销句。
 */
export function buildCardCopy(input: CardCopyInput): CardCopy {
  const { status, statusLoading, statusNotFound, todayUsage } = input;

  if (statusNotFound) {
    return {
      title: "设备信息暂时不可用",
      subtitle: "",
      desc: "下拉刷新试试，或重新绑定这台设备。",
    };
  }

  const offline = !statusLoading && status === "offline";
  const turnCount = todayUsage?.turnCount ?? 0;

  if (todayUsage && turnCount > 0) {
    return {
      title: `今天陪伴 ${formatDurationMinutes(todayUsage.durationMinutes)}`,
      subtitle: `说了 ${turnCount} 句话`,
      desc: offline ? "Elly 现在不在线，检查网络后就能继续聊。" : "",
    };
  }

  if (todayUsage && turnCount === 0) {
    if (offline) {
      return {
        title: "Elly 现在不在线",
        subtitle: "",
        desc: "检查网络后就能和 Elly 开始今天的第一次聊天。",
      };
    }
    return {
      title: "今天还没和 Elly 聊天",
      subtitle: "",
      desc: "说一句「你好 Elly」就能开始。",
    };
  }

  if (offline) {
    return {
      title: "Elly 现在不在线",
      subtitle: "",
      desc: "检查网络或重新联网后就能继续聊。",
    };
  }

  if (statusLoading) {
    return { title: "正在连接 Elly…", subtitle: "", desc: "" };
  }

  if (status === "online") {
    return { title: "Elly 在线", subtitle: "", desc: "随时可以开始聊天。" };
  }

  return { title: "Elly", subtitle: "", desc: "下拉刷新获取设备状态。" };
}
