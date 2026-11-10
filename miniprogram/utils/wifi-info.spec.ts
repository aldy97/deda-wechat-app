/**
 * wifi-info 单测。
 *
 * 锁定 iOS 已知顽疾的兜底：wx.getConnectedWifi 在定位权限/系统状态异常时
 * 可能既不 success 也不 fail（真机表现为流程卡死在「连接中」），
 * getCurrentWifi 必须在超时后 reject，绝不永远挂起。
 */
import { getCurrentWifi } from "./wifi-info";

describe("getCurrentWifi", () => {
  const originalWx = (globalThis as any).wx;

  afterEach(() => {
    (globalThis as any).wx = originalWx;
  });

  it("正常返回当前 WiFi 的 SSID 与加密标记", async () => {
    (globalThis as any).wx = {
      startWifi: (opt: any) => opt.success({}),
      getConnectedWifi: (opt: any) =>
        opt.success({ wifi: { SSID: "Home_WiFi", secure: true } }),
    };
    await expect(getCurrentWifi()).resolves.toEqual({
      ssid: "Home_WiFi",
      secure: true,
    });
  });

  it("getConnectedWifi 永不回调（iOS 异常）：超时后 reject，不永远挂起", async () => {
    jest.useFakeTimers();
    try {
      (globalThis as any).wx = {
        startWifi: (opt: any) => opt.success({}),
        getConnectedWifi: () => {}, // 永不回调
      };
      const promise = getCurrentWifi();
      const assertion = expect(promise).rejects.toThrow("超时");
      await jest.advanceTimersByTimeAsync(8000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it("getConnectedWifi fail：转换为可读文案", async () => {
    (globalThis as any).wx = {
      startWifi: (opt: any) => opt.success({}),
      getConnectedWifi: (opt: any) =>
        opt.fail({ errCode: 12006, errMsg: "getConnectedWifi:fail" }),
    };
    await expect(getCurrentWifi()).rejects.toThrow("定位");
  });
});
