/**
 * ARMS（阿里云用户体验监控 RUM）小程序端配置。
 *
 * pid 获取：ARMS 控制台 → 用户体验监控 → 创建应用「deda-miniprogram」（微信小程序类型）。
 *
 * ARMS_PID 为空字符串时，监控整体静默降级：
 * 不实例化 SDK、不产生任何上报，开发与单元测试行为与未接入前完全一致。
 */
export const ARMS_PID = "";
