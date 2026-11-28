import {
  APP_ASSETS_STORAGE_KEY,
  APP_ASSETS_TTL_MS,
  forceRefreshAppAssets,
  loadAppAssets,
  resetAppAssetsForTest,
  resolveAppAsset,
  takeMissHealChance,
} from "./app-assets";
import { request } from "./request";

jest.mock("./request", () => ({ request: jest.fn() }));

const mockRequest = request as jest.Mock;

const VALID_MANIFEST = {
  version: "v1",
  assets: {
    "diagnostics/remote-probe": {
      url: "https://cdn.example.com/remote-probe.png",
    },
  },
};

const VALID_ENVELOPE = { code: 0, message: "", data: VALID_MANIFEST };

describe("app-assets", () => {
  let wxStorage: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-25T00:00:00.000Z"));
    jest.clearAllMocks();
    mockRequest.mockReset();
    mockRequest.mockResolvedValue(VALID_ENVELOPE);

    wxStorage = {
      getStorageSync: jest.fn().mockReturnValue(""),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn(),
    };
    (globalThis as any).wx = wxStorage;

    resetAppAssetsForTest();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("loadAppAssets 缓存与兜底", () => {
    it("无缓存且请求成功：写入内存与 storage 缓存，resolveAppAsset 命中", async () => {
      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
      expect(mockRequest).toHaveBeenCalledWith({
        method: "GET",
        url: "/app-assets/manifest",
      });
      expect(wxStorage.setStorageSync).toHaveBeenCalledWith(
        APP_ASSETS_STORAGE_KEY,
        expect.stringContaining(
          VALID_MANIFEST.assets["diagnostics/remote-probe"].url,
        ),
      );
      expect(resolveAppAsset("diagnostics/remote-probe")).toEqual({
        url: "https://cdn.example.com/remote-probe.png",
      });
    });

    it("无缓存且请求失败（业务失败）：reject", async () => {
      mockRequest.mockRejectedValue(new Error("business error"));
      await expect(loadAppAssets()).rejects.toThrow("business error");
    });

    it("无缓存且 HTTP 失败：reject", async () => {
      mockRequest.mockRejectedValue(
        Object.assign(new Error("HTTP 500"), { statusCode: 500 }),
      );
      await expect(loadAppAssets()).rejects.toThrow("HTTP 500");
    });

    it("无缓存且请求超时：reject", async () => {
      mockRequest.mockReturnValue(new Promise(() => {}));
      const promise = loadAppAssets();
      jest.advanceTimersByTime(5000);
      await expect(promise).rejects.toThrow("App assets manifest timeout");
    });

    it("并发调用共享同一个 in-flight Promise", async () => {
      let resolveRequest: (value: any) => void = () => {};
      mockRequest.mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
      );

      const first = loadAppAssets();
      const second = loadAppAssets();

      expect(first).toBe(second);
      expect(mockRequest).toHaveBeenCalledTimes(1);

      resolveRequest(VALID_ENVELOPE);
      await expect(first).resolves.toEqual(VALID_MANIFEST);
    });

    it("内存缓存未过期：直接返回，不重复请求", async () => {
      await loadAppAssets();
      mockRequest.mockClear();

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it("storage 缓存未过期：回填内存并直接返回", async () => {
      wxStorage.getStorageSync.mockReturnValue({
        manifest: VALID_MANIFEST,
        cachedAt: Date.now() - 1000,
      });

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
      expect(mockRequest).not.toHaveBeenCalled();
      expect(resolveAppAsset("diagnostics/remote-probe")).toEqual({
        url: "https://cdn.example.com/remote-probe.png",
      });
    });

    it("过期内存缓存 + 请求失败：回退旧内存缓存", async () => {
      await loadAppAssets();
      jest.advanceTimersByTime(APP_ASSETS_TTL_MS + 1000);
      mockRequest.mockRejectedValue(new Error("network down"));

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
    });

    it("过期 storage 缓存（内存空）+ 请求失败：回退旧 storage 缓存", async () => {
      wxStorage.getStorageSync.mockReturnValue({
        manifest: VALID_MANIFEST,
        cachedAt: Date.now() - APP_ASSETS_TTL_MS - 1000,
      });
      mockRequest.mockRejectedValue(new Error("network down"));

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
      expect(resolveAppAsset("diagnostics/remote-probe")).toEqual({
        url: "https://cdn.example.com/remote-probe.png",
      });
    });

    it("内存过期但存在 + persisted 存在时请求失败：优先回退内存", async () => {
      await loadAppAssets();
      jest.advanceTimersByTime(APP_ASSETS_TTL_MS + 1000);
      wxStorage.getStorageSync.mockReturnValue({
        manifest: { version: "stale", assets: {} },
        cachedAt: Date.now() - 1000,
      });
      mockRequest.mockRejectedValue(new Error("network down"));

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
    });

    it("空 manifest（assets 为空对象）：resolveAppAsset 返回 null", async () => {
      mockRequest.mockResolvedValue({
        code: 0,
        message: "",
        data: { version: "", assets: {} },
      });

      await loadAppAssets();
      expect(resolveAppAsset("diagnostics/remote-probe")).toBeNull();
    });
  });

  describe("normalizeManifest 非法结构兜底", () => {
    const cases: Array<[string, any]> = [
      ["data 为 null", null],
      ["data 为字符串", "garbage"],
      ["assets 为数组", { version: "v1", assets: [] }],
      ["assets 为 null", { version: "v1", assets: null }],
      ["assets 为字符串", { version: "v1", assets: "x" }],
    ];

    it.each(cases)("%s：无缓存时 reject", async (_name, data) => {
      mockRequest.mockResolvedValue({ code: 0, message: "", data });

      await expect(loadAppAssets()).rejects.toThrow(
        "App assets manifest invalid",
      );
    });

    it("非法 entry 被丢弃，仅保留合法 entry；version 缺失回退为空串", async () => {
      mockRequest.mockResolvedValue({
        code: 0,
        message: "",
        data: {
          assets: {
            valid: { url: "https://cdn.example.com/ok.png" },
            nullEntry: null,
            stringEntry: "not-an-object",
            urlNotString: { url: 123 },
            urlEmpty: { url: "   " },
          },
        },
      });

      const manifest = await loadAppAssets();
      expect(manifest.version).toBe("");
      expect(resolveAppAsset("valid")).toEqual({
        url: "https://cdn.example.com/ok.png",
      });
      expect(resolveAppAsset("nullEntry")).toBeNull();
      expect(resolveAppAsset("stringEntry")).toBeNull();
      expect(resolveAppAsset("urlNotString")).toBeNull();
      expect(resolveAppAsset("urlEmpty")).toBeNull();
    });
  });

  describe("storage 读写异常兜底", () => {
    it("getStorageSync 抛错：按无缓存处理，请求成功后写入内存", async () => {
      wxStorage.getStorageSync.mockImplementation(() => {
        throw new Error("storage read fail");
      });

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
      expect(resolveAppAsset("diagnostics/remote-probe")).not.toBeNull();
    });

    it("getStorageSync 返回 JSON 字符串：可正常解析为未过期缓存", async () => {
      wxStorage.getStorageSync.mockReturnValue(
        JSON.stringify({
          manifest: VALID_MANIFEST,
          cachedAt: Date.now() - 1000,
        }),
      );

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it("getStorageSync 返回损坏 JSON 字符串：按无缓存处理", async () => {
      wxStorage.getStorageSync.mockReturnValue("{not-json");
      mockRequest.mockResolvedValue(VALID_ENVELOPE);

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
    });

    it("getStorageSync 返回非对象 JSON：按无缓存处理", async () => {
      wxStorage.getStorageSync.mockReturnValue("123");
      mockRequest.mockResolvedValue(VALID_ENVELOPE);

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
    });

    it("getStorageSync 返回 manifest 为 null：按无缓存处理", async () => {
      wxStorage.getStorageSync.mockReturnValue({ manifest: null, cachedAt: 0 });
      mockRequest.mockResolvedValue(VALID_ENVELOPE);

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
    });

    it("getStorageSync 返回 cachedAt 非数字：按过期处理并回退旧缓存", async () => {
      wxStorage.getStorageSync.mockReturnValue({
        manifest: VALID_MANIFEST,
        cachedAt: "not-a-number",
      });
      mockRequest.mockRejectedValue(new Error("network down"));

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
    });

    it("setStorageSync 抛错：内存缓存仍然生效，请求成功", async () => {
      wxStorage.setStorageSync.mockImplementation(() => {
        throw new Error("storage write fail");
      });

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
      expect(resolveAppAsset("diagnostics/remote-probe")).toEqual({
        url: "https://cdn.example.com/remote-probe.png",
      });
    });

    it("非微信环境（wx 未定义）：storage 读写按抛错兜底，请求成功仍可解析", async () => {
      (globalThis as any).wx = undefined;

      await expect(loadAppAssets()).resolves.toEqual(VALID_MANIFEST);
      expect(resolveAppAsset("diagnostics/remote-probe")).toEqual({
        url: "https://cdn.example.com/remote-probe.png",
      });
    });
  });

  describe("forceRefreshAppAssets", () => {
    it("无旧缓存且请求成功：返回新 manifest 并缓存", async () => {
      await expect(forceRefreshAppAssets()).resolves.toEqual(VALID_MANIFEST);
      expect(resolveAppAsset("diagnostics/remote-probe")).not.toBeNull();
    });

    it("无旧缓存且请求失败：reject", async () => {
      mockRequest.mockRejectedValue(new Error("network down"));
      await expect(forceRefreshAppAssets()).rejects.toThrow("network down");
    });

    it("存在内存缓存且请求失败：回退内存缓存", async () => {
      await loadAppAssets();
      mockRequest.mockRejectedValue(new Error("network down"));

      await expect(forceRefreshAppAssets()).resolves.toEqual(VALID_MANIFEST);
    });

    it("存在 storage 缓存且请求失败：回退 storage 缓存", async () => {
      wxStorage.getStorageSync.mockReturnValue({
        manifest: VALID_MANIFEST,
        cachedAt: Date.now() - APP_ASSETS_TTL_MS - 1000,
      });
      mockRequest.mockRejectedValue(new Error("network down"));

      await expect(forceRefreshAppAssets()).resolves.toEqual(VALID_MANIFEST);
    });

    it("刷新成功后覆盖旧内存缓存", async () => {
      await loadAppAssets();
      const updated = {
        version: "v2",
        assets: {
          "diagnostics/remote-probe": {
            url: "https://cdn.example.com/remote-probe-v2.png",
          },
        },
      };
      mockRequest.mockResolvedValue({ code: 0, message: "", data: updated });

      await expect(forceRefreshAppAssets()).resolves.toEqual(updated);
      expect(resolveAppAsset("diagnostics/remote-probe")).toEqual({
        url: "https://cdn.example.com/remote-probe-v2.png",
      });
    });

    it("并发调用共享同一个 in-flight 请求，避免一屏多个展示位各打一次接口", async () => {
      await Promise.all([
        forceRefreshAppAssets(),
        forceRefreshAppAssets(),
        forceRefreshAppAssets(),
      ]);

      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it("刷新结束后清空 in-flight，下一次调用重新请求", async () => {
      await forceRefreshAppAssets();
      await forceRefreshAppAssets();

      expect(mockRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe("takeMissHealChance", () => {
    it("每个会话只放行一次", () => {
      expect(takeMissHealChance()).toBe(true);
      expect(takeMissHealChance()).toBe(false);
      expect(takeMissHealChance()).toBe(false);
    });

    it("resetAppAssetsForTest 恢复额度", () => {
      expect(takeMissHealChance()).toBe(true);

      resetAppAssetsForTest();

      expect(takeMissHealChance()).toBe(true);
    });
  });

  describe("resolveAppAsset 与测试重置", () => {
    it("未加载 manifest 时返回 null", () => {
      expect(resolveAppAsset("diagnostics/remote-probe")).toBeNull();
    });

    it("resetAppAssetsForTest 清空内存与 in-flight，且容忍 storage 清理抛错", async () => {
      await loadAppAssets();
      wxStorage.removeStorageSync.mockImplementation(() => {
        throw new Error("storage remove fail");
      });

      resetAppAssetsForTest();

      expect(resolveAppAsset("diagnostics/remote-probe")).toBeNull();
      mockRequest.mockClear();
      await loadAppAssets();
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });
});
