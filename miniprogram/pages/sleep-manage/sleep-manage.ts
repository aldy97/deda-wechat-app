/**
 * 哄睡管理页（纯 UI，交互待接入后端）
 */
Page({
  data: {
    deviceId: "",
    /** 哄睡总开关 */
    enabled: true,
    /** 哄睡时长展示值 */
    duration: "默认",
    /** 哄睡时长模式：默认 / 手动设置 */
    durationMode: "default" as "default" | "custom",
    /** 手动设置的哄睡时长（分钟） */
    durationMinutes: 15,
    /** 是否显示时长弹窗 */
    showDurationPicker: false,
    /** 时长弹窗中的临时模式与分钟数（确定后才写回） */
    tempDurationMode: "default" as "default" | "custom",
    tempDurationMinutes: 15,
    /** 哄睡内容展示值 */
    content: "故事",
    /** 哄睡时间展示值 */
    sleepTime: "21:30",
    /** 强制哄睡开关 */
    forceSleep: false,
    /** 「如何进入哄睡模式」是否展开 */
    guideOpen: false,
    /** 是否显示时间选择弹窗 */
    showTimePicker: false,
    /** 时间选择器中的临时值（确定后才写回） */
    tempTime: "21:30",
  },

  onLoad(options) {
    this.setData({ deviceId: options?.id || "" });
  },

  onToggleEnabled(event: WechatMiniprogram.TouchEvent) {
    this.setData({ enabled: event.detail as unknown as boolean });
  },

  onToggleForce(event: WechatMiniprogram.TouchEvent) {
    this.setData({ forceSleep: event.detail as unknown as boolean });
  },

  /**
   * 展开/收起「如何进入哄睡模式」
   */
  onToggleGuide() {
    this.setData({ guideOpen: !this.data.guideOpen });
  },

  /**
   * 打开时间选择弹窗（时间卡片按钮与方式2「修改」共用）
   */
  onSetTime() {
    this.setData({
      showTimePicker: true,
      tempTime: this.data.sleepTime,
    });
  },

  /**
   * 时间滚轮变化（van-datetime-picker change 的 detail 为 picker 实例）
   */
  onTimeChange(event: WechatMiniprogram.TouchEvent) {
    const picker = event.detail as unknown as { getValues(): string[] };
    const values = picker.getValues();
    if (values && values.length === 2) {
      this.setData({ tempTime: values.join(":") });
    }
  },

  /**
   * 关闭时间选择弹窗（不保存临时选择）
   */
  onCancelTime() {
    this.setData({ showTimePicker: false });
  },

  /**
   * 确认时间选择
   */
  onConfirmTime() {
    this.setData({
      sleepTime: this.data.tempTime,
      showTimePicker: false,
    });
  },

  onSetDuration() {
    this.setData({
      showDurationPicker: true,
      tempDurationMode: this.data.durationMode,
      tempDurationMinutes: this.data.durationMinutes,
    });
  },

  /**
   * 时长弹窗中选择 默认 / 手动设置
   */
  onSelectDurationMode(event: WechatMiniprogram.TouchEvent) {
    const mode = event.currentTarget.dataset.mode as "default" | "custom";
    this.setData({ tempDurationMode: mode });
  },

  /**
   * 时长滑杆变化
   */
  onDurationSlideChange(event: WechatMiniprogram.TouchEvent) {
    this.setData({ tempDurationMinutes: event.detail as unknown as number });
  },

  /**
   * 关闭时长弹窗（不保存临时选择）
   */
  onCancelDuration() {
    this.setData({ showDurationPicker: false });
  },

  /**
   * 确认哄睡时长
   */
  onConfirmDuration() {
    const { tempDurationMode, tempDurationMinutes } = this.data;
    this.setData({
      durationMode: tempDurationMode,
      durationMinutes: tempDurationMinutes,
      duration:
        tempDurationMode === "default" ? "默认" : `${tempDurationMinutes}分钟`,
      showDurationPicker: false,
    });
  },

  onChooseContent() {
    this.showTodo();
  },

  showTodo() {
    wx.showToast({ title: "功能开发中，敬请期待", icon: "none" });
  },
});
