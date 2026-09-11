import { deleteDevice } from '../../api/api';

/**
 * 设备设置页
 * 复刻设计图，除删除设备外其他按钮均为占位无响应。
 */
Page({
  data: {
    deviceId: '',
    /** 是否显示删除确认弹窗 */
    showDeleteModal: false,
    /** 删除中加载状态 */
    deleteLoading: false,
  },

  onLoad(options) {
    const deviceId = options?.id || '';
    this.setData({ deviceId });
  },

  /**
   * 关于设备：跳转关于设备页
   */
  onAboutDevice() {
    wx.navigateTo({
      url: `/pages/about-device/about-device?id=${this.data.deviceId}`,
    });
  },

  /**
   * 主人信息：跳转主人信息页
   */
  onOwnerInfo() {
    wx.navigateTo({
      url: `/pages/owner-info/owner-info?id=${this.data.deviceId}`,
    });
  },

  /**
   * 说明书：跳转说明书页
   */
  onManual() {
    wx.navigateTo({
      url: '/pages/user-manual/user-manual',
    });
  },

  /**
   * 重新联网（占位）
   */
  onReconnect() {
    // TODO: 重新联网流程
  },

  /**
   * 点击删除设备：打开确认弹窗
   */
  onDeleteDevice() {
    this.setData({ showDeleteModal: true });
  },

  /**
   * 阻止弹窗内容点击事件冒泡到遮罩层
   */
  onModalTap() {
    // 什么都不做，仅用于 catch:tap
  },

  /**
   * 取消删除：关闭弹窗
   */
  onCancelDelete() {
    this.setData({ showDeleteModal: false });
  },

  /**
   * 确认删除：显示加载并调用 mock API
   */
  async onConfirmDelete() {
    if (this.data.deleteLoading) return;

    this.setData({ deleteLoading: true });
    try {
      await deleteDevice(this.data.deviceId);
      wx.showToast({ title: '删除成功', icon: 'success' });
      this.setData({ showDeleteModal: false });
      this.navigateBackToDeviceList();
    } catch (error) {
      wx.showToast({ title: '删除失败，请重试', icon: 'none' });
      this.setData({ deleteLoading: false });
    }
  },

  /**
   * 返回设备列表
   * 优先使用 navigateBack，否则切换到设备列表 Tab。
   */
  navigateBackToDeviceList() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({
        success: () => {
          // 返回后触发设备列表刷新（若上一页有 onShow 则自动刷新）
        },
      });
    } else {
      wx.switchTab({ url: '/pages/device-list/device-list' });
    }
  },
});
