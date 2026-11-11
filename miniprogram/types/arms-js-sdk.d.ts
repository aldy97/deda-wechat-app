/**
 * @arms/js-sdk 小程序入口的本地类型声明（官方包未提供 d.ts）。
 * 仅声明本项目用到的最小 API 面。
 */
declare module "@arms/js-sdk/miniapp" {
  interface MiniProgramLoggerOptions {
    pid: string;
    /** true 时只打印日志不上报 */
    debug?: boolean;
    /** 小程序监控需业务方提供上报通道 */
    sendRequest?: (url: string, resData?: unknown) => void;
    /** 业务方提供当前页面路径 */
    getCurrentPage?: () => string | null;
  }

  interface ArmsMiniLogger {
    hookApp<T>(config: T): T;
    hookPage<T>(config: T): T;
    /** 上报 JS 错误（Error 对象或消息字符串） */
    error(error: unknown, pos?: { filename?: string }): void;
    /** API 接口打点：名称、成功与否、耗时 ms、业务/HTTP 码、消息、起始时间戳 */
    api(
      api: string,
      success: boolean,
      time: number,
      code?: string,
      msg?: string,
      begin?: number,
    ): void;
  }

  const MiniProgramLogger: {
    singleton(options: MiniProgramLoggerOptions): ArmsMiniLogger;
    init(options: MiniProgramLoggerOptions): ArmsMiniLogger;
  };

  export = MiniProgramLogger;
}
