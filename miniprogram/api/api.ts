/**
 * 接口请求统一封装
 * 当前所有接口均返回模拟数据，便于本地开发与页面骨架搭建。
 * 后续替换真实接口时，只需修改本文件内部实现，页面层无需改动。
 */

import { request } from '../utils/request';

// ==================== 类型定义 ====================

/** 通用接口响应结构 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 登录参数 */
export interface LoginParams {
  phone?: string;
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

/** 设备基础信息 */
export interface Device {
  id: string;        // 对应 server 的 deviceId
  name: string;      // 展示名称
  deviceId?: string;
  deviceCode?: string;
  networkType?: string;
  firmwareVersion?: string;
}

/** 设备实时状态（电量、在线状态等） */
export interface DeviceStatus {
  deviceId: string;
  status: 'online' | 'offline' | 'sleeping';
  battery: number; // 电量 0-100
  isCharging: boolean;
  lastActiveAt: string;
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

/** 设备控制面板数据 */
export interface DeviceControlData {
  id: string;
  name: string;
  power: boolean;
  volume: number; // 0-100
  mode: 'study' | 'play' | 'rest';
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
  role: 'user' | 'device';
  content: string;
  createdAt: string;
}

/** 孩子档案 */
export interface ChildProfile {
  childId: string;
  name: string;
  age: number;
  avatarUrl: string;
  deviceId: string;
  deviceName: string;
}

/** 单设备核心指标 */
export interface DeviceAnalysis {
  deviceId: string;
  range: 'today' | 'week' | 'month';
  totalDuration: number; // 分钟
  totalSessions: number;
  totalDialogueRounds: number;
  avgScore: number;
  continuousDays: number;
  oralDimensions: {
    accuracy: number; // 发音准确度
    fluency: number; // 流利度
    integrity: number; // 完整度
  };
  weakPoints: string[];
  recentRecords: PracticeRecord[];
}

/** 练习记录 */
export interface PracticeRecord {
  id: string;
  textbookId: string;
  textbookName: string;
  moduleId: string;
  moduleName: string;
  unitId: string;
  unitName: string;
  practiceType: string;
  score: number;
  duration: number; // 分钟
  practicedAt: string;
}

/** 教材进度树 */
export interface TextbookProgress {
  textbookId: string;
  textbookName: string;
  modules: ModuleProgress[];
}

export interface ModuleProgress {
  moduleId: string;
  moduleName: string;
  units: UnitProgress[];
}

export interface UnitProgress {
  unitId: string;
  unitName: string;
  totalItems: number;
  completedItems: number;
  avgScore: number;
  lastPracticedAt: string;
}

/** 趋势数据点 */
export interface TrendPoint {
  date: string; // YYYY-MM-DD
  duration: number; // 分钟
  sessions: number;
}

/** 家庭总览 */
export interface FamilyOverview {
  totalDuration: number;
  totalSessions: number;
  activeDeviceCount: number;
  todayCompletedDeviceIds: string[];
  devices: DeviceSummary[];
}

export interface DeviceSummary {
  deviceId: string;
  deviceName: string;
  childName: string;
  status: DeviceStatus['status'];
  todayDuration: number;
  weekDuration: number;
  continuousDays: number;
  avgScore: number;
}

/** 家庭动态时间线 */
export interface TimelineEvent {
  id: string;
  deviceId: string;
  childName: string;
  eventType: 'practice' | 'dialogue';
  content: string;
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
function success<T>(data: T, message = 'success'): ApiResponse<T> {
  return { code: 0, message, data };
}

// ==================== 接口实现（模拟数据） ====================

/**
 * 登录
 * 调用 deda-server POST /users/login 获取 JWT
 */
export async function login(params: LoginParams): Promise<ApiResponse<LoginResult>> {
  return request<LoginResult>({
    method: 'POST',
    url: '/users/login',
    data: { code: params.code },
  });
}

/**
 * 确保已获取 JWT token
 * 若 storage 中无 token，则自动调用 wx.login 换取。
 */
export function ensureAuthToken(): Promise<string> {
  const existingToken = wx.getStorageSync('token') || '';
  if (existingToken) {
    return Promise.resolve(existingToken);
  }

  return new Promise((resolve, reject) => {
    wx.login({
      success: async (wxLoginRes) => {
        try {
          const res = await login({ code: wxLoginRes.code });
          const token = res.data.token;
          wx.setStorageSync('token', token);
          resolve(token);
        } catch (error) {
          reject(error);
        }
      },
      fail: (err) => reject(new Error(err.errMsg || 'wx.login failed')),
    });
  });
}

/**
 * 获取设备列表
 * 仅返回基础信息，状态/电量通过 getDeviceStatus 单独获取。
 */
export async function getDeviceList(): Promise<ApiResponse<Device[]>> {
  return request<Device[]>({
    method: 'GET',
    url: '/devices',
  });
}

/**
 * 绑定设备
 * @param deviceCode 设备编码
 */
export async function bindDevice(deviceCode: string): Promise<ApiResponse<{ success: boolean; deviceId: string; alreadyBound: boolean }>> {
  return request<{ success: boolean; deviceId: string; alreadyBound: boolean }>({
    method: 'POST',
    url: '/devices/bind',
    data: { deviceCode },
  });
}

/**
 * 获取设备实时状态（电量、在线状态、充电状态）
 * 调用 deda-server GET /devices/{deviceId}/status
 */
export async function getDeviceStatus(deviceId: string): Promise<ApiResponse<DeviceStatus>> {
  return request<DeviceStatus>({
    method: 'GET',
    url: `/devices/${deviceId}/status`,
  });
}

/**
 * 获取对话模式顶层分类
 * 调用 deda-server GET /conversation-modes/categories
 */
export async function getConversationModeCategories(): Promise<ApiResponse<ConversationModeCategory[]>> {
  return request<ConversationModeCategory[]>({
    method: 'GET',
    url: '/conversation-modes/categories',
  });
}

/**
 * 获取对话子模式列表
 * 调用 deda-server GET /conversation-modes?categoryKey=...
 */
export async function getConversationModes(categoryKey?: string): Promise<ApiResponse<ConversationMode[]>> {
  const query = categoryKey ? `?categoryKey=${encodeURIComponent(categoryKey)}` : '';
  return request<ConversationMode[]>({
    method: 'GET',
    url: `/conversation-modes${query}`,
  });
}

/**
 * 获取设备控制面板数据
 */
export async function getDeviceControl(deviceId: string): Promise<ApiResponse<DeviceControlData>> {
  await mockDelay();
  return success({
    id: deviceId,
    name: '小象学习机',
    power: true,
    volume: 60,
    mode: 'study',
  });
}

/**
 * 更新设备状态
 */
export async function updateDeviceControl(
  deviceId: string,
  data: Partial<DeviceControlData>,
): Promise<ApiResponse<DeviceControlData>> {
  await mockDelay();
  return success({
    id: deviceId,
    name: '小象学习机',
    power: data.power ?? true,
    volume: data.volume ?? 60,
    mode: data.mode ?? 'study',
  });
}

/**
 * 获取学习数据概览
 */
export async function getLearningOverview(): Promise<ApiResponse<LearningOverview>> {
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

/**
 * 获取对话记录列表
 * 调用 deda-server GET /conversations
 */
export async function getChatRecords(page = 1, pageSize = 100): Promise<ApiResponse<PaginatedResponse<ChatRecord>>> {
  return request<PaginatedResponse<ChatRecord>>({
    method: 'GET',
    url: `/conversations?page=${page}&pageSize=${pageSize}`,
  });
}

// ==================== 智能分析相关接口（模拟数据） ====================

/**
 * 获取孩子档案
 */
export async function getChildProfile(deviceId: string): Promise<ApiResponse<ChildProfile>> {
  await mockDelay();
  return success({
    childId: `C${deviceId}`,
    name: deviceId === 'D001' ? '小明' : deviceId === 'D002' ? '小红' : '小宝',
    age: deviceId === 'D001' ? 7 : deviceId === 'D002' ? 5 : 6,
    avatarUrl: '',
    deviceId,
    deviceName: deviceId === 'D001' ? '小象学习机' : deviceId === 'D002' ? '绘本阅读器' : '智能音箱',
  });
}

/**
 * 获取单设备智能分析
 */
export async function getDeviceAnalysis(
  deviceId: string,
  range: 'today' | 'week' | 'month' = 'week',
): Promise<ApiResponse<DeviceAnalysis>> {
  await mockDelay();

  const accuracy = Math.floor(Math.random() * 39) + 60; // 60-98
  const fluency = Math.floor(Math.random() * 39) + 60;
  const integrity = Math.floor(Math.random() * 39) + 60;
  const avgScore = Math.round((accuracy + fluency + integrity) / 3);

  const dimensions = [
    { key: 'accuracy', label: '发音准确度', value: accuracy },
    { key: 'fluency', label: '流利度', value: fluency },
    { key: 'integrity', label: '完整度', value: integrity },
  ];
  const weakest = dimensions.sort((a, b) => a.value - b.value)[0];

  return success({
    deviceId,
    range,
    totalDuration: range === 'today' ? 35 : range === 'week' ? 245 : 980,
    totalSessions: range === 'today' ? 3 : range === 'week' ? 18 : 72,
    totalDialogueRounds: range === 'today' ? 12 : range === 'week' ? 86 : 340,
    avgScore,
    continuousDays: 5,
    oralDimensions: { accuracy, fluency, integrity },
    weakPoints: [`${weakest.label}相对薄弱，建议加强跟读练习`, 'Module 3 Unit 2 尚未完成'],
    recentRecords: generatePracticeRecords(deviceId, 5),
  });
}

/**
 * 获取单设备教材进度
 */
export async function getDeviceTextbookProgress(deviceId: string): Promise<ApiResponse<TextbookProgress[]>> {
  await mockDelay();
  return success(generateTextbookProgress(deviceId));
}

/**
 * 获取单设备学习趋势
 */
export async function getDeviceTrend(
  deviceId: string,
  days = 7,
): Promise<ApiResponse<TrendPoint[]>> {
  await mockDelay();
  return success(generateTrend(deviceId, days));
}

/**
 * 获取家庭全览
 */
export async function getFamilyOverview(): Promise<ApiResponse<FamilyOverview>> {
  await mockDelay();
  const devicesRes = await getDeviceList();
  const devices = devicesRes.data;

  // 并发获取设备状态
  const statusResList = await Promise.all(devices.map((d) => getDeviceStatus(d.id)));
  const statusMap = new Map(statusResList.map((res) => [res.data.deviceId, res.data]));

  const summaries: DeviceSummary[] = devices.map((device) => {
    const status = statusMap.get(device.id);
    return {
      deviceId: device.id,
      deviceName: device.name,
      childName: device.id === 'D001' ? '小明' : device.id === 'D002' ? '小红' : '小宝',
      status: status?.status || 'offline',
      todayDuration: Math.floor(Math.random() * 60) + 10,
      weekDuration: Math.floor(Math.random() * 300) + 60,
      continuousDays: Math.floor(Math.random() * 7) + 1,
      avgScore: Math.floor(Math.random() * 30) + 70,
    };
  });

  return success({
    totalDuration: summaries.reduce((sum, d) => sum + d.weekDuration, 0),
    totalSessions: summaries.reduce((sum) => sum + Math.floor(Math.random() * 20) + 5, 0),
    activeDeviceCount: summaries.filter((d) => d.status === 'online').length,
    todayCompletedDeviceIds: summaries.filter(() => Math.random() > 0.3).map((d) => d.deviceId),
    devices: summaries,
  });
}

/**
 * 获取家庭学习趋势
 */
export async function getFamilyTrend(days = 7): Promise<ApiResponse<TrendPoint[]>> {
  await mockDelay();
  return success(generateTrend('family', days));
}

/**
 * 获取家庭动态时间线
 */
export async function getFamilyTimeline(page = 1, pageSize = 10): Promise<ApiResponse<TimelineEvent[]>> {
  await mockDelay();
  const events: TimelineEvent[] = [];
  const children = ['小明', '小红', '小宝'];
  const textbooks = ['PEP 人教版三上', '牛津树 Level 1', '新概念英语入门'];
  const modules = ['Module 1', 'Module 2', 'Module 3'];
  const units = ['Unit 1', 'Unit 2', 'Unit 3'];
  const types = ['单词跟读', '句型跟读', '情景对话', '绘本阅读'];

  const total = 35;
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  for (let i = start; i < end; i++) {
    const childIndex = i % children.length;
    const textbook = textbooks[i % textbooks.length];
    const moduleName = modules[i % modules.length];
    const unitName = units[i % units.length];
    const type = types[i % types.length];
    const day = 11 - Math.floor(i / 3);
    const hour = 9 + (i % 8);

    events.push({
      id: `E${String(i + 1).padStart(3, '0')}`,
      deviceId: `D00${childIndex + 1}`,
      childName: children[childIndex],
      eventType: i % 2 === 0 ? 'practice' : 'dialogue',
      content: `${children[childIndex]} 完成了 ${textbook} ${moduleName} ${unitName} 的${type}`,
      createdAt: `2026-09-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:00:00`,
    });
  }

  return success(events);
}

// ==================== 智能分析辅助函数 ====================

function generatePracticeRecords(deviceId: string, count: number): PracticeRecord[] {
  const textbooks = [
    { id: 'T001', name: 'PEP 人教版三上' },
    { id: 'T002', name: '牛津树 Level 1' },
  ];
  const types = ['单词跟读', '句型跟读', '情景对话', '绘本阅读'];
  const records: PracticeRecord[] = [];

  for (let i = 0; i < count; i++) {
    const textbook = textbooks[i % textbooks.length];
    const moduleIndex = (i % 3) + 1;
    const unitIndex = (i % 3) + 1;
    records.push({
      id: `P${String(i + 1).padStart(3, '0')}`,
      textbookId: textbook.id,
      textbookName: textbook.name,
      moduleId: `M${moduleIndex}`,
      moduleName: `Module ${moduleIndex}`,
      unitId: `U${unitIndex}`,
      unitName: `Unit ${unitIndex}`,
      practiceType: types[i % types.length],
      score: Math.floor(Math.random() * 35) + 60,
      duration: Math.floor(Math.random() * 10) + 3,
      practicedAt: `2026-09-${String(10 - i).padStart(2, '0')} 1${i % 8}:00:00`,
    });
  }

  return records;
}

function generateTextbookProgress(deviceId: string): TextbookProgress[] {
  const textbooks = [
    { id: 'T001', name: 'PEP 人教版三上' },
    { id: 'T002', name: '牛津树 Level 1' },
  ];

  return textbooks.map((textbook) => ({
    textbookId: textbook.id,
    textbookName: textbook.name,
    modules: [1, 2, 3].map((moduleIndex) => ({
      moduleId: `M${moduleIndex}`,
      moduleName: `Module ${moduleIndex}`,
      units: [1, 2, 3].map((unitIndex) => {
        const completed = Math.floor(Math.random() * 5);
        return {
          unitId: `U${unitIndex}`,
          unitName: `Unit ${unitIndex}`,
          totalItems: 5,
          completedItems: completed,
          avgScore: completed > 0 ? Math.floor(Math.random() * 35) + 60 : 0,
          lastPracticedAt: completed > 0 ? `2026-09-${String(10 - unitIndex).padStart(2, '0')} 10:00:00` : '',
        };
      }),
    })),
  }));
}

function generateTrend(deviceId: string, days: number): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    points.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      duration: Math.floor(Math.random() * 60) + 10,
      sessions: Math.floor(Math.random() * 5) + 1,
    });
  }
  return points;
}

