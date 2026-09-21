import { getChatRecords, ChatRecord } from '../../api/api';
import { paginateFromEnd, ReversePaginationResult } from '../../utils/pagination';

/**
 * 对话记录页
 * 采用即时通讯式交互：进入页面展示最新消息并定位到底部，向上滚动加载更早消息。
 */
Page({
  data: {
    deviceId: '',
    loading: false,
    records: [] as ChatRecord[],
    hasMore: true,
    loadedCount: 0,
    pageSize: 20,
    initialLoaded: false,
    // 用于 scroll-view 的 scroll-into-view，控制滚动位置
    scrollIntoView: '',
  },

  // 本地缓存全部对话记录（按时间正序：旧 → 新）
  privateAllRecords: [] as ChatRecord[],

  onLoad(options) {
    const deviceId = options?.id || '';
    this.setData({ deviceId });
    this.loadInitialRecords();
  },

  /**
   * 初始加载：拉取全部数据到本地，取最新 N 条并滚动到底部
   */
  async loadInitialRecords() {
    this.setData({ loading: true });
    try {
      const res = await getChatRecords(1, 100);
      this.privateAllRecords = res.data.items || [];

      const result = paginateFromEnd(
        this.privateAllRecords,
        0,
        this.data.pageSize,
      );

      this.setData({
        records: result.list,
        hasMore: result.hasMore,
        loadedCount: result.loadedCount,
        initialLoaded: true,
        scrollIntoView: 'msg-last',
      });
    } catch (error) {
      wx.showToast({ title: '记录加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 向上滚动到顶部时加载更早消息
   */
  async onScrollToUpper() {
    if (!this.data.hasMore || this.data.loading) return;

    // 记录当前最顶部消息 ID，加载完成后回滚到该位置，避免列表跳动
    const anchorMessageId = this.data.records[0]?.id || '';
    this.setData({ loading: true, scrollIntoView: '' });

    // 模拟 API 调用延迟
    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      const result: ReversePaginationResult<ChatRecord> = paginateFromEnd(
        this.privateAllRecords,
        this.data.loadedCount,
        this.data.pageSize,
      );

      this.setData({
        records: result.list.concat(this.data.records),
        hasMore: result.hasMore,
        loadedCount: result.loadedCount,
        scrollIntoView: anchorMessageId ? `msg-${anchorMessageId}` : '',
      });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
