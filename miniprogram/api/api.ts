/**
 * 接口请求统一封装
 * 部分接口仍为模拟数据（见各函数标注及文件内「模拟数据」注释块），
 * 其余已切换为真实 HTTPS 请求；替换实现时只需修改本文件，页面层无需改动。
 */

import { request } from "../utils/request";

// ==================== 类型定义 ====================

/** 通用接口响应结构 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 登录参数（微信静默登录：仅需 wx.login 的临时 code） */
export interface LoginParams {
  code: string;
}

/** 登录结果 */
export interface LoginResult {
  token: string;
  userInfo: {
    id: string;
    openid: string;
    phone: string | null;
  };
}

/** 用户反馈提交参数；用户身份由后端从 JWT 获取，不由客户端传递。 */
export interface SubmitFeedbackParams {
  content: string;
  contact?: string;
}

/** 用户反馈提交结果 */
export interface SubmitFeedbackResult {
  feedbackId: string;
  createdAt: string;
}

/**
 * 提交用户反馈
 * 调用 deda-server POST /feedbacks；同一用户可创建多条独立反馈记录。
 */
export async function submitFeedback(
  params: SubmitFeedbackParams,
): Promise<ApiResponse<SubmitFeedbackResult>> {
  return request<SubmitFeedbackResult>({
    method: "POST",
    url: "/feedbacks",
    data: params,
  });
}

/** 设备基础信息 */
export interface Device {
  id: string; // 对应 server 的 deviceId
  name: string; // 展示名称
  deviceId?: string;
  deviceCode?: string;
  networkType?: string;
  firmwareVersion?: string;
  childProfile?: {
    name?: string | null;
    englishName?: string | null;
  } | null;
}

/**
 * 设备实时状态（电量、在线状态等）
 * 对齐 deda-server MINI_PROGRAM_API.md 3.4（2026-11 起接 MQTT 真实状态）：
 * - status 仅 online/offline，15 秒无心跳即 offline
 * - battery / isCharging / lastActiveAt 均可能为 null（设备未上报；isCharging 协议暂缺，固定 null）
 */
export interface DeviceStatus {
  deviceId: string;
  status: "online" | "offline";
  battery: number | null; // 电量 0-100，未上报为 null
  isCharging: boolean | null;
  lastActiveAt: string | null; // ISO 8601，从未上报为 null
}

