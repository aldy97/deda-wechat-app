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

/** 设备信息 */
export interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'sleeping';
  battery: number; // 电量 0-100
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
 */
export async function getDeviceList(): Promise<ApiResponse<Device[]>> {
  await mockDelay();
  const list: Device[] = [
    { id: 'D001', name: '小象学习机', status: 'online', battery: 82, lastActiveAt: '2026-09-10 14:30:00' },
    { id: 'D002', name: '绘本阅读器', status: 'sleeping', battery: 45, lastActiveAt: '2026-09-09 21:15:00' },
    { id: 'D003', name: '智能音箱', status: 'offline', battery: 12, lastActiveAt: '2026-09-08 18:00:00' },
  ];
  return success(list);
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
