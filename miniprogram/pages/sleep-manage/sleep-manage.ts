import {
  getSleepConfig,
  updateSleepConfig,
  UpdateSleepConfigDto,
} from "../../api/api";

/** 哄睡内容类型 → 展示文案 */
const CONTENT_LABELS: Record<string, string> = {
  story: "故事",
  song: "儿歌",
  mixed: "混合",
};

/** 手动时长滑杆的兜底值（后端仅接受 10/15/20/25/30） */
const FALLBACK_DURATION_MINUTES = 15;

/**
 * 哄睡管理页
 * 配置读写走后端 /sleep-configs/device/:deviceId；未设置时展示前端默认值。
 */
Page({
  data: {
    deviceId: "",
    /** 哄睡总开关 */
    enabled: false,
    /** 哄睡时长展示值 */
    duration: "默认",
    /** 哄睡时长模式：默认 / 手动设置 */
    durationMode: "default" as "default" | "custom",
    /** 手动设置的哄睡时长（分钟） */
    durationMinutes: FALLBACK_DURATION_MINUTES,
    /** 哄睡内容展示值 */
    content: "故事",
    /** 哄睡内容类型 */
    contentType: "story" as "story" | "song" | "mixed",
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
    /** 是否显示时长弹窗 */
    showDurationPicker: false,
    /** 时长弹窗中的临时模式与分钟数（确定后才写回） */
    tempDurationMode: "default" as "default" | "custom",
    tempDurationMinutes: FALLBACK_DURATION_MINUTES,
  },

  onLoad(options) {
    const deviceId = options?.id || "";
    this.setData({ deviceId });
    if (deviceId) {
      this.fetchSleepConfig(deviceId);
    }
  },

  /**
   * 读取哄睡配置；未设置（data 为 null）时保留页面默认值
   */
  async fetchSleepConfig(deviceId: string) {
    try {
      const res = await getSleepConfig(deviceId);
      const config = res.data;
      if (!config) return;
      const durationMinutes =
        config.durationMinutes ?? FALLBACK_DURATION_MINUTES;
      this.setData({
        enabled: config.enabled,
        durationMode: config.durationMode,
        durationMinutes,
        duration:
          config.durationMode === "default" ? "默认" : `${durationMinutes}分钟`,
        contentType: config.contentType,
        content: CONTENT_LABELS[config.contentType] || "故事",
        sleepTime: config.sleepTime,
        forceSleep: config.forceSleep,
      });
    } catch (error) {
      console.warn("[sleep-manage] 加载哄睡配置失败", error);
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  /**
   * 部分更新哄睡配置；失败时提示并按 rollback 回滚本地状态
   */
  async saveConfig(
    partial: UpdateSleepConfigDto,
    rollback?: Record<string, unknown>,
  ) {
    if (!this.data.deviceId) return;
    try {
      await updateSleepConfig(this.data.deviceId, partial);
    } catch (error) {
      console.warn("[sleep-manage] 保存哄睡配置失败", error);
      wx.showToast({ title: "保存失败", icon: "none" });
      if (rollback) this.setData(rollback);
    }
  },

  onToggleEnabled(event: WechatMiniprogram.TouchEvent) {
    const enabled = event.detail as unknown as boolean;
    this.setData({ enabled });
    this.saveConfig({ enabled }, { enabled: !enabled });
  },

  onToggleForce(event: WechatMiniprogram.TouchEvent) {
    const forceSleep = event.detail as unknown as boolean;
    this.setData({ forceSleep });
    this.saveConfig({ forceSleep }, { forceSleep: !forceSleep });
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
   * 确认时间选择并保存
   */
  onConfirmTime() {
    const previous = this.data.sleepTime;
    const sleepTime = this.data.tempTime;
    this.setData({ sleepTime, showTimePicker: false });
    this.saveConfig({ sleepTime }, { sleepTime: previous });
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
    this.setData({
      tempDurationMinutes: event.detail as unknown as number,
    });
  },

  /**
   * 关闭时长弹窗（不保存临时选择）
   */
  onCancelDuration() {
    this.setData({ showDurationPicker: false });
  },

  /**
   * 确认哄睡时长并保存
   */
  onConfirmDuration() {
    const { tempDurationMode, tempDurationMinutes } = this.data;
    const rollback = {
      durationMode: this.data.durationMode,
      durationMinutes: this.data.durationMinutes,
      duration: this.data.duration,
    };
    this.setData({
      durationMode: tempDurationMode,
      durationMinutes: tempDurationMinutes,
      duration:
        tempDurationMode === "default" ? "默认" : `${tempDurationMinutes}分钟`,
      showDurationPicker: false,
    });
    this.saveConfig(
      tempDurationMode === "custom"
        ? { durationMode: "custom", durationMinutes: tempDurationMinutes }
        : { durationMode: "default" },
      rollback,
    );
  },

  onChooseContent() {
    this.showTodo();
  },

  showTodo() {
    wx.showToast({ title: "功能开发中，敬请期待", icon: "none" });
  },
});
