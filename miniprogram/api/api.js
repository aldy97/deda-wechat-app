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
