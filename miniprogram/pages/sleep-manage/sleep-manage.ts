import {
  getSleepConfig,
  updateSleepConfig,
  UpdateSleepConfigDto,
} from "../../api/api";
import {
  requestSleepReminderSubscription,
  silentTopUpSleepReminder,
} from "../../utils/push-subscription";

/** 「是否已显式请求过哄睡通知授权」的本地标记 */
const SUBSCRIBE_ASKED_KEY = "sleepReminderSubscribeAsked";

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
    /** 是否来自绑定引导流程（末尾展示完成入口，完成后回我的设备） */
    fromBind: false,
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
    /** 本页是否已请求过哄睡通知授权（持久标记在 storage） */
    subscriptionAsked: false,
  },

  onLoad(options) {
    const deviceId = options?.id || "";
    const fromBind = options?.from === "bind";
    this.setData({ deviceId, fromBind });
  },

  onReady() {
    if (this.data.deviceId) {
      this.fetchSleepConfig(this.data.deviceId);
    }
  },

  /** 绑定引导流程完成：回我的设备列表 */
  onFinish() {
    wx.switchTab({ url: "/pages/device-list/device-list" });
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

  /**
   * 哄睡通知订阅：首次保存操作时显式弹窗授权一次，之后寄生手势静默补额。
   * 必须同步运行在 tap 手势链路上（wx.requestSubscribeMessage 硬限制），
   * 因此放在各保存 handler 顶部、saveConfig 之前；授权结果不阻塞保存。
   */
  maybeRequestSleepSubscription() {
    if (this.data.subscriptionAsked || wx.getStorageSync(SUBSCRIBE_ASKED_KEY)) {
      silentTopUpSleepReminder();
      return;
    }
    wx.setStorageSync(SUBSCRIBE_ASKED_KEY, "1");
    this.setData({ subscriptionAsked: true });
    void requestSleepReminderSubscription();
  },

  onToggleEnabled(event: WechatMiniprogram.TouchEvent) {
    this.maybeRequestSleepSubscription();
    const enabled = event.detail as unknown as boolean;
    this.setData({ enabled });
    this.saveConfig({ enabled }, { enabled: !enabled });
  },

  onToggleForce(event: WechatMiniprogram.TouchEvent) {
    this.maybeRequestSleepSubscription();
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
    this.maybeRequestSleepSubscription();
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
    this.maybeRequestSleepSubscription();
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
