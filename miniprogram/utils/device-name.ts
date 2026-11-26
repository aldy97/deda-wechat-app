/**
 * 设备/孩子的统一展示名：孩子中文名 > 英文名 > 设备名 > 兜底文案。
 * 首页与「更懂TA」的 dropdown、以及设备卡片标题都走这里，避免文案漂移。
 */

export interface DeviceNameSource {
  id?: string;
  name?: string | null;
  childProfile?: {
    name?: string | null;
    englishName?: string | null;
  } | null;
}

export function getDeviceDisplayName(
  device?: DeviceNameSource | null,
  fallback = "设备",
): string {
  if (!device) return fallback;
  const profile = device.childProfile;
  return profile?.name || profile?.englishName || device.name || fallback;
}
