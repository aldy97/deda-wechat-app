"use strict";
/**
 * 接口请求统一封装
 * 当前所有接口均返回模拟数据，便于本地开发与页面骨架搭建。
 * 后续替换真实接口时，只需修改本文件内部实现，页面层无需改动。
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.getDeviceList = getDeviceList;
exports.getDeviceControl = getDeviceControl;
exports.updateDeviceControl = updateDeviceControl;
exports.getLearningOverview = getLearningOverview;
exports.getChatRecords = getChatRecords;
exports.getChildProfile = getChildProfile;
exports.getDeviceAnalysis = getDeviceAnalysis;
exports.getDeviceTextbookProgress = getDeviceTextbookProgress;
exports.getDeviceTrend = getDeviceTrend;
exports.getFamilyOverview = getFamilyOverview;
exports.getFamilyTrend = getFamilyTrend;
exports.getFamilyTimeline = getFamilyTimeline;
// ==================== 模拟延迟工具 ====================
/**
 * 模拟网络延迟
 * @param ms 延迟毫秒数
 */
function mockDelay(ms = 600) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * 构造成功响应
 */
function success(data, message = 'success') {
    return { code: 0, message, data };
}
// ==================== 接口实现（模拟数据） ====================
/**
 * 登录
 * 后续替换为 wx.request 调用真实登录接口
 */
function login(params) {
    return __awaiter(this, void 0, void 0, function* () {
        yield mockDelay();
        return success({
            token: `mock_token_${params.phone}`,
            userInfo: {
                nickName: '测试用户',
                avatarUrl: '',
                phone: params.phone,
            },
        });
    });
}
/**
 * 获取设备列表
 */
function getDeviceList() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mockDelay();
        const list = [
            { id: 'D001', name: '小象学习机', status: 'online', battery: 82, lastActiveAt: '2026-09-10 14:30:00' },
            { id: 'D002', name: '绘本阅读器', status: 'sleeping', battery: 45, lastActiveAt: '2026-09-09 21:15:00' },
            { id: 'D003', name: '智能音箱', status: 'offline', battery: 12, lastActiveAt: '2026-09-08 18:00:00' },
        ];
        return success(list);
    });
}
/**
 * 获取设备控制面板数据
 */
function getDeviceControl(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield mockDelay();
        return success({
            id: deviceId,
            name: '小象学习机',
            power: true,
            volume: 60,
            mode: 'study',
        });
    });
}
/**
 * 更新设备状态
 */
function updateDeviceControl(deviceId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        yield mockDelay();
        return success({
            id: deviceId,
            name: '小象学习机',
            power: (_a = data.power) !== null && _a !== void 0 ? _a : true,
            volume: (_b = data.volume) !== null && _b !== void 0 ? _b : 60,
            mode: (_c = data.mode) !== null && _c !== void 0 ? _c : 'study',
        });
    });
}
/**
 * 获取学习数据概览
 */
function getLearningOverview() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mockDelay();
        return success({
            totalDuration: 1280,
            totalSessions: 42,
            avgScore: 86,
            continuousDays: 7,
        });
    });
}
/**
 * 获取对话记录列表
 * 模拟数据贴近设计图中的中英文故事对话场景，共 63 条。
 */
function getChatRecords() {
    return __awaiter(this, arguments, void 0, function* (page = 1, pageSize = 10) {
        yield mockDelay();
        // 固定模拟对话内容模板
        const mockContents = [
            { role: 'user', content: '坐高铁。' },
            {
                role: 'device',
                content: 'Once upon a time, there was a little boy named Tom. He was very excited because he was going to take a high - speed train for the first time. He went to the train station with his parents. When they got on the train, Tom found his seat and sat down. The train was very clean and comfortable. There were big windows, and he could see beautiful scenery outside. Green fields, tall trees, and small houses passed by quickly. Tom watched everything with wide eyes. He even saw a group of sheep on a farm. Do you think Tom had a good time on the train?',
            },
            { role: 'user', content: '再讲一个超长的故事。' },
            {
                role: 'device',
                content: 'There was a little girl named Lily. One year, it was almost Chinese New Year. Lily was very happy because she loved this festival. Her family started to prepare for the New Year. They cleaned their house from top to bottom. Lily helped her mother paste Spring Festival couplets on the door. The red couplets looked so beautiful. In the evening, the whole family got together and had a big dinner. They ate dumplings, fish, and many other delicious foods. Lily received red envelopes from her grandparents. She felt so loved. That night, they watched the Spring Festival Gala on TV and stayed up late to welcome the new year. Lily thought it was the best Chinese New Year ever.',
            },
            { role: 'user', content: '今天天气怎么样？' },
            { role: 'device', content: '今天天气晴朗，适合出门散步哦。' },
            { role: 'user', content: '帮我背一首唐诗。' },
            { role: 'device', content: '床前明月光，疑是地上霜。举头望明月，低头思故乡。——李白《静夜思》' },
            { role: 'user', content: '讲一个关于太空的故事。' },
            { role: 'device', content: '从前有一艘宇宙飞船，它带着宇航员们飞向火星。在太空中，他们看到了美丽的地球，蓝色的海洋和白色的云朵。宇航员们在飞船里做实验，种植蔬菜，还透过窗户看星星。' },
            { role: 'user', content: '我想学英语。' },
            { role: 'device', content: 'Great! Let\'s start with a simple sentence: "Hello, how are you today?" Can you repeat after me?' },
        ];
        // 生成 63 条模拟记录（按时间正序：旧 → 新）
        const total = 63;
        const records = [];
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
    });
}
// ==================== 智能分析相关接口（模拟数据） ====================
/**
 * 获取孩子档案
 */
