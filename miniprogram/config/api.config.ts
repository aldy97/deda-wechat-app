/**
 * API 基础地址配置
 *
 * 根据微信小程序运行环境自动选择 base URL：
 * - develop（开发版/开发者工具预览）：使用联调 staging 的 HTTP 地址
 * - trial（体验版）：使用 staging HTTPS 域名（真机 CDN/图片链路验证请走体验版）
 * - release（正式版）：使用生产 HTTPS 域名
 *
 * 注意：小程序真机要求使用 HTTPS 域名，本地调试请在开发者工具中
 * 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。
 */

/**
 * 灰度（staging）后端地址。
 */
const STAGING_BASE_URL = "https://staging.valleyletters.com";

/**
 * 生产后端地址。
 */
const PROD_BASE_URL = "https://valleyletters.com";

/**
 * staging（联调）后端 HTTP 地址。
 * develop（开发者工具/真机调试）统一指向它：真机上 127.0.0.1 是手机自身，
 * 无法访问电脑本地后端。本地起后端联调时，临时改回 http://127.0.0.1:3000。
 *
 * 注意：开发者工具的 develop 环境只能访问局域网/HTTP 调试地址，
 * 无法验证 CDN 域名下的图片资源；真机 CDN 验证统一走体验版（trial）。
 */
const STAGING_HTTP_BASE_URL = "http://8.133.236.127:3001";

function getApiBaseUrl(): string {
  try {
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
    if (envVersion === "develop") {
      return STAGING_HTTP_BASE_URL;
    }
    if (envVersion === "trial") {
      return STAGING_BASE_URL;
    }
    return PROD_BASE_URL;
  } catch {
    // 兼容非微信环境（如单元测试）
    return "http://127.0.0.1:3000";
  }
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * 是否开发环境（开发者工具/开发版）。
 * 用于门控联调专用行为（如 device-provision 页的广播诊断输出），
 * trial/release 一律关闭。
 */
export function isDevEnv(): boolean {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion === "develop";
  } catch {
    // 非微信环境（如单元测试无桩时）按开发环境处理
    return true;
  }
}
