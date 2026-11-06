import {
  getChatRecords,
  getDeviceCurrentConfig,
  DeviceConfig,
} from "../../api/api";
import {
  buildDisplayRecords,
  computeHasMore,
  DisplayRecord,
  resolveHistoryFilters,
  withMinDelay,
} from "./chat-history.utils";

interface ChatHistoryData {
  deviceId: string;
  conversationModeKey: string;
  loading: boolean;
  records: DisplayRecord[];
  hasMore: boolean;
  page: number;
  pageSize: number;
  initialLoaded: boolean;
  scrollIntoView: string;
  contextHint: string;
}

/**
 * 对话记录页
 * 进入页面展示最新消息并定位到底部，向上滚动加载更早消息。
 * 后端分页锚定最新（page=1 为最新一页），页内按时间正序返回
 * （最旧在前、最新在后），前端按返回顺序直接渲染，不要自行反转。
 */
Page<ChatHistoryData, Record<string, any>>({
  data: {
    deviceId: "",
    conversationModeKey: "",
    loading: false,
    records: [],
    hasMore: true,
    page: 1,
    pageSize: 20,
    initialLoaded: false,
    scrollIntoView: "",
    contextHint: "",
  },

  onLoad(options) {
    const deviceId = options?.deviceId || options?.id || "";
    // textbookId/unitId 为已废弃的教材参数，静默忽略
    const conversationModeKey = options?.conversationModeKey || "";
    this.setData({ deviceId, conversationModeKey });
  },

  async onReady() {
    const { deviceId, conversationModeKey } = this.data;
    // 先完成语境解析（含配置兜底过滤）再首次查询,避免竞态发出未过滤请求
    await this.loadContext(deviceId, conversationModeKey);
    this.loadInitialRecords();
  },

  /**
   * 加载页面上下文：优先使用 URL 传入的参数，否则回退到设备当前配置
   */
  async loadContext(deviceId: string, conversationModeKey: string) {
    if (!deviceId) return;

    if (conversationModeKey) {
      wx.setNavigationBarTitle({ title: conversationModeKey });
      this.setData({ contextHint: "" });
      return;
    }

    // URL 无参：按设备当前配置推导过滤,保持页面语境与设备学习状态一致;
    // 配置拉取失败才退回「全部对话记录」
    try {
      const res = await getDeviceCurrentConfig(deviceId);
      const config = res.data;
      const filters = resolveHistoryFilters({}, config);
      this.setData({
        conversationModeKey: filters.conversationModeKey ?? "",
      });
      this.applyContext(config);
    } catch (error) {
      console.warn("[chat-history] 加载设备配置失败", error);
      wx.setNavigationBarTitle({ title: "全部对话记录" });
      this.setData({ contextHint: "查看该设备全部历史对话" });
    }
  },

  applyContext(config: DeviceConfig) {
    let title = "";
    let hint = "";

    if (config.mode === "free_chat" && config.conversationModeName) {
      title = config.conversationModeName;
      hint = config.conversationModeDescription || "";
    } else {
      title = config.conversationModeName || "对话记录";
      hint = config.conversationModeDescription || "";
    }

    wx.setNavigationBarTitle({ title });
    this.setData({ contextHint: hint });
  },

  /**
   * 初始加载：拉取第一页（最新 N 条）并滚动到底部
   */
  async loadInitialRecords() {
    this.setData({ loading: true, page: 1 });
    try {
      const res = await getChatRecords({
        page: 1,
        pageSize: this.data.pageSize,
        deviceId: this.data.deviceId,
        conversationModeKey: this.data.conversationModeKey,
      });
      const items = res.data.items || [];
      const total = res.data.total || 0;
      const records = buildDisplayRecords(items);

      this.setData({
        records,
        // total 按对话行计,records 是拆条后的消息数,须用行口径判断
        hasMore: computeHasMore(1, this.data.pageSize, total),
        page: 2,
        initialLoaded: true,
        scrollIntoView: "msg-last",
      });
    } catch (error) {
      wx.showToast({ title: "记录加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 向上滚动到顶部时加载更早消息（下一页）
   */
  onScrollToUpper() {
    return this.loadOlderRecords();
  },

  /**
   * 点击顶部「加载更多」时加载更早消息
   */
  onLoadMore() {
    return this.loadOlderRecords();
  },

  async loadOlderRecords() {
    if (!this.data.hasMore || this.data.loading) return;

    const anchorMessageId = this.data.records[0]?.id || "";
    this.setData({ loading: true, scrollIntoView: "" });

    try {
      // 最短特效时长：保证顶部「加载更早消息...」spinner 至少展示 400ms，
      // 本地/快网返回也不会一闪而过
      const res = await withMinDelay(
        getChatRecords({
          page: this.data.page,
          pageSize: this.data.pageSize,
          deviceId: this.data.deviceId,
          conversationModeKey: this.data.conversationModeKey,
        }),
      );
      const items = res.data.items || [];
      const total = res.data.total || 0;
      const olderRecords = buildDisplayRecords(items);
      const merged = olderRecords.concat(this.data.records);

      this.setData({
        records: merged,
        // 同上:行口径,this.data.page 是刚取完的页号
        hasMore: computeHasMore(this.data.page, this.data.pageSize, total),
        page: this.data.page + 1,
        scrollIntoView: anchorMessageId ? `msg-${anchorMessageId}` : "",
      });
    } catch (error) {
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },
});
