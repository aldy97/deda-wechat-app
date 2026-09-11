import { getDeviceList, Device } from '../../api/api';

/**
 * 设备列表页
 * 展示用户绑定的设备卡片，点击卡片进入控制面板。
 */
Page({
  data: {
    loading: true,
    devices: [] as Device[],
  },

  onLoad() {
    this.fetchDeviceList();
  },

  onShow() {
    // 每次显示页面时刷新列表，方便从控制页返回后看到最新状态
    this.fetchDeviceList();
  },

  /**
   * 拉取设备列表
   */
  async fetchDeviceList() {
    this.setData({ loading: true });
    try {
      const res = await getDeviceList();
      this.setData({ devices: res.data });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 查看对话：跳转对话记录页
   */
  onViewChat(event: WechatMiniprogram.TouchEvent) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/chat-history/chat-history?id=${id}`,
    });
  },

  /**
   * 设置入口（占位）
   */
  onSettingsTap() {
    // 设置功能后续迭代实现
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    await this.fetchDeviceList();
    wx.stopPullDownRefresh();
  },
});
