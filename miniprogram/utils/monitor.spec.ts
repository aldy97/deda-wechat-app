/**
 * monitor 单测。
 *
 * 锁定三条铁律：
 * 1. 监控自身永远不能拖垮业务——pid 未配置 / 非微信运行时 / SDK 缺失或加载失败，
 *    hookApp 必须原样返回传入的 config（返回 undefined 会让 App() 拿到空配置，
 *    直接导致「Page has not been registered」），reportError/reportApi 必须静默 no-op。
 * 2. SDK 只能在调用期懒加载。顶层 require 在模块加载期就抛错，
 *    连带 request.ts → app.ts → App() 全链路失败：微信开发者工具「构建 npm」
 *    只按 package.json 的 main 打出 miniprogram_npm/@arms/js-sdk/index.js，
 *    子路径 miniapp.js 不存在，运行时回退解析成 utils/@arms/js-sdk/miniapp.js
 *    并抛 "module is not defined"。真机已因此白屏一次。
 * 3. 加载失败必须记忆化：不能每次上报都重试 require 反复刷 console.warn。
 */

type MonitorModule = typeof import("./monitor");

const ARMS_MODULE = "@arms/js-sdk/miniapp";

interface FakeLogger {
  hookApp: jest.Mock;
  hookPage: jest.Mock;
  error: jest.Mock;
  api: jest.Mock;
}

interface FakeSdk {
  singleton: jest.Mock;
  init: jest.Mock;
}

function createFakeSdk(impl?: Partial<FakeLogger>): FakeSdk {
  const logger: FakeLogger = {
    hookApp: jest.fn((config: unknown) => config),
    hookPage: jest.fn((config: unknown) => config),
    error: jest.fn(),
    api: jest.fn(),
    ...impl,
  };
  return {
    singleton: jest.fn(() => logger as unknown),
    init: jest.fn(() => logger as unknown),
  } as unknown as FakeSdk;
}

interface LoadOptions {
  /** 传给 monitor.config 的 ARMS_PID */
  pid?: string;
  /** 传 "throw" 模拟微信运行时 miniprogram_npm 里找不到该子路径 */
  sdk?: FakeSdk | "throw";
  /** 是否具备微信运行时特征（wx.request + App 全局） */
  wechatRuntime?: boolean;
}

/**
 * 用 jest.isolateModules 拿到一份全新的 monitor 模块实例，
 * 从而逐个用例控制 ARMS_PID / SDK 可用性 / 运行时特征。
 */
function loadMonitor(options: LoadOptions = {}): MonitorModule {
  const { pid = "", sdk = createFakeSdk(), wechatRuntime = true } = options;

  const originalWx = (globalThis as any).wx;
  const originalApp = (globalThis as any).App;
  const originalGetCurrentPages = (globalThis as any).getCurrentPages;

  (globalThis as any).wx = wechatRuntime
    ? { request: jest.fn(), getAccountInfoSync: jest.fn(() => ({})) }
    : undefined;
  (globalThis as any).App = wechatRuntime ? jest.fn() : undefined;
  (globalThis as any).getCurrentPages = () => [{ route: "pages/mine/mine" }];

  let loaded: MonitorModule | undefined;
  try {
    jest.isolateModules(() => {
      jest.doMock("../config/monitor.config", () => ({ ARMS_PID: pid }));
      jest.doMock("../config/api.config", () => ({ isDevEnv: () => true }));
      // @arms/js-sdk 已从 package.json 移除（见 AGENTS.md 规则 8），
      // 磁盘上不存在该模块，必须用 virtual mock 才能桩掉
      jest.doMock(
        ARMS_MODULE,
        () => {
          if (sdk === "throw") {
            throw new Error(
              "module 'utils/@arms/js-sdk/miniapp.js' is not defined, " +
                "require args is '@arms/js-sdk/miniapp'",
            );
          }
          return sdk;
        },
        { virtual: true },
      );
      loaded = require("./monitor") as MonitorModule;
    });
  } finally {
    (globalThis as any).wx = originalWx;
    (globalThis as any).App = originalApp;
    (globalThis as any).getCurrentPages = originalGetCurrentPages;
  }

  if (!loaded) throw new Error("monitor 模块加载失败");
  return loaded;
}

