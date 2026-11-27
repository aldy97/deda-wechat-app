/** 性别归一化唯一口径：兼容旧数据里的 m/f、男/女与大小写。 */
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