function getChildProfile(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield mockDelay();
        return success({
            childId: `C${deviceId}`,
            name: deviceId === 'D001' ? '小明' : deviceId === 'D002' ? '小红' : '小宝',
            age: deviceId === 'D001' ? 7 : deviceId === 'D002' ? 5 : 6,
            avatarUrl: '',
            deviceId,
            deviceName: deviceId === 'D001' ? '小象学习机' : deviceId === 'D002' ? '绘本阅读器' : '智能音箱',
        });
    });
}
/**
 * 获取单设备智能分析
 */
function getDeviceAnalysis(deviceId_1) {
    return __awaiter(this, arguments, void 0, function* (deviceId, range = 'week') {
        yield mockDelay();
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
    });
}
/**
 * 获取单设备教材进度
 */
function getDeviceTextbookProgress(deviceId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield mockDelay();
        return success(generateTextbookProgress(deviceId));
    });
}
/**
 * 获取单设备学习趋势
 */
function getDeviceTrend(deviceId_1) {
    return __awaiter(this, arguments, void 0, function* (deviceId, days = 7) {
        yield mockDelay();
        return success(generateTrend(deviceId, days));
    });
}
/**
 * 获取家庭全览
 */
function getFamilyOverview() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mockDelay();
        const devicesRes = yield getDeviceList();
        const devices = devicesRes.data;
        const summaries = devices.map((device) => ({
            deviceId: device.id,
            deviceName: device.name,
            childName: device.id === 'D001' ? '小明' : device.id === 'D002' ? '小红' : '小宝',
            status: device.status,
            todayDuration: Math.floor(Math.random() * 60) + 10,
            weekDuration: Math.floor(Math.random() * 300) + 60,
            continuousDays: Math.floor(Math.random() * 7) + 1,
            avgScore: Math.floor(Math.random() * 30) + 70,
        }));
        return success({
            totalDuration: summaries.reduce((sum, d) => sum + d.weekDuration, 0),
            totalSessions: summaries.reduce((sum) => sum + Math.floor(Math.random() * 20) + 5, 0),
            activeDeviceCount: devices.filter((d) => d.status === 'online').length,
            todayCompletedDeviceIds: summaries.filter(() => Math.random() > 0.3).map((d) => d.deviceId),
            devices: summaries,
        });
    });
}
/**
 * 获取家庭学习趋势
 */
function getFamilyTrend() {
    return __awaiter(this, arguments, void 0, function* (days = 7) {
        yield mockDelay();
        return success(generateTrend('family', days));
    });
}
/**
 * 获取家庭动态时间线
 */
function getFamilyTimeline() {
    return __awaiter(this, arguments, void 0, function* (page = 1, pageSize = 10) {
        yield mockDelay();
        const events = [];
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
    });
}
// ==================== 智能分析辅助函数 ====================
function generatePracticeRecords(deviceId, count) {
    const textbooks = [
        { id: 'T001', name: 'PEP 人教版三上' },
        { id: 'T002', name: '牛津树 Level 1' },
    ];
    const types = ['单词跟读', '句型跟读', '情景对话', '绘本阅读'];
    const records = [];
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
function generateTextbookProgress(deviceId) {
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
function generateTrend(deviceId, days) {
    const points = [];
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