/**
 * 删除/解绑设备
 */
export async function deleteDevice(deviceId: string): Promise<ApiResponse<{ success: boolean; deviceId: string }>> {
  return request<{ success: boolean; deviceId: string }>({
    method: 'DELETE',
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
export async function getDeviceAboutInfo(deviceId: string): Promise<ApiResponse<DeviceAboutInfo>> {
  await mockDelay(600);
  return success({
    deviceCode: '1608281053529797520',
    topicAddress: 'GwWDKNXo',
    firmwareVersion: 'CMS1W8bd_V1.01_828_brtc_version',
    wifiName: 'wifi名称',
    macAddress: 'a03c:31b2:97dc',
    ipAddress: '192.168.3.214',
    networkType: '无线WIFI',
    timezone: 'GMT+8:00',
    subnetMask: '255.255.255.0',
    gateway: '192.168.3.1',
    dns: '192.168.3.1',
  });
}

/** 主人信息（孩子档案） */
export interface OwnerInfo {
  name: string;
  birthday: string; // YYYY-MM-DD
}

/**
 * 获取主人信息
 * D001 预填充数据，其他设备为空，便于演示新建与编辑两种场景。
 */
export async function getOwnerInfo(deviceId: string): Promise<ApiResponse<OwnerInfo>> {
  await mockDelay(600);

  const ownerMap: Record<string, OwnerInfo> = {
    D001: { name: '小明', birthday: '2020-05-20' },
  };

  return success(ownerMap[deviceId] || { name: '', birthday: '' });
}

/**
 * 更新主人信息
 */
export async function updateOwnerInfo(
  deviceId: string,
  data: OwnerInfo,
): Promise<ApiResponse<OwnerInfo>> {
  await mockDelay(800);
  return success({ ...data });
}
