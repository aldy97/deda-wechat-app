/**
 * 性别归一化唯一口径：兼容旧数据里的 m/f、男/女与大小写。
 *
 * use case：孩子档案与家长档案的性别枚举同口径（male / female）。
 * 「我的 → 用户信息」页的家长性别直接复用本函数，不要另起一套 normalize。
 */
export type NormalizedChildGender = "male" | "female";

export function normalizeChildGender(
  gender?: string | null,
): NormalizedChildGender | null {
  const normalized = gender?.trim().toLowerCase();
  if (normalized === "male" || normalized === "m" || normalized === "男") {
    return "male";
  }
  if (normalized === "female" || normalized === "f" || normalized === "女") {
    return "female";
  }
  return null;
}
