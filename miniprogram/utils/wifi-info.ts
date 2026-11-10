/**
 * 获取手机当前连接的 WiFi 信息（配网时锁定为该网络）。
 *
 * 前置条件：
 * - app.json 已声明 permission.scope.userLocation；
 * - 用户已授权位置权限（iOS 还需系统定位开启）；
 * - Android 需开启系统定位服务，否则 wx.getConnectedWifi 失败。
 */

export interface CurrentWifi {
  ssid: string;
  /** 是否加密网络；开放网络密码允许为空 */
  secure: boolean;
}

function promisify<T>(fn: (option: any) => void, option: any): Promise<T> {
  return new Promise((resolve, reject) => {
    fn({
      ...option,
      success: (res: T) => resolve(res),
      fail: (err: any) => reject(err),
    });
  });
}

/** wx WiFi 错误码 → 用户可读文案 */
function describeWifiError(err: any): string {
  const code = err?.errCode;
  const msg: string = err?.errMsg || "";
  if (msg.includes("auth") || msg.includes("authorize")) {
    return "需要位置权限才能读取当前 WiFi，请在设置中允许";
  }
  switch (code) {
    case 12000:
      return "WiFi 模块未初始化，请重试";
    case 12001:
      return "手机 WiFi 未开启，请开启后重试";
    case 12005:
      return "手机 WiFi 未开启，请开启后重试";
    case 12006:
      return "请开启手机定位服务后重试";
    case 12010:
      return "系统繁忙，请稍后重试";
    default:
      return "读取当前 WiFi 失败，请确认手机已连接 2.4GHz WiFi";
  }
}

/**
 * 读取手机当前连接的 WiFi。
 * 失败抛出带用户文案的 Error；SSID 为空（隐藏网络等）也视为失败。
 */
export async function getCurrentWifi(): Promise<CurrentWifi> {
  try {
    // 重复调用 startWifi 在部分平台返回失败，属正常，忽略
    await promisify(wx.startWifi, {}).catch(() => {});
    const res = await promisify<any>(wx.getConnectedWifi, {});
    const ssid: string = res?.wifi?.SSID || "";
    if (!ssid) {
      throw new Error("未读取到当前 WiFi 名称，请确认手机已连接 WiFi");
    }
    return { ssid, secure: !!res?.wifi?.secure };
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(describeWifiError(err));
  }
}
