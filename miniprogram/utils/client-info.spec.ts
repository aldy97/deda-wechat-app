import { reportClientInfo } from "../api/client-info";
import {
  CLIENT_INFO_TTL_MS,
  readClientBrand,
  reportClientInfoIfNeeded,
  shouldReportClientInfo,
} from "./client-info";

jest.mock("../api/client-info", () => ({ reportClientInfo: jest.fn() }));

const mockReport = reportClientInfo as jest.Mock;

interface StorageState {
  token?: string;
  client_info_brand?: string;
  client_info_reported_at?: number;
}

function installWx(storage: StorageState = {}): StorageState {
  const state: StorageState = { token: "jwt-token", ...storage };
  (globalThis as any).wx = {
    getDeviceInfo: jest.fn(() => ({ brand: " Apple " })),
    getStorageSync: jest.fn((key: keyof StorageState) => state[key] ?? ""),
    setStorageSync: jest.fn((key: keyof StorageState, value: unknown) => {
      (state as any)[key] = value;
    }),
  };
  return state;
}

describe("client-info", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReport.mockResolvedValue({
      code: 0,
      message: "success",
      data: { success: true, skipped: false },
    });
    installWx();
  });

  it("读取并 trim 品牌；接口异常返回 null", () => {
    expect(readClientBrand()).toBe("Apple");

    (globalThis as any).wx.getDeviceInfo = jest.fn(() => {
      throw new Error("boom");
    });
    expect(readClientBrand()).toBeNull();

    (globalThis as any).wx.getDeviceInfo = jest.fn(() => ({ brand: "  " }));
    expect(readClientBrand()).toBeNull();
  });

  it("节流判定：品牌变化立即上报，同品牌 7 天内跳过，过期补报", () => {
    const now = 1_000_000;
    expect(shouldReportClientInfo(null, "", 0, now)).toBe(false);
    expect(shouldReportClientInfo("Apple", "", 0, now)).toBe(true);
    expect(shouldReportClientInfo("Apple", "Apple", now, now)).toBe(false);
    expect(
      shouldReportClientInfo(
        "Apple",
        "Apple",
        now - CLIENT_INFO_TTL_MS + 1,
        now,
      ),
    ).toBe(false);
    expect(
      shouldReportClientInfo("Apple", "Apple", now - CLIENT_INFO_TTL_MS, now),
    ).toBe(true);
  });

  it("无 token 不上报，避免触发 401 重登录", async () => {
    installWx({ token: "" });

    await reportClientInfoIfNeeded(123);

    expect(mockReport).not.toHaveBeenCalled();
  });

  it("品牌变化立即上报并记录本地时间", async () => {
    const state = installWx();

    await reportClientInfoIfNeeded(123);

    expect(mockReport).toHaveBeenCalledWith({ brand: "Apple" });
    expect(state.client_info_brand).toBe("Apple");
    expect(state.client_info_reported_at).toBe(123);
  });

  it("同品牌 7 天内跳过，过期补报", async () => {
    installWx({
      client_info_brand: "Apple",
      client_info_reported_at: 1000,
    });

    await reportClientInfoIfNeeded(1000 + CLIENT_INFO_TTL_MS - 1);
    expect(mockReport).not.toHaveBeenCalled();

    await reportClientInfoIfNeeded(1000 + CLIENT_INFO_TTL_MS);
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it("上报失败只 warn，不更新本地记录、不抛错", async () => {
    const state = installWx();
    mockReport.mockRejectedValueOnce(new Error("network down"));
    const warn = jest.spyOn(console, "warn").mockImplementation();

    await expect(reportClientInfoIfNeeded(456)).resolves.toBeUndefined();

    expect(state.client_info_brand).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("并发调用只发一次请求", async () => {
    let resolveReport: (value: unknown) => void = () => undefined;
    mockReport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReport = resolve;
        }),
    );

    const first = reportClientInfoIfNeeded(789);
    const second = reportClientInfoIfNeeded(790);
    expect(mockReport).toHaveBeenCalledTimes(1);

    resolveReport({
      code: 0,
      message: "success",
      data: { success: true, skipped: false },
    });
    await Promise.all([first, second]);
    expect(mockReport).toHaveBeenCalledTimes(1);
  });
});
