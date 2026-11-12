import { ARMS_PID } from "../config/monitor.config";
import { isDevEnv } from "../config/api.config";

/**
 * ARMS 小程序监控统一封装（utils/monitor）。
 *
 * 设计要点：
 * - 惰性单例：首次调用时才尝试加载并实例化 SDK，getLogger 的 initAttempted
 *   保证整个生命周期只尝试一次，失败即永久降级，不会反复抛错刷 console；
 * - 三重降级：ARMS_PID 未配置 / 非微信运行时（如 jest/node 单测）/ SDK 加载失败，
 *   全部 no-op。SDK 构造期会读写 App/Page/Component 全局且 pid 必填，这些坑都由这里兜住；
 * - 业务侧只接触 hookApp / reportError / reportApi 三个方法，不直接依赖 SDK。
 *
 * ⚠️ SDK 的 require 必须留在 loadSdk() 内部、且被 try 包裹，禁止提到模块顶层。
 * 微信开发者工具的「构建 npm」只按 package.json 的 main 字段打包，
 * @arms/js-sdk 产出的是 miniprogram_npm/@arms/js-sdk/index.js（浏览器 BrowserLogger，
 * 内含 window 引用），子路径 miniapp.js 不会生成。顶层 require 会在**模块加载期**
 * 抛 "module 'utils/@arms/js-sdk/miniapp.js' is not defined"（错误里的 utils/ 前缀
 * 正是微信找不到 npm 产物后回退到调用方目录的相对路径解析），
 * 连带 request.ts → app.ts → App() 全链路失败，所有页面不注册、组件解析成
 * wx://not-found —— 即整站白屏。降级守卫写在函数里对加载期抛错毫无作用。
 * tests/npm-artifacts.spec.ts 会把这条约束焊死。
 */

/** 仅取类型，编译期擦除，不产生任何运行时 require */
type ArmsSdk = typeof import("@arms/js-sdk/miniapp");
type Logger = ReturnType<ArmsSdk["singleton"]>;

let logger: Logger | null = null;
let initAttempted = false;

function isWeChatRuntime(): boolean {
  return (
    typeof wx !== "undefined" &&
    typeof wx.request === "function" &&
    typeof App === "function"
  );
}

/** 懒加载 SDK：失败即降级，绝不向上抛 */
function loadSdk(): ArmsSdk | null {
  try {
    return require("@arms/js-sdk/miniapp") as ArmsSdk;
  } catch (error) {
    console.warn("[monitor] ARMS SDK unavailable, monitoring disabled:", error);
    return null;
  }
}

function getLogger(): Logger | null {
  if (initAttempted) return logger;
  initAttempted = true;

  // 先判开关与运行时，再谈加载 SDK：未启用时连 require 都不发生
  if (!ARMS_PID) return null;
  if (!isWeChatRuntime()) return null;

  const sdk = loadSdk();
  if (!sdk) return null;

  try {
    logger = sdk.singleton({
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

/** 包裹 App 配置：注入生命周期打点；未启用时原样返回（绝不能返回 undefined，否则 App() 拿到空配置） */
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

/** 仅供测试：清空惰性单例，让用例可重新走一遍初始化 */
export function __resetMonitor(): void {
  logger = null;
  initAttempted = false;
}
