"use strict";
/**
 * 接口请求统一封装
 * 当前所有接口均返回模拟数据，便于本地开发与页面骨架搭建。
 * 后续替换真实接口时，只需修改本文件内部实现，页面层无需改动。
 */
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.ensureAuthToken = ensureAuthToken;
exports.getDeviceList = getDeviceList;
exports.bindDevice = bindDevice;
exports.getDeviceStatus = getDeviceStatus;
exports.getConversationModeCategories = getConversationModeCategories;
exports.getConversationModes = getConversationModes;
exports.getTextbooks = getTextbooks;
exports.getTextbookDetail = getTextbookDetail;
exports.getTextbookUnits = getTextbookUnits;
exports.getDeviceCurrentConfig = getDeviceCurrentConfig;
exports.applyDeviceConfig = applyDeviceConfig;
exports.switchDeviceMode = switchDeviceMode;
exports.getOwnerInfo = getOwnerInfo;
exports.updateOwnerInfo = updateOwnerInfo;
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
exports.getLearningStatsDashboard = getLearningStatsDashboard;
exports.getLearningStatsDaily = getLearningStatsDaily;
exports.getLearningStatsTopics = getLearningStatsTopics;
exports.getLearningStatsTimeline = getLearningStatsTimeline;
exports.getLearningStatsUnitProgress = getLearningStatsUnitProgress;
exports.deleteDevice = deleteDevice;
exports.getDeviceAboutInfo = getDeviceAboutInfo;
const request_1 = require("../utils/request");
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
function success(data, message = "success") {
  return { code: 0, message, data };
}
// ==================== 接口实现（模拟数据） ====================
/**
 * 登录
 * 调用 deda-server POST /users/login 获取 JWT
 */
function login(params) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "POST",
      url: "/users/login",
      data: { code: params.code },
    });
  });
}
/**
 * 确保已获取 JWT token
 * 若 storage 中无 token，则自动调用 wx.login 换取。
 */
function ensureAuthToken() {
  const existingToken = wx.getStorageSync("token") || "";
  if (existingToken) {
    return Promise.resolve(existingToken);
  }
  return new Promise((resolve, reject) => {
    wx.login({
      success: (wxLoginRes) =>
        __awaiter(this, void 0, void 0, function* () {
          try {
            const res = yield login({ code: wxLoginRes.code });
            const token = res.data.token;
            wx.setStorageSync("token", token);
            resolve(token);
          } catch (error) {
            reject(error);
          }
        }),
      fail: (err) => reject(new Error(err.errMsg || "wx.login failed")),
    });
  });
}
/**
 * 获取设备列表
 * 仅返回基础信息，状态/电量通过 getDeviceStatus 单独获取。
 */
function getDeviceList() {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "GET",
      url: "/devices",
    });
  });
}
/**
 * 绑定设备
 * @param params deviceId 或 deviceCode 至少传一个
 */
function bindDevice(params) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "POST",
      url: "/devices/bind",
      data: params,
    });
  });
}
/**
 * 获取设备实时状态（电量、在线状态、充电状态）
 * 调用 deda-server GET /devices/{deviceId}/status
 */
function getDeviceStatus(deviceId) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "GET",
      url: `/devices/${deviceId}/status`,
    });
  });
}
/**
 * 获取对话模式顶层分类
 * 调用 deda-server GET /conversation-modes/categories
 */
function getConversationModeCategories() {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "GET",
      url: "/conversation-modes/categories",
    });
  });
}
/**
 * 获取对话子模式列表
 * 调用 deda-server GET /conversation-modes?categoryKey=...
 */
function getConversationModes(categoryKey) {
  return __awaiter(this, void 0, void 0, function* () {
    const query = categoryKey
      ? `?categoryKey=${encodeURIComponent(categoryKey)}`
      : "";
    return (0, request_1.request)({
      method: "GET",
      url: `/conversation-modes${query}`,
    });
  });
}
/**
 * 获取教材列表
 */
function getTextbooks() {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "GET",
      url: "/textbooks",
    });
  });
}
/**
 * 获取教材详情
 */
function getTextbookDetail(textbookId) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "GET",
      url: `/textbooks/${textbookId}`,
    });
  });
}
/**
 * 获取教材下单元列表
 */
function getTextbookUnits(textbookId) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "GET",
      url: `/textbooks/${textbookId}/units`,
    });
  });
}
/**
 * 获取设备当前生效配置
 */
function getDeviceCurrentConfig(deviceId) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "GET",
      url: `/device-configs/${deviceId}/current`,
    });
  });
}
/**
 * 应用教材/单元配置
 */
function applyDeviceConfig(deviceId, config) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "POST",
      url: `/device-configs/${deviceId}/apply`,
      data: config,
    });
  });
}
/**
 * 切换对话模式/子模式
 */
function switchDeviceMode(deviceId, config) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "POST",
      url: `/device-configs/${deviceId}/mode`,
      data: config,
    });
  });
}
/**
 * 获取设备主人信息
 */
function getOwnerInfo(deviceId) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "GET",
      url: `/child-profiles/device/${deviceId}`,
    });
  });
}
/**
 * 更新设备主人信息
 */
