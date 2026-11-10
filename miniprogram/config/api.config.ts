/**
 * API 基础地址配置
 *
 * 根据微信小程序运行环境自动选择 base URL：
 * - develop（开发版/开发者工具预览）：使用 http://127.0.0.1:3000
 * - trial（体验版）：灰度环境（当前暂与 release 同指生产域名，见 STAGING_BASE_URL 说明）
 * - release（正式版）：使用生产 HTTPS 域名
 *
 * 注意：小程序真机要求使用 HTTPS 域名，本地调试请在开发者工具中
 * 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。
 */

/**
 * 灰度（staging）后端地址。
 *
 * 部署 staging 后端 + 独立 staging 数据库后：
 *   1. 把下方占位域名替换为真实 staging 域名；
 *   2. 把 getApiBaseUrl() 中 trial 分支的返回值改为 STAGING_BASE_URL。
 * 在此之前 trial 与 release 同指生产域名（灰度暂不生效），行为保持不变。
 */
const STAGING_BASE_URL = "https://your-staging-domain.com";

/**
 * staging（联调）后端地址。
 * develop（开发者工具/真机调试）统一指向它：真机上 127.0.0.1 是手机自身，
 * 无法访问电脑本地后端。本地起后端联调时，临时改回 http://127.0.0.1:3000。
 */
const STAGING_HTTP_BASE_URL = "http://8.133.236.127:3001";

function getApiBaseUrl(): string {
  try {
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
    if (envVersion === "develop") {
      return STAGING_HTTP_BASE_URL;
    }
    if (envVersion === "trial") {
      // TODO(灰度): staging 后端部署完成后改为 return STAGING_BASE_URL
      return "https://your-prod-domain.com";
    }
    // TODO: 替换为真实生产域名
    return "https://your-prod-domain.com";
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
