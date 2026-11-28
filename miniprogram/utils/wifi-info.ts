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

/** 从 unknown 错误对象上读一个字段 */
function readErrorField(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? (source as Record<string, unknown>)[key]
    : undefined;
}

interface WxCallback<T> {
  success: (res: T) => void;
  fail: (err: unknown) => void;
}

/** wx 回调风格 API → Promise（字段类型仍由微信 typings 校验） */
function callWx<T = unknown>(
  run: (callback: WxCallback<T>) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    run({ success: resolve, fail: reject });
  });
}

/** wx WiFi 错误码 → 用户可读文案 */
function describeWifiError(err: unknown): string {
  const rawCode = readErrorField(err, "errCode");
  const code = typeof rawCode === "number" ? rawCode : undefined;
  const rawMsg = readErrorField(err, "errMsg");
  const msg = typeof rawMsg === "string" ? rawMsg : "";
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
 *
 * iOS 已知顽疾：定位权限/系统状态异常时 wx.getConnectedWifi 可能
 * 既不 success 也不 fail，Promise 永不 settle（真机表现为流程卡死）。
 * 因此强制超时兜底，超时后由调用方降级处理。
 */
const WIFI_READ_TIMEOUT_MS = 8000;

export async function getCurrentWifi(
  timeoutMs: number = WIFI_READ_TIMEOUT_MS,
): Promise<CurrentWifi> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("读取当前 WiFi 超时，请手动输入")),
      timeoutMs,
    );
  });
  const task = (async (): Promise<CurrentWifi> => {
    // 重复调用 startWifi 在部分平台返回失败，属正常，忽略
    await callWx((cb) => wx.startWifi(cb)).catch(() => {});
    const res =
      await callWx<WechatMiniprogram.GetConnectedWifiSuccessCallbackResult>(
        (cb) => wx.getConnectedWifi(cb),
      );
    const ssid: string = res?.wifi?.SSID || "";
    if (!ssid) {
      throw new Error("未读取到当前 WiFi 名称，请确认手机已连接 WiFi");
    }
    return { ssid, secure: !!res?.wifi?.secure };
  })();
  // 超时判负后底层回调若再抵达，吞掉避免 unhandled rejection
  task.catch(() => {});
  try {
    return await Promise.race([task, timeout]);
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(describeWifiError(err));
  } finally {
    if (timer) clearTimeout(timer);
  }
}
