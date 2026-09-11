import { getOwnerInfo, updateOwnerInfo, OwnerInfo } from '../../api/api';
import { formatDate } from '../../utils/date';

/** 设备列表缓存键（与 device-list 保持一致） */
const DEVICE_LIST_CACHE_KEY = 'device_list_cache';

/**
 * 主人信息页
 * 展示并编辑当前设备对应的孩子名字与生日。
 */
Page({
  data: {
    deviceId: '',
    /** 页面加载中 */
    loading: true,
    /** 保存中 */
    saving: false,
    /** 表单数据 */
    form: {
      name: '',
      birthday: '',
    } as OwnerInfo,
    /** 是否显示日期选择弹窗 */
    showDatePicker: false,
    /** 日期选择器当前值的时间戳 */
    currentDate: new Date('2020-05-20').getTime(),
  },

  onLoad(options) {
    const deviceId = options?.id || '';
    this.setData({ deviceId });
    this.fetchOwnerInfo(deviceId);
  },

  /**
   * 获取主人信息
   */
  async fetchOwnerInfo(deviceId: string) {
    this.setData({ loading: true });
    try {
      const res = await getOwnerInfo(deviceId);
      const { name, birthday } = res.data;
      this.setData({
        'form.name': name,
        'form.birthday': birthday,
        currentDate: birthday ? new Date(birthday).getTime() : new Date('2020-05-20').getTime(),
      });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 名字输入变化
   */
  onNameChange(event: WechatMiniprogram.TouchEvent) {
    this.setData({ 'form.name': event.detail });
  },

  /**
   * 打开日期选择器
   */
  onOpenDatePicker() {
    const currentDate = this.data.form.birthday
      ? new Date(this.data.form.birthday).getTime()
      : new Date('2020-05-20').getTime();
    this.setData({ showDatePicker: true, currentDate });
  },

  /**
   * 关闭日期选择器
   */
  onCloseDatePicker() {
    this.setData({ showDatePicker: false });
  },

  /**
   * 日期选择器值变化
   */
  onDateChange(event: WechatMiniprogram.TouchEvent) {
    const timestamp = (event.detail as unknown) as number;
    const date = formatDate(timestamp, 'YYYY-MM-DD');
    this.setData({ 'form.birthday': date });
  },

  /**
   * 确认日期选择
   */
  onDateConfirm(event: WechatMiniprogram.TouchEvent) {
    const timestamp = (event.detail as unknown) as number;
    const date = formatDate(timestamp, 'YYYY-MM-DD');
    this.setData({
      'form.birthday': date,
      showDatePicker: false,
    });
  },

  /**
   * 保存主人信息
   */
  async onSave() {
    const { name } = this.data.form;
    if (!name.trim()) {
      wx.showToast({ title: '请输入名字', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      await updateOwnerInfo(this.data.deviceId, this.data.form);
      wx.showToast({ title: '保存成功', icon: 'success' });
      // 保存成功后清除设备列表缓存，确保返回列表页时重新加载
      this.clearDeviceListCache();
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (error) {
      wx.showToast({ title: '保存失败', icon: 'none' });
      this.setData({ saving: false });
    }
  },

  /**
   * 清除设备列表缓存
   */
  clearDeviceListCache() {
    try {
      wx.removeStorageSync(DEVICE_LIST_CACHE_KEY);
    } catch (error) {
      console.warn('[owner-info] 清除设备列表缓存失败', error);
    }
  },
});
