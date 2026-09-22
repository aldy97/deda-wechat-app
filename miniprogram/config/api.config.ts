/**
 * API 基础地址配置
 *
 * 本地开发：
 * - 微信开发者工具模拟器：通常可使用 http://localhost:3000 或 http://127.0.0.1:3000
 * - 真机预览/体验版：必须改为运行 deda-server 的电脑局域网 IP，
 *   例如 http://192.168.1.100:3000，并确保手机和电脑在同一 WiFi
 *
 * 注意：小程序真机要求使用 HTTPS 域名，本地调试请在开发者工具中
 * 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。
 */
export const API_BASE_URL = 'http://localhost:3000';