/** 在受控运行时里执行 fn（loadMonitor 只覆盖加载期，调用期需另行装桩） */
function withWeChatRuntime<T>(fn: () => T): T {
  const originalWx = (globalThis as any).wx;
  const originalApp = (globalThis as any).App;
  const originalGetCurrentPages = (globalThis as any).getCurrentPages;
  (globalThis as any).wx = {
    request: jest.fn(),
    getAccountInfoSync: jest.fn(() => ({})),
  };
  (globalThis as any).App = jest.fn();
  (globalThis as any).getCurrentPages = () => [{ route: "pages/mine/mine" }];
  try {
    return fn();
  } finally {
    (globalThis as any).wx = originalWx;
    (globalThis as any).App = originalApp;
    (globalThis as any).getCurrentPages = originalGetCurrentPages;
  }
}

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
  jest.dontMock(ARMS_MODULE);
  jest.resetModules();
});

describe("monitor：ARMS_PID 未配置时完全静默降级", () => {
  it("hookApp 原样返回同一个 config 对象", () => {
    const monitor = loadMonitor({ pid: "" });
    const config = { onLaunch: jest.fn(), globalData: { userInfo: null } };

    expect(monitor.hookApp(config)).toBe(config);
  });

  it("reportError / reportApi 不抛错", () => {
    const monitor = loadMonitor({ pid: "" });

    expect(() =>
      monitor.reportError(new Error("boom"), "app.onError"),
    ).not.toThrow();
    expect(() => monitor.reportError("plain string")).not.toThrow();
    expect(() => monitor.reportApi("/health", 12, 500, "oops")).not.toThrow();
  });

  it("pid 为空时根本不尝试加载 SDK（不产生任何 console 噪音）", () => {
    const sdk = createFakeSdk();
    const monitor = loadMonitor({ pid: "", sdk });

    monitor.reportError(new Error("boom"));
    monitor.reportApi("/health", 1, 0, "ok");

    expect(sdk.singleton).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("monitor：SDK 不可用时降级（微信 miniprogram_npm 缺失子路径）", () => {
  it("模块加载期不抛错——require 必须是懒加载", () => {
    // 这条是本次事故的回归锁：顶层 require 会让 loadMonitor 直接抛。
    expect(() => loadMonitor({ pid: "pid-x", sdk: "throw" })).not.toThrow();
  });

  it("hookApp 原样返回 config，App() 不会拿到 undefined", () => {
    const monitor = loadMonitor({ pid: "pid-x", sdk: "throw" });
    const config = { onLaunch: jest.fn() };

    expect(withWeChatRuntime(() => monitor.hookApp(config))).toBe(config);
  });

  it("reportError / reportApi 静默吞掉，不影响业务", () => {
    const monitor = loadMonitor({ pid: "pid-x", sdk: "throw" });

    expect(() =>
      withWeChatRuntime(() => {
        monitor.reportError(new Error("boom"), "app.onError");
        monitor.reportApi("/health", 12, 502, "bad gateway");
      }),
    ).not.toThrow();
  });

  it("加载失败记忆化：多次上报只 warn 一次、只重试一次", () => {
    const monitor = loadMonitor({ pid: "pid-x", sdk: "throw" });

    withWeChatRuntime(() => {
      monitor.reportError(new Error("a"));
      monitor.reportError(new Error("b"));
      monitor.reportApi("/health", 1, 500, "c");
      monitor.reportApi("/health", 1, 500, "d");
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("[monitor]");
  });
});

describe("monitor：非微信运行时（jest / node）全 no-op", () => {
  it("即使 pid 非空且 SDK 可用也不实例化", () => {
    const sdk = createFakeSdk();
    const monitor = loadMonitor({ pid: "pid-x", sdk, wechatRuntime: false });

    monitor.reportError(new Error("boom"));
    monitor.reportApi("/health", 1, 0, "ok");

    expect(sdk.singleton).not.toHaveBeenCalled();
  });
});

describe("monitor：SDK 可用时正常打点", () => {
  it("singleton 只调用一次（惰性单例），并透传 pid/debug/sendRequest/getCurrentPage", () => {
    const sdk = createFakeSdk();
    const monitor = loadMonitor({ pid: "pid-real", sdk });

    withWeChatRuntime(() => {
      monitor.reportError(new Error("a"));
      monitor.reportError(new Error("b"));
    });

    expect(sdk.singleton).toHaveBeenCalledTimes(1);
    const options = (sdk.singleton as jest.Mock).mock.calls[0][0];
    expect(options.pid).toBe("pid-real");
    expect(options.debug).toBe(true);
    expect(typeof options.sendRequest).toBe("function");
    expect(typeof options.getCurrentPage).toBe("function");
  });

  it("sendRequest 走 wx.request 且吞掉 fail", () => {
    const sdk = createFakeSdk();
    const monitor = loadMonitor({ pid: "pid-real", sdk });

    withWeChatRuntime(() => {
      monitor.reportError(new Error("a"));
      const options = (sdk.singleton as jest.Mock).mock.calls[0][0];

      // 正常路径：GET + url
      options.sendRequest("https://arms.example/log");
      expect((globalThis as any).wx.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://arms.example/log",
          method: "GET",
        }),
      );

      // 上报通道失败必须被吞掉：fail 回调是空实现，调用它不能抛
      const call = (globalThis as any).wx.request.mock.calls[0][0];
      expect(() => call.fail(new Error("network down"))).not.toThrow();
    });
  });

  it("getCurrentPage 覆盖有栈/空栈/无全局/栈顶无 route 四种情况", () => {
    const sdk = createFakeSdk();
    const monitor = loadMonitor({ pid: "pid-real", sdk });

    withWeChatRuntime(() => {
      monitor.reportError(new Error("a"));
      const options = (sdk.singleton as jest.Mock).mock.calls[0][0];

      (globalThis as any).getCurrentPages = () => [
        { route: "pages/device-list/device-list" },
        { route: "pages/mine/mine" },
      ];
      expect(options.getCurrentPage()).toBe("pages/mine/mine");

      (globalThis as any).getCurrentPages = () => [];
      expect(options.getCurrentPage()).toBeNull();

      // getCurrentPages 全局不存在（极低版本基础库/异常态）
      (globalThis as any).getCurrentPages = undefined;
      expect(options.getCurrentPage()).toBeNull();

      // 返回 falsy 时兜底成空数组
      (globalThis as any).getCurrentPages = () => undefined;
      expect(options.getCurrentPage()).toBeNull();

      // 栈顶元素没有 route
      (globalThis as any).getCurrentPages = () => [{}];
      expect(options.getCurrentPage()).toBeNull();
    });
  });

  it("hookApp 透传 SDK 的返回值", () => {
    const wrapped = { onLaunch: jest.fn(), __hooked: true };
    const sdk = createFakeSdk({ hookApp: jest.fn(() => wrapped) });
    const monitor = loadMonitor({ pid: "pid-real", sdk });
    const config = { onLaunch: jest.fn() };

    expect(withWeChatRuntime(() => monitor.hookApp(config))).toBe(wrapped);
    expect(sdk.singleton).toHaveBeenCalledTimes(1);
  });

  it("SDK 的 hookApp 自身抛错时回退原 config", () => {
    const sdk = createFakeSdk({
      hookApp: jest.fn(() => {
        throw new Error("hookApp blew up");
      }),
    });
    const monitor = loadMonitor({ pid: "pid-real", sdk });
    const config = { onLaunch: jest.fn() };

    expect(withWeChatRuntime(() => monitor.hookApp(config))).toBe(config);
  });

  it("reportError 对 Error 传原对象、对非 Error 传字符串，pos 落到 filename", () => {
    const sdk = createFakeSdk();
    const monitor = loadMonitor({ pid: "pid-real", sdk });

    withWeChatRuntime(() => {
      monitor.reportError(new Error("boom"), "app.onError");
      monitor.reportError(new Error("no-pos"));
      monitor.reportError({ code: 500 });
      monitor.reportError({ code: 502 }, "request.fail");
    });

    const errorFn = (
      (sdk.singleton as jest.Mock).mock.results[0].value as FakeLogger
    ).error;
    expect(errorFn).toHaveBeenCalledTimes(4);
    // Error 入参：原对象透传，pos 落到 filename，无 pos 则第二参为 undefined
    expect(errorFn.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(errorFn.mock.calls[0][1]).toEqual({ filename: "app.onError" });
    expect(errorFn.mock.calls[1][0]).toBeInstanceOf(Error);
    expect(errorFn.mock.calls[1][1]).toBeUndefined();
    // 非 Error 入参：一律 String() 化，pos 同样落到 filename
    expect(errorFn.mock.calls[2][0]).toBe("[object Object]");
    expect(errorFn.mock.calls[2][1]).toBeUndefined();
    expect(errorFn.mock.calls[3][0]).toBe("[object Object]");
    expect(errorFn.mock.calls[3][1]).toEqual({ filename: "request.fail" });
  });

  it("reportApi 按 (api, success=false, time, code, msg, begin) 顺序打点", () => {
    const sdk = createFakeSdk();
    const monitor = loadMonitor({ pid: "pid-real", sdk });

    const before = Date.now();
    withWeChatRuntime(() => {
      monitor.reportApi("/api/device/list", 137, 503, "service unavailable");
    });
    const after = Date.now();

    const apiFn = (
      (sdk.singleton as jest.Mock).mock.results[0].value as FakeLogger
    ).api;
    expect(apiFn).toHaveBeenCalledTimes(1);
    const args = apiFn.mock.calls[0];
    expect(args[0]).toBe("/api/device/list");
    expect(args[1]).toBe(false);
    expect(args[2]).toBe(137);
    expect(args[3]).toBe("503");
    expect(args[4]).toBe("service unavailable");
    expect(args[5]).toBeGreaterThanOrEqual(before - 137);
    expect(args[5]).toBeLessThanOrEqual(after);
  });

  it("SDK 打点方法自身抛错时静默吞掉", () => {
    const sdk = createFakeSdk({
      error: jest.fn(() => {
        throw new Error("report transport down");
      }),
    });
    const monitor = loadMonitor({ pid: "pid-real", sdk });

    expect(() =>
      withWeChatRuntime(() => monitor.reportError(new Error("boom"))),
    ).not.toThrow();
  });

  it("singleton 构造期抛错时降级为 no-op", () => {
    const sdk = createFakeSdk();
    (sdk.singleton as jest.Mock).mockImplementation(() => {
      throw new Error("pid required");
    });
    const monitor = loadMonitor({ pid: "pid-real", sdk });

    expect(() =>
      withWeChatRuntime(() => monitor.reportError(new Error("boom"))),
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[monitor] ARMS init failed"),
      expect.anything(),
    );
  });
});

describe("monitor：__resetMonitor 测试钩子", () => {
  it("重置 initAttempted 后允许重新尝试初始化", () => {
    const monitor = loadMonitor({ pid: "pid-x", sdk: "throw" });

    withWeChatRuntime(() => monitor.reportError(new Error("a")));
    expect(warnSpy).toHaveBeenCalledTimes(1);

    withWeChatRuntime(() => {
      monitor.__resetMonitor();
      monitor.reportError(new Error("b"));
    });
    // 未重置时 initAttempted 会短路，永远只 warn 一次；重置后才会再试一次
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
