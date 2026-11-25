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

/** 电量显示 deadband（百分点）：小于该变化沿用旧显示，压住 ±1% 抖动 */
const BATTERY_DISPLAY_DEADBAND = 2;

/**
 * 电量显示平滑：60s 轮询下设备可能每分钟 ±1% 抖动，小于 2 个百分点不刷新界面；
 * 未上报（null）立即清空，首轮（无旧值）直接用原始值。
 */
export function smoothBatteryDisplay(
  prevDisplay: number | null,
  nextRaw: number | null,
): number | null {
  if (nextRaw === null) return null;
  if (prevDisplay === null) return nextRaw;
  return Math.abs(nextRaw - prevDisplay) >= BATTERY_DISPLAY_DEADBAND
    ? nextRaw
    : prevDisplay;
}

/**
 * 充电态显示平滑：原始值要连续两轮一致才切换显示，压住插拔/协议抖动；
 * 首轮没有原始快照直接采用，未上报（null）立即清空。
 */
export function smoothChargingDisplay(
  prevDisplay: boolean | null,
  prevRaw: boolean | null,
  nextRaw: boolean | null,
): boolean | null {
  if (nextRaw === null) return null;
  if (prevRaw === null) return nextRaw;
  return nextRaw === prevRaw ? nextRaw : prevDisplay;
}

/** 卡片渲染签名用的最小字段集（只含真正影响界面的字段） */
export interface DeviceListSignatureItem {
  id: string;
  status?: "online" | "offline" | null;
  battery?: number | null;
  isCharging?: boolean | null;
  networkMode?: "wifi" | "4g" | null;
  networkBadge?: { text: string; level: 1 | 2 | 3 | null } | null;
  statusNotFound?: boolean;
  lastActiveText?: string;
  cardTitle?: string;
  cardSubtitle?: string;
  cardDesc?: string;
  statusLabel?: string;
  statusTone?: "online" | "offline";
  todayUsage?: DeviceTodayUsage | null;
}

/**
 * 设备列表渲染签名：轮询到点后先比签名，完全一致就不 setData，
 * 避免 60s 一次的无谓重渲染。strength/statusLoading 等中间态不参与。
 */
export function buildDeviceListSignature(
  items: DeviceListSignatureItem[],
): string {
  return JSON.stringify(
    items.map((item) => [
      item.id,
      item.status ?? null,
      item.battery ?? null,
      item.isCharging ?? null,
      item.networkMode ?? null,
      item.networkBadge
        ? [item.networkBadge.text, item.networkBadge.level]
        : null,
      item.statusNotFound ?? false,
      item.lastActiveText ?? "",
      item.cardTitle ?? "",
      item.cardSubtitle ?? "",
      item.cardDesc ?? "",
      item.statusLabel ?? "",
      item.statusTone ?? "",
      item.todayUsage
        ? [
            item.todayUsage.date,
            item.todayUsage.durationMinutes,
            item.todayUsage.turnCount,
          ]
        : null,
    ]),
  );
}
