/**
 * API 基础地址配置
 *
 * 根据微信小程序运行环境自动选择 base URL：
 * - develop（开发版/开发者工具预览）：使用 http://127.0.0.1:3000
 * - trial（体验版）/ release（正式版）：使用生产 HTTPS 域名
 *
 * 注意：小程序真机要求使用 HTTPS 域名，本地调试请在开发者工具中
 * 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。
 */
function getApiBaseUrl(): string {
  try {
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
    if (envVersion === 'develop') {
      return 'http://127.0.0.1:3000';
    }
    // TODO: 替换为真实生产域名
    return 'https://your-prod-domain.com';
  } catch {
    // 兼容非微信环境（如单元测试）
    return 'http://127.0.0.1:3000';
  }
}

export const API_BASE_URL = getApiBaseUrl();
