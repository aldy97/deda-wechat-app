import MiniProgramLogger = require("@arms/js-sdk/miniapp");
import { ARMS_PID } from "../config/monitor.config";
import { isDevEnv } from "../config/api.config";

/**
 * ARMS 小程序监控统一封装（utils/monitor）。
 *
 * 设计要点：
 * - 惰性单例：首次调用时才实例化 SDK；
 * - 双重降级：ARMS_PID 未配置 或 非微信运行时（如 jest/node 单测）时全部 no-op。
 *   SDK 构造期会读写 App/Page/Component 全局，且 pid 必填，这两个坑都由这里兜住；
 * - 业务侧只接触 hookApp / reportError / reportApi 三个方法，不直接依赖 SDK。
 */

type Logger = ReturnType<typeof MiniProgramLogger.singleton>;

let logger: Logger | null = null;
let initAttempted = false;

function isWeChatRuntime(): boolean {
  return (
    typeof wx !== "undefined" &&
    typeof wx.request === "function" &&
    typeof App === "function"
  );
}

function getLogger(): Logger | null {
  if (initAttempted) return logger;
  initAttempted = true;

  if (!ARMS_PID) return null;
  if (!isWeChatRuntime()) return null;

  try {
    logger = MiniProgramLogger.singleton({
      pid: ARMS_PID,
      // 开发环境只打印不上报；trial/release 正常上报
      debug: isDevEnv(),
      sendRequest: (url: string) => {
        wx.request({ url, method: "GET", fail: () => undefined });
      },
      getCurrentPage: () => {
        if (typeof getCurrentPages !== "function") return null;
        const pages = getCurrentPages() || [];
        const curr = pages[pages.length - 1];
        return (curr && curr.route) || null;
      },
    });
  } catch (error) {
    console.warn("[monitor] ARMS init failed, disabled:", error);
    logger = null;
  }
  return logger;
}

/** 包裹 App 配置：注入生命周期打点；未启用时原样返回 */
export function hookApp<T>(config: T): T {
  const instance = getLogger();
  if (!instance) return config;
  try {
    return instance.hookApp(config);
  } catch (error) {
    console.warn("[monitor] hookApp failed, bypassed:", error);
    return config;
  }
}

/** 上报 JS 异常（App.onError / 手动捕获） */
export function reportError(error: unknown, pos?: string): void {
  const instance = getLogger();
  if (!instance) return;
  try {
    if (error instanceof Error) {
      instance.error(error, pos ? { filename: pos } : undefined);
    } else {
      instance.error(String(error), pos ? { filename: pos } : undefined);
    }
  } catch {
    // 监控自身失败永远不影响业务
  }
}

/**
 * 上报接口失败（request 层的 5xx 与网络错误）。
 * 401 与业务 code≠0 属正常业务流转，不调用本方法。
 */
export function reportApi(
  url: string,
  timeMs: number,
  code: number | string,
  msg: string,
): void {
  const instance = getLogger();
  if (!instance) return;
  try {
    instance.api(url, false, timeMs, String(code), msg, Date.now() - timeMs);
  } catch {
    // 同上：监控失败静默
  }
}