function updateOwnerInfo(deviceId, data) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "PATCH",
      url: `/child-profiles/device/${deviceId}`,
      data,
    });
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
      name: "小象学习机",
      power: true,
      volume: 60,
      mode: "study",
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
      name: "小象学习机",
      power: (_a = data.power) !== null && _a !== void 0 ? _a : true,
      volume: (_b = data.volume) !== null && _b !== void 0 ? _b : 60,
      mode: (_c = data.mode) !== null && _c !== void 0 ? _c : "study",
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
 * 调用 deda-server GET /conversations
 */
function getChatRecords() {
  return __awaiter(this, arguments, void 0, function* (params = {}) {
    const {
      page = 1,
      pageSize = 100,
      deviceId,
      textbookId,
      unitId,
      conversationModeKey,
    } = params;
    const queryParts = [
      `page=${encodeURIComponent(String(page))}`,
      `pageSize=${encodeURIComponent(String(pageSize))}`,
    ];
    if (deviceId) queryParts.push(`deviceId=${encodeURIComponent(deviceId)}`);
    if (textbookId)
      queryParts.push(`textbookId=${encodeURIComponent(textbookId)}`);
    if (unitId) queryParts.push(`unitId=${encodeURIComponent(unitId)}`);
    if (conversationModeKey)
      queryParts.push(
        `conversationModeKey=${encodeURIComponent(conversationModeKey)}`,
      );
    return (0, request_1.request)({
      method: "GET",
      url: `/conversations?${queryParts.join("&")}`,
    });
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
      name:
        deviceId === "D001" ? "小明" : deviceId === "D002" ? "小红" : "小宝",
      age: deviceId === "D001" ? 7 : deviceId === "D002" ? 5 : 6,
      avatarUrl: "",
      deviceId,
      deviceName:
        deviceId === "D001"
          ? "小象学习机"
          : deviceId === "D002"
            ? "绘本阅读器"
            : "智能音箱",
    });
  });
}
/**
 * 获取单设备智能分析
 */
function getDeviceAnalysis(deviceId_1) {
  return __awaiter(
    this,
    arguments,
    void 0,
    function* (deviceId, range = "week") {
      yield mockDelay();
      const accuracy = Math.floor(Math.random() * 39) + 60; // 60-98
      const fluency = Math.floor(Math.random() * 39) + 60;
      const integrity = Math.floor(Math.random() * 39) + 60;
      const avgScore = Math.round((accuracy + fluency + integrity) / 3);
      const dimensions = [
        { key: "accuracy", label: "发音准确度", value: accuracy },
        { key: "fluency", label: "流利度", value: fluency },
        { key: "integrity", label: "完整度", value: integrity },
      ];
      const weakest = dimensions.sort((a, b) => a.value - b.value)[0];
      return success({
        deviceId,
        range,
        totalDuration: range === "today" ? 35 : range === "week" ? 245 : 980,
        totalSessions: range === "today" ? 3 : range === "week" ? 18 : 72,
        totalDialogueRounds:
          range === "today" ? 12 : range === "week" ? 86 : 340,
        avgScore,
        continuousDays: 5,
        oralDimensions: { accuracy, fluency, integrity },
        weakPoints: [
          `${weakest.label}相对薄弱，建议加强跟读练习`,
          "Module 3 Unit 2 尚未完成",
        ],
        recentRecords: generatePracticeRecords(deviceId, 5),
      });
    },
  );
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
    // 并发获取设备状态
    const statusResList = yield Promise.all(
      devices.map((d) => getDeviceStatus(d.id)),
    );
    const statusMap = new Map(
      statusResList.map((res) => [res.data.deviceId, res.data]),
    );
    const summaries = devices.map((device) => {
      const status = statusMap.get(device.id);
      return {
        deviceId: device.id,
        deviceName: device.name,
        childName:
          device.id === "D001"
            ? "小明"
            : device.id === "D002"
              ? "小红"
              : "小宝",
        status:
          (status === null || status === void 0 ? void 0 : status.status) ||
          "offline",
        todayDuration: Math.floor(Math.random() * 60) + 10,
        weekDuration: Math.floor(Math.random() * 300) + 60,
        continuousDays: Math.floor(Math.random() * 7) + 1,
        avgScore: Math.floor(Math.random() * 30) + 70,
      };
    });
    return success({
      totalDuration: summaries.reduce((sum, d) => sum + d.weekDuration, 0),
      totalSessions: summaries.reduce(
        (sum) => sum + Math.floor(Math.random() * 20) + 5,
        0,
      ),
      activeDeviceCount: summaries.filter((d) => d.status === "online").length,
      todayCompletedDeviceIds: summaries
        .filter(() => Math.random() > 0.3)
        .map((d) => d.deviceId),
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
    return success(generateTrend("family", days));
  });
}
/**
 * 获取家庭动态时间线
 */
