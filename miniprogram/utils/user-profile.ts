import type { UserProfile } from "../api/api";

/** 家长档案缓存键 */
export const PROFILE_CACHE_KEY = "user_profile_cache";

/** 昵称上限（与服务端 PATCH /users/profile 校验一致） */
export const NICKNAME_MAX_LENGTH = 20;

function isUserProfile(value: any): value is UserProfile {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    (value.nickname === null || typeof value.nickname === "string") &&
    (value.phone === null || typeof value.phone === "string") &&
    typeof value.createdAt === "string" &&
    typeof value.deviceCount === "number" &&
    typeof value.childCount === "number"
  );
}

/**
 * 读取缓存档案；storage 异常、JSON 非法或结构不符时返回 null。
 */
export function readCachedProfile(): UserProfile | null {
  try {
    const raw = wx.getStorageSync(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return isUserProfile(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

/**
 * 写入缓存档案；失败静默（缓存只用于首屏加速）。
 */
export function writeCachedProfile(profile: UserProfile): void {
  try {
    wx.setStorageSync(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch (error) {
    // 缓存写入失败不影响主流程
  }
}

/** 资料卡主文案：优先昵称，未设置时给出空态文案。 */
export function profileDisplayName(
  nickname: string | null | undefined,
): string {
  return (nickname ?? "").trim() || "未设置昵称";
}

/** 资料卡副文案：设备数 · 孩子数，未绑定设备时单独提示。 */
export function profileMeta(deviceCount: number, childCount: number): string {
  if (!deviceCount || deviceCount <= 0) return "还没有绑定设备";
  const parts = [`${deviceCount} 台设备`];
  if (childCount > 0) parts.push(`${childCount} 个孩子`);
  return parts.join(" · ");
}

/** 无昵称即视为空档案（资料卡展示「去填写」）。 */
export function isProfileEmpty(profile: UserProfile | null): boolean {
  return !profile?.nickname?.trim();
}

/** 提交前的昵称归一化：去首尾空白并截断到上限。 */
export function normalizeNickname(raw: string): string {
  return (raw ?? "").trim().slice(0, NICKNAME_MAX_LENGTH);
}
