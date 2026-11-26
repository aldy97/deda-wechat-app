/**
 * 跨页「当前孩子」选择存储。
 *
 * 首页（设备）与「更懂TA」共用同一 key：任一页切换孩子，另一页下次进入
 * 或 onShow 时都落在同一台设备上。设备解绑后由 resolveSelectedDeviceId 兜底。
 */

export const SELECTED_DEVICE_KEY = "selected_device_id";

export function readSelectedDeviceId(): string {
  try {
    return String(wx.getStorageSync(SELECTED_DEVICE_KEY) || "");
  } catch (error) {
    return "";
  }
}

export function writeSelectedDeviceId(deviceId: string): void {
  try {
    if (deviceId) {
      wx.setStorageSync(SELECTED_DEVICE_KEY, deviceId);
    } else {
      wx.removeStorageSync(SELECTED_DEVICE_KEY);
    }
  } catch (error) {
    console.warn("[selected-device] 写入选择失败", error);
  }
}

/**
 * 解析当前应选中的设备：preferred 命中则沿用，否则落到第一台；
 * 空列表返回空串（页面按空态渲染）。
 */
export function resolveSelectedDeviceId(
  devices: ReadonlyArray<{ id: string }>,
  preferred?: string,
): string {
  if (!devices.length) return "";
  const target = preferred || "";
  return devices.some((device) => device.id === target)
    ? target
    : devices[0].id;
}
