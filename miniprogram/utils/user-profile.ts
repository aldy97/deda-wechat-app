import type { UserProfile } from "../api/api";

/** 家长档案缓存键 */
export const PROFILE_CACHE_KEY = "user_profile_cache";

/** 昵称上限（wechat-app 前端约束 10 字；服务端仍按 1–20 字兼容旧数据） */
export const NICKNAME_MAX_LENGTH = 10;

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.id === "string" &&
    (profile.nickname === null || typeof profile.nickname === "string") &&
    (profile.phone === null || typeof profile.phone === "string") &&
    (profile.gender === undefined ||
      profile.gender === null ||
      profile.gender === "male" ||
      profile.gender === "female") &&
    (profile.birthday === undefined ||
      profile.birthday === null ||
      typeof profile.birthday === "string") &&
    typeof profile.createdAt === "string" &&
    typeof profile.deviceCount === "number" &&
    typeof profile.childCount === "number"
  );
}

/**
 * 读取缓存档案；storage 异常、JSON 非法或结构不符时返回 null。
 * 旧版本缓存没有 gender/birthday，读取时归一成 null，避免升级后整份缓存失效。
 */
export function readCachedProfile(): UserProfile | null {
  try {
    const raw = wx.getStorageSync(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!isUserProfile(parsed)) return null;
    return {
      ...parsed,
      gender: parsed.gender ?? null,
      birthday: parsed.birthday ?? null,
    };
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