function getFamilyTimeline() {
  return __awaiter(
    this,
    arguments,
    void 0,
    function* (page = 1, pageSize = 10) {
      yield mockDelay();
      const events = [];
      const children = ["小明", "小红", "小宝"];
      const textbooks = ["PEP 人教版三上", "牛津树 Level 1", "新概念英语入门"];
      const modules = ["Module 1", "Module 2", "Module 3"];
      const units = ["Unit 1", "Unit 2", "Unit 3"];
      const types = ["单词跟读", "句型跟读", "情景对话", "绘本阅读"];
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
          id: `E${String(i + 1).padStart(3, "0")}`,
          deviceId: `D00${childIndex + 1}`,
          childName: children[childIndex],
          eventType: i % 2 === 0 ? "practice" : "dialogue",
          content: `${children[childIndex]} 完成了 ${textbook} ${moduleName} ${unitName} 的${type}`,
          createdAt: `2026-09-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:00:00`,
        });
      }
      return success(events);
    },
  );
}
// ==================== 智能分析辅助函数 ====================
function generatePracticeRecords(deviceId, count) {
  const textbooks = [
    { id: "T001", name: "PEP 人教版三上" },
    { id: "T002", name: "牛津树 Level 1" },
  ];
  const types = ["单词跟读", "句型跟读", "情景对话", "绘本阅读"];
  const records = [];
  for (let i = 0; i < count; i++) {
    const textbook = textbooks[i % textbooks.length];
    const moduleIndex = (i % 3) + 1;
    const unitIndex = (i % 3) + 1;
    records.push({
      id: `P${String(i + 1).padStart(3, "0")}`,
      textbookId: textbook.id,
      textbookName: textbook.name,
      moduleId: `M${moduleIndex}`,
      moduleName: `Module ${moduleIndex}`,
      unitId: `U${unitIndex}`,
      unitName: `Unit ${unitIndex}`,
      practiceType: types[i % types.length],
      score: Math.floor(Math.random() * 35) + 60,
      duration: Math.floor(Math.random() * 10) + 3,
      practicedAt: `2026-09-${String(10 - i).padStart(2, "0")} 1${i % 8}:00:00`,
    });
  }
  return records;
}
function generateTextbookProgress(deviceId) {
  const textbooks = [
    { id: "T001", name: "PEP 人教版三上" },
    { id: "T002", name: "牛津树 Level 1" },
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
          lastPracticedAt:
            completed > 0
              ? `2026-09-${String(10 - unitIndex).padStart(2, "0")} 10:00:00`
              : "",
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
// ==================== 学习全览 MVP 接口 ====================
/**
 * 获取学习全览仪表盘
 * 调用 deda-server GET /learning-stats/dashboard
 */
function getLearningStatsDashboard(deviceId) {
  return __awaiter(this, void 0, void 0, function* () {
    const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : "";
    return (0, request_1.request)({
      method: "GET",
      url: `/learning-stats/dashboard${query}`,
    });
  });
}
/**
 * 获取学习趋势（近 N 天）
 * 调用 deda-server GET /learning-stats/daily?deviceId=&days=
 */
function getLearningStatsDaily(deviceId_1) {
  return __awaiter(this, arguments, void 0, function* (deviceId, days = 7) {
    const queryParts = [`days=${encodeURIComponent(String(days))}`];
    if (deviceId) queryParts.push(`deviceId=${encodeURIComponent(deviceId)}`);
    return (0, request_1.request)({
      method: "GET",
      url: `/learning-stats/daily?${queryParts.join("&")}`,
    });
  });
}
/**
 * 获取主题分布
 * 调用 deda-server GET /learning-stats/topics
 */
function getLearningStatsTopics(deviceId) {
  return __awaiter(this, void 0, void 0, function* () {
    const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : "";
    return (0, request_1.request)({
      method: "GET",
      url: `/learning-stats/topics${query}`,
    });
  });
}
/**
 * 获取学习动态时间线
 * 调用 deda-server GET /learning-stats/timeline
 */
function getLearningStatsTimeline(deviceId_1) {
  return __awaiter(
    this,
    arguments,
    void 0,
    function* (deviceId, page = 1, pageSize = 10) {
      const queryParts = [
        `page=${encodeURIComponent(String(page))}`,
        `pageSize=${encodeURIComponent(String(pageSize))}`,
      ];
      if (deviceId) queryParts.push(`deviceId=${encodeURIComponent(deviceId)}`);
      return (0, request_1.request)({
        method: "GET",
        url: `/learning-stats/timeline?${queryParts.join("&")}`,
      });
    },
  );
}
/**
 * 获取单元进度
 * 调用 deda-server GET /learning-stats/unit-progress/:deviceId
 */
function getLearningStatsUnitProgress(deviceId) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "GET",
      url: `/learning-stats/unit-progress/${encodeURIComponent(deviceId)}`,
    });
  });
}
/**
 * 删除/解绑设备
 */
function deleteDevice(deviceId) {
  return __awaiter(this, void 0, void 0, function* () {
    return (0, request_1.request)({
      method: "DELETE",
      url: `/devices/${deviceId}`,
    });
  });
}
/**
 * 获取关于设备信息
 */
function getDeviceAboutInfo(deviceId) {
  return __awaiter(this, void 0, void 0, function* () {
    yield mockDelay(600);
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
  });
}
