/**
 * 接口请求统一封装
 * 当前所有接口均返回模拟数据，便于本地开发与页面骨架搭建。
 * 后续替换真实接口时，只需修改本文件内部实现，页面层无需改动。
 */

// ==================== 类型定义 ====================

/** 通用接口响应结构 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 登录参数 */
export interface LoginParams {
  phone: string;
  code: string;
}

/** 登录结果 */
export interface LoginResult {
  token: string;
  userInfo: {
    nickName: string;
    avatarUrl: string;
    phone: string;
  };
}

/** 设备基础信息 */
export interface Device {
  id: string;
  name: string;
}

/** 设备实时状态（电量、在线状态等） */
export interface DeviceStatus {
  deviceId: string;
  status: 'online' | 'offline' | 'sleeping';
  battery: number; // 电量 0-100
  isCharging: boolean;
  lastActiveAt: string;
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
 * 后续替换为 wx.request 调用真实登录接口
 */
export async function login(params: LoginParams): Promise<ApiResponse<LoginResult>> {
  await mockDelay();
  return success({
    token: `mock_token_${params.phone}`,
    userInfo: {
      nickName: '测试用户',
      avatarUrl: '',
      phone: params.phone,
    },
  });
}

/**
 * 获取设备列表
 * 仅返回基础信息，状态/电量通过 getDeviceStatus 单独获取。
 */
export async function getDeviceList(): Promise<ApiResponse<Device[]>> {
  await mockDelay();
  const list: Device[] = [
    { id: 'D001', name: '小象学习机' },
    { id: 'D002', name: '绘本阅读器' },
    { id: 'D003', name: '智能音箱' },
  ];
  return success(list);
}

/**
 * 获取设备实时状态（电量、在线状态、充电状态）
 */
export async function getDeviceStatus(deviceId: string): Promise<ApiResponse<DeviceStatus>> {
  await mockDelay(400);

  // 根据 deviceId 生成稳定 mock 数据，避免每次刷新随机跳动
  // D001: 在线，电量 74%
  // D002: 离线，电量 12%
  // D003: 在线且充电中，电量 45%
  const batteryMap: Record<string, number> = {
    D001: 74,
    D002: 12,
    D003: 45,
  };
  const statusMap: Record<string, DeviceStatus['status']> = {
    D001: 'online',
    D002: 'offline',
    D003: 'online',
  };
  const chargingMap: Record<string, boolean> = {
    D001: false,
    D002: false,
    D003: true,
  };

  return success({
    deviceId,
    status: statusMap[deviceId] || 'offline',
    battery: batteryMap[deviceId] ?? Math.floor(Math.random() * 100),
    isCharging: chargingMap[deviceId] ?? false,
    lastActiveAt: '2026-09-10 14:30:00',
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

/**
 * 获取对话记录列表
 * 模拟数据贴近设计图中的中英文故事对话场景，共 63 条。
 */
export async function getChatRecords(page = 1, pageSize = 10): Promise<ApiResponse<ChatRecord[]>> {
  await mockDelay();

  // 固定模拟对话内容模板
  const mockContents = [
    { role: 'user' as const, content: '坐高铁。' },
    {
      role: 'device' as const,
      content: 'Once upon a time, there was a little boy named Tom. He was very excited because he was going to take a high - speed train for the first time. He went to the train station with his parents. When they got on the train, Tom found his seat and sat down. The train was very clean and comfortable. There were big windows, and he could see beautiful scenery outside. Green fields, tall trees, and small houses passed by quickly. Tom watched everything with wide eyes. He even saw a group of sheep on a farm. Do you think Tom had a good time on the train?',
    },
    { role: 'user' as const, content: '再讲一个超长的故事。' },
    {
      role: 'device' as const,
      content: 'There was a little girl named Lily. One year, it was almost Chinese New Year. Lily was very happy because she loved this festival. Her family started to prepare for the New Year. They cleaned their house from top to bottom. Lily helped her mother paste Spring Festival couplets on the door. The red couplets looked so beautiful. In the evening, the whole family got together and had a big dinner. They ate dumplings, fish, and many other delicious foods. Lily received red envelopes from her grandparents. She felt so loved. That night, they watched the Spring Festival Gala on TV and stayed up late to welcome the new year. Lily thought it was the best Chinese New Year ever.',
    },
    { role: 'user' as const, content: '今天天气怎么样？' },
    { role: 'device' as const, content: '今天天气晴朗，适合出门散步哦。' },
    { role: 'user' as const, content: '帮我背一首唐诗。' },
    { role: 'device' as const, content: '床前明月光，疑是地上霜。举头望明月，低头思故乡。——李白《静夜思》' },
    { role: 'user' as const, content: '讲一个关于太空的故事。' },
    { role: 'device' as const, content: '从前有一艘宇宙飞船，它带着宇航员们飞向火星。在太空中，他们看到了美丽的地球，蓝色的海洋和白色的云朵。宇航员们在飞船里做实验，种植蔬菜，还透过窗户看星星。' },
    { role: 'user' as const, content: '我想学英语。' },
    { role: 'device' as const, content: 'Great! Let\'s start with a simple sentence: "Hello, how are you today?" Can you repeat after me?' },
  ];

  // 生成 63 条模拟记录（按时间正序：旧 → 新）
  const total = 63;
  const records: ChatRecord[] = [];

  for (let i = 0; i < total; i++) {
    const template = mockContents[i % mockContents.length];
    const hour = 8 + Math.floor(i / 5);
    const minute = (i % 5) * 12;
    records.push({
      id: `R${String(i + 1).padStart(3, '0')}`,
      role: template.role,
      content: template.content,
      createdAt: `2026-09-10 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
    });
  }

  // 按原有 page/pageSize 参数返回正向分页结果，保持接口兼容性
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return success(records.slice(start, end));
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
