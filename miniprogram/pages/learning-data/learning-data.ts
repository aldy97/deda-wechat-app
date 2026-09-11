import { getLearningOverview, getChatRecords, LearningOverview, ChatRecord } from '../../api/api';
import { formatDate } from '../../utils/date';
import { paginate, PaginationResult } from '../../utils/pagination';

/**
 * 学习数据 & 对话记录页
 * 展示学习概览数据与对话记录列表，支持分页加载。
 */
Page({
  data: {
    loading: true,
    overview: {} as LearningOverview,
    records: [] as ChatRecord[],
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: true,
    showDatePicker: false,
    currentDate: new Date().getTime(),
  },

  // 本地缓存全部对话记录，用于演示分页工具函数
  privateAllRecords: [] as ChatRecord[],

  onLoad() {
    this.fetchOverview();
    this.fetchRecords(true);
  },

  /**
   * 获取学习概览
   */
  async fetchOverview() {
    try {
      const res = await getLearningOverview();
      this.setData({ overview: res.data });
    } catch (error) {
      console.error('[LearningData] 概览加载失败', error);
    }
  },

  /**
   * 获取对话记录
   * @param reset 是否重置分页
   */
  async fetchRecords(reset = false) {
    if (reset) {
      this.setData({ loading: true, page: 1, records: [] });
      this.privateAllRecords = [];
    }

    try {
      // 首次加载时拉取全部模拟数据，后续使用本地分页工具函数
      if (this.privateAllRecords.length === 0) {
        const res = await getChatRecords(1, 100);
        this.privateAllRecords = res.data;
      }

      const result: PaginationResult<ChatRecord> = paginate(
        this.privateAllRecords,
        this.data.page,
        this.data.pageSize,
      );

      this.setData({
        records: reset ? result.list : this.data.records.concat(result.list),
        total: result.total,
        hasMore: result.hasMore,
        page: result.page,
      });
    } catch (error) {
      wx.showToast({ title: '记录加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载更多对话记录
   */
  async onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    await this.fetchRecords();
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await Promise.all([this.fetchOverview(), this.fetchRecords(true)]);
    wx.stopPullDownRefresh();
  },

  /**
   * 打开日期选择器
   */
  onOpenDatePicker() {
    this.setData({ showDatePicker: true });
  },

  /**
   * 关闭日期选择器
   */
  onCloseDatePicker() {
    this.setData({ showDatePicker: false });
  },

  /**
   * 确认日期选择
   */
  onDateConfirm(event: { detail: number }) {
    const date = new Date(event.detail);
    wx.showToast({
      title: `已选择 ${formatDate(date, 'YYYY-MM-DD')}`,
      icon: 'none',
    });
    this.setData({ showDatePicker: false });
  },
});