/** 对话模式顶层分类 */
export interface ConversationModeCategory {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** 对话模式细粒度子模式 */
export interface ConversationMode {
  id: string;
  categoryId: string;
  key: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  configSchema?: Record<string, unknown> | null;
  promptTemplate?: string | null;
}

/** 设备当前生效配置 */
export interface DeviceConfig {
  deviceId: string;
  mode: "free_chat";
  conversationModeKey?: string | null;
  conversationModeName?: string | null;
  conversationModeDescription?: string | null;
  language?: string | null;
  speechRate?: string | null;
}

/** 设备控制结果（契约 3.6） */
export interface ControlDeviceResult {
  success: boolean;
  deviceId: string;
  action: string;
}

/** 学习数据概览 */
export interface LearningOverview {
  totalDuration: number; // 单位：分钟
  totalSessions: number;
  avgScore: number;
  continuousDays: number;
}

/** 对话记录 */
export interface ChatRecord {
  id: string;
  role: "user" | "device";
  content: string;
  createdAt: string;
}

/** 孩子档案（对齐后端 GET /child-profiles/device/:deviceId 返回） */
export interface ChildProfile {
  id: string;
  name: string | null;
  birthday: string | null; // YYYY-MM-DD；年龄由消费方按需推算
  englishName: string | null;
  gender?: string | null;
}

/** 设备主人信息（owner info） */
export interface OwnerInfo {
  id?: string;
  name?: string | null;
  birthday?: string | null;
  englishName?: string | null;
  /** 性别：male 小王子 / female 小公主 / null 未设置 */
  gender?: "male" | "female" | null;
}

// ==================== 学习全览 MVP 类型 ====================

export interface LearningStatsContext {
  mode?: string;
  conversationModeKey?: string;
  scope?: "all";
}

function appendContextQuery(
  queryParts: string[],
  ctx?: LearningStatsContext,
): void {
  if (!ctx) return;
  if (ctx.mode) queryParts.push(`mode=${encodeURIComponent(ctx.mode)}`);
  if (ctx.conversationModeKey)
    queryParts.push(
      `conversationModeKey=${encodeURIComponent(ctx.conversationModeKey)}`,
    );
  if (ctx.scope) queryParts.push(`scope=${encodeURIComponent(ctx.scope)}`);
}

export interface LearningStatsDailyPoint {
  date: string;
  durationMinutes: number;
  sessionCount: number;
}

export interface LearningStatsTimelineEvent {
  id: string;
  deviceId: string;
  deviceName: string;
  mode: string;
  topicName: string;
  userText: string;
  aiText: string;
  createdAt: string;
}

// ==================== 模拟延迟工具 ====================

/**
 * 模拟网络延迟
 * @param ms 延迟毫秒数
 */
function mockDelay(ms = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 构造成功响应
 */
function success<T>(data: T, message = "success"): ApiResponse<T> {
  return { code: 0, message, data };
}

// ==================== 接口实现（模拟数据） ====================

/**
 * 登录
 * 调用 deda-server POST /users/login 获取 JWT
 */
export async function login(
  params: LoginParams,
): Promise<ApiResponse<LoginResult>> {
  return request<LoginResult>({
    method: "POST",
    url: "/users/login",
    data: { code: params.code },
  });
}

/**
 * 确保已获取 JWT token
 * 若 storage 中无 token，则自动调用 wx.login 换取。
 */
/** 进行中的静默登录（并发去重：多页面同时调用只触发一次 wx.login） */
let pendingAuthToken: Promise<string> | null = null;

export function ensureAuthToken(): Promise<string> {
  const existingToken = wx.getStorageSync("token") || "";
  if (existingToken) {
    return Promise.resolve(existingToken);
  }

  if (pendingAuthToken) {
    return pendingAuthToken;
  }

  const authPromise = new Promise<string>((resolve, reject) => {
    wx.login({
      success: async (wxLoginRes) => {
        try {
          const res = await login({ code: wxLoginRes.code });
          const token = res.data.token;
          wx.setStorageSync("token", token);
          resolve(token);
        } catch (error) {
          reject(error);
        }
      },
      fail: (err) => reject(new Error(err.errMsg || "wx.login failed")),
    });
  });

  // 成功/失败都清掉 pending（不依赖 Promise.finally，兼容当前 ES2017 lib 配置）
  const clearPending = () => {
    pendingAuthToken = null;
  };
  authPromise.then(clearPending, clearPending);

  pendingAuthToken = authPromise;
  return authPromise;
}

/**
 * 获取设备列表
 * 仅返回基础信息，状态/电量通过 getDeviceStatus 单独获取。
 */
export async function getDeviceList(): Promise<ApiResponse<Device[]>> {
  return request<Device[]>({
    method: "GET",
    url: "/devices",
  });
}

/** 持久化当前用户全部孩子的展示顺序。 */
export async function updateDeviceOrder(
  orderedDeviceIds: string[],
): Promise<ApiResponse<{ orderedDeviceIds: string[] }>> {
  return request<{ orderedDeviceIds: string[] }>({
    method: "PUT",
    url: "/devices/order",
    data: { orderedDeviceIds },
  });
}

/**
 * 绑定设备
 * @param params deviceId 或 deviceCode 至少传一个
 */
export interface BindDeviceResult {
  success: boolean;
  deviceId: string;
  /** true 表示当前用户此前已绑定过该设备 */
  alreadyBound: boolean;
  /**
   * 该设备当前是否已存在孩子档案（填过任意字段即为 true）；
   * 与是否本人绑过无关。false 时前端在绑定成功后直接引导填写孩子信息。
   * 对齐 deda-server MINI_PROGRAM_API.md 3.1（2026-11 新增字段）。
   */
  hasChildProfile: boolean;
}

export async function bindDevice(params: {
  deviceId?: string;
  deviceCode?: string;
}): Promise<ApiResponse<BindDeviceResult>> {
  return request<BindDeviceResult>({
    method: "POST",
    url: "/devices/bind",
    data: params,
  });
}

/** 配网认领候选设备（MINI_PROGRAM_API.md 3.10） */
export interface ProvisionCandidate {
  /** 设备业务 ID（十二位小写 MAC） */
  deviceId: string;
  /** MAC 后 6 位，多设备并列时供用户辨认 */
  macTail: string;
  /** 上线时间（ISO 8601） */
  lastSeenAt: string;
}

/**
 * 查询配网认领候选：最近窗口内（服务端默认 120s）通过 loginMac 上线、
 * 且未绑定当前用户的设备，按上线时间倒序。
 */
export async function getProvisionCandidates(): Promise<
  ApiResponse<{ devices: ProvisionCandidate[] }>
> {
  return request<{ devices: ProvisionCandidate[] }>({
    method: "GET",
    url: "/devices/provision-candidates",
  });
}

/**
 * 获取设备实时状态（电量、在线状态、充电状态）
 * 调用 deda-server GET /devices/{deviceId}/status
 */
export async function getDeviceStatus(
  deviceId: string,
): Promise<ApiResponse<DeviceStatus>> {
  return request<DeviceStatus>({
    method: "GET",
    url: `/devices/${deviceId}/status`,
  });
}

/**
 * 获取对话模式顶层分类
 * 调用 deda-server GET /conversation-modes/categories
 */
export async function getConversationModeCategories(): Promise<
  ApiResponse<ConversationModeCategory[]>
> {
  return request<ConversationModeCategory[]>({
    method: "GET",
    url: "/conversation-modes/categories",
  });
}

/**
 * 获取对话子模式列表
 * 调用 deda-server GET /conversation-modes?categoryKey=...
 */
export async function getConversationModes(
  categoryKey?: string,
): Promise<ApiResponse<ConversationMode[]>> {
  const query = categoryKey
    ? `?categoryKey=${encodeURIComponent(categoryKey)}`
    : "";
  return request<ConversationMode[]>({
    method: "GET",
    url: `/conversation-modes${query}`,
  });
}

/**
 * 获取设备当前生效配置
 */
export async function getDeviceCurrentConfig(
  deviceId: string,
): Promise<ApiResponse<DeviceConfig>> {
  return request<DeviceConfig>({
    method: "GET",
    url: `/device-configs/${deviceId}/current`,
  });
}

/**
 * 切换对话模式/子模式
 */
export async function switchDeviceMode(
  deviceId: string,
  config: Omit<DeviceConfig, "deviceId">,
): Promise<ApiResponse<DeviceConfig>> {
  return request<DeviceConfig>({
    method: "POST",
    url: `/device-configs/${deviceId}/mode`,
    data: config,
  });
}

/**
 * 获取设备主人信息
 */
export async function getOwnerInfo(
  deviceId: string,
): Promise<ApiResponse<OwnerInfo | null>> {
  return request<OwnerInfo | null>({
    method: "GET",
    url: `/child-profiles/device/${deviceId}`,
  });
}

/**
 * 更新设备主人信息
 */
export async function updateOwnerInfo(
  deviceId: string,
  data: {
    name?: string;
    birthday?: string;
    englishName?: string;
    gender?: "male" | "female" | null;
  },
): Promise<ApiResponse<OwnerInfo>> {
  return request<OwnerInfo>({
    method: "PATCH",
    url: `/child-profiles/device/${deviceId}`,
    data,
  });
}

/** 设备哄睡配置（对齐后端 GET /sleep-configs/device/:deviceId） */
export interface SleepConfig {
  /** 哄睡总开关 */
  enabled: boolean;
  /** 哄睡时长模式：default=默认（后端决定时长），custom=手动设置 */
  durationMode: "default" | "custom";
  /** 手动设置的哄睡时长（分钟），取值 10/15/20/25/30；default 模式为 null */
  durationMinutes: number | null;
  /** 哄睡内容类型 */
  contentType: "story" | "song" | "mixed";
  /** 每晚定时进入时间，24h 制 "HH:mm" */
  sleepTime: string;
  /** 强制哄睡开关 */
  forceSleep: boolean;
}

/** 哄睡配置部分更新入参（对齐后端 UpdateSleepConfigDto） */
export type UpdateSleepConfigDto = Partial<{
  enabled: boolean;
  durationMode: "default" | "custom";
  durationMinutes: number | null;
  contentType: "story" | "song" | "mixed";
  sleepTime: string;
  forceSleep: boolean;
}>;

/**
 * 获取设备哄睡配置（未设置时返回 data: null）
 */
export async function getSleepConfig(
  deviceId: string,
): Promise<ApiResponse<SleepConfig | null>> {
  return request<SleepConfig | null>({
    method: "GET",
    url: `/sleep-configs/device/${encodeURIComponent(deviceId)}`,
  });
}

/**
 * 部分更新设备哄睡配置，返回更新后的完整配置
 */
export async function updateSleepConfig(
  deviceId: string,
  data: UpdateSleepConfigDto,
): Promise<ApiResponse<SleepConfig>> {
  return request<SleepConfig>({
    method: "PATCH",
    url: `/sleep-configs/device/${encodeURIComponent(deviceId)}`,
    data,
  });
}

/**
 * 下发音量控制（契约 3.6 中唯一真实生效的 action）
 * 调用 deda-server POST /devices/{deviceId}/control
 * volume 0-100；设备不存在返回 404；volume 缺失/越界返回 400
 */
export async function controlDeviceVolume(
  deviceId: string,
  volume: number,
): Promise<ApiResponse<ControlDeviceResult>> {
  return request<ControlDeviceResult>({
    method: "POST",
    url: `/devices/${encodeURIComponent(deviceId)}/control`,
    data: { action: "volume", volume },
  });
}

/**
 * 获取学习数据概览
 */
export async function getLearningOverview(): Promise<
  ApiResponse<LearningOverview>
> {
  await mockDelay();
  return success({
    totalDuration: 1280,
    totalSessions: 42,
    avgScore: 86,
    continuousDays: 7,
  });
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface GetChatRecordsParams {
  page?: number;
  pageSize?: number;
  deviceId?: string;
  conversationModeKey?: string;
}

/**
 * 获取对话记录列表
 * 调用 deda-server GET /conversations
 */
export async function getChatRecords(
  params: GetChatRecordsParams = {},
): Promise<ApiResponse<PaginatedResponse<ChatRecord>>> {
  const { page = 1, pageSize = 100, deviceId, conversationModeKey } = params;
  const queryParts = [
    `page=${encodeURIComponent(String(page))}`,
    `pageSize=${encodeURIComponent(String(pageSize))}`,
  ];
  if (deviceId) queryParts.push(`deviceId=${encodeURIComponent(deviceId)}`);
  if (conversationModeKey)
    queryParts.push(
      `conversationModeKey=${encodeURIComponent(conversationModeKey)}`,
    );
  return request<PaginatedResponse<ChatRecord>>({
    method: "GET",
    url: `/conversations?${queryParts.join("&")}`,
  });
}

/**
 * 获取孩子档案
 * 调用 deda-server GET /child-profiles/device/:deviceId（未填写档案时返回 null）
 */
export async function getChildProfile(
  deviceId: string,
): Promise<ApiResponse<ChildProfile | null>> {
  return request<ChildProfile | null>({
    method: "GET",
    url: `/child-profiles/device/${deviceId}`,
  });
}

// ==================== 学习全览 MVP 接口 ====================

/**
 * 获取学习趋势（近 N 天）
 * 调用 deda-server GET /learning-stats/daily?deviceId=&days=
 */
export async function getLearningStatsDaily(
  deviceId?: string,
  days = 7,
  ctx?: LearningStatsContext,
): Promise<ApiResponse<LearningStatsDailyPoint[]>> {
  const queryParts: string[] = [`days=${encodeURIComponent(String(days))}`];
  if (deviceId) queryParts.push(`deviceId=${encodeURIComponent(deviceId)}`);
  appendContextQuery(queryParts, ctx);
  return request<LearningStatsDailyPoint[]>({
    method: "GET",
    url: `/learning-stats/daily?${queryParts.join("&")}`,
  });
}

/**
 * 获取学习动态时间线
 * 调用 deda-server GET /learning-stats/timeline
 */
export async function getLearningStatsTimeline(
  deviceId?: string,
  page = 1,
  pageSize = 10,
): Promise<ApiResponse<PaginatedResponse<LearningStatsTimelineEvent>>> {
  const queryParts: string[] = [
    `page=${encodeURIComponent(String(page))}`,
    `pageSize=${encodeURIComponent(String(pageSize))}`,
  ];
  if (deviceId) queryParts.push(`deviceId=${encodeURIComponent(deviceId)}`);
  return request<PaginatedResponse<LearningStatsTimelineEvent>>({
    method: "GET",
    url: `/learning-stats/timeline?${queryParts.join("&")}`,
  });
}

/**
 * 删除/解绑设备
 */
export async function deleteDevice(
  deviceId: string,
): Promise<ApiResponse<{ success: boolean; deviceId: string }>> {
  return request<{ success: boolean; deviceId: string }>({
    method: "DELETE",
    url: `/devices/${deviceId}`,
  });
}

/** 关于设备信息 */
export interface DeviceAboutInfo {
  deviceCode: string;
  topicAddress: string;
  firmwareVersion: string;
  wifiName: string;
  macAddress: string;
  ipAddress: string;
  networkType: string;
  timezone: string;
  subnetMask: string;
  gateway: string;
  dns: string;
}

/**
 * 获取关于设备信息
 */
export async function getDeviceAboutInfo(
  deviceId: string,
): Promise<ApiResponse<DeviceAboutInfo>> {
  await mockDelay(600);
  return success({
    deviceCode: "1608281053529797520",
    topicAddress: "GwWDKNXo",
    firmwareVersion: "CMS1W8bd_V1.01_828_brtc_version",
    wifiName: "wifi名称",
    macAddress: "a03c:31b2:97dc",
    ipAddress: "192.168.3.214",
    networkType: "无线WIFI",
    timezone: "GMT+8:00",
    subnetMask: "255.255.255.0",
    gateway: "192.168.3.1",
    dns: "192.168.3.1",
  });
}

// ==================== 家长每日报告 ====================

export interface ParentReportModeUsage {
  mode: string;
  count: number;
}

export interface LearningStatsModeUsage {
  deviceId: string;
  startDate: string;
  endDate: string;
  actualDays: number;
  totalCount: number;
  modeUsage: ParentReportModeUsage[];
}

export interface ParentReportSummary {
  expressionObservation: string | null;
  emotionObservation: string | null;
  thinkingObservation: string | null;
  suggestion: string | null;
}

export interface ParentReportHabit {
  planId: string;
  title: string;
  targetDays: number;
  completedDays: number;
  todayCompleted: boolean;
}

export interface ParentReport {
  deviceId: string;
  reportDate: string;
  /** 报告真实生成时间，ISO 8601；报告尚未生成时为空。 */
  generatedAt?: string | null;
  durationMinutes: number;
  modeUsage: ParentReportModeUsage[];
  summary: ParentReportSummary | null;
  habits: ParentReportHabit[];
  feedback: "useful" | "not_useful" | null;
}

/** 获取指定设备滚动 N 个自然日的功能使用统计。 */
export async function getLearningStatsModeUsage(
  deviceId: string,
  days = 7,
  endDate?: string,
): Promise<ApiResponse<LearningStatsModeUsage>> {
  const queryParts = [
    `deviceId=${encodeURIComponent(deviceId)}`,
    `days=${encodeURIComponent(String(days))}`,
  ];
  if (endDate) queryParts.push(`endDate=${encodeURIComponent(endDate)}`);
  return request<LearningStatsModeUsage>({
    method: "GET",
    url: `/learning-stats/mode-usage?${queryParts.join("&")}`,
  });
}

/** 获取指定设备、指定日期的家长每日报告。 */
export async function getParentReport(
  deviceId: string,
  date: string,
): Promise<ApiResponse<ParentReport>> {
  return request<ParentReport>({
    method: "GET",
    url: `/learning-stats/parent-report?deviceId=${encodeURIComponent(deviceId)}&date=${encodeURIComponent(date)}`,
  });
}

export interface ParentReportFeedbackParams {
  deviceId: string;
  reportDate: string;
  useful: boolean;
}

/** 提交家长报告反馈；useful 必须保持 JSON boolean。 */
export async function submitParentReportFeedback(
  params: ParentReportFeedbackParams,
): Promise<
  ApiResponse<{ reportDate: string; feedback: "useful" | "not_useful" }>
> {
  return request<{
    reportDate: string;
    feedback: "useful" | "not_useful";
  }>({
    method: "POST",
    url: "/learning-stats/parent-report/feedback",
    data: {
      deviceId: params.deviceId,
      reportDate: params.reportDate,
      useful: params.useful,
    },
  });
}

export interface ReportPushSubscriptionParams {
  templateId: string;
  result: "accept" | "reject";
  /** 本次新增额度（仅 accept 有效），默认 1，上限 30 */
  count?: number;
}

export interface PushSubscriptionState {
  templateId: string;
  quota: number;
  status: "active" | "rejected" | "exhausted";
}

/**
 * 上报订阅消息授权结果（契约 11.1）
 * 调用 deda-server POST /push-subscriptions
 * accept 累计额度、reject 清零；templateId 不在后端白名单返回 400
 */
export async function reportPushSubscription(
  params: ReportPushSubscriptionParams,
): Promise<ApiResponse<PushSubscriptionState>> {
  return request<PushSubscriptionState>({
    method: "POST",
    url: "/push-subscriptions",
    data: params,
  });
}
