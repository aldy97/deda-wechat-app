import { ensureAuthToken, getDeviceList, submitFeedback } from "../../api/api";

const MAX_CONTENT_LENGTH = 200;
const MAINLAND_PHONE_PATTERN = /^1[3-9]\d{9}$/;

function countCharacters(value: string): number {
  return Array.from(value).length;
}

function limitContent(value: string): string {
  return Array.from(value).slice(0, MAX_CONTENT_LENGTH).join("");
}

Page({
  data: {
    content: "",
    contact: "",
    contentLength: 0,
    canSubmit: false,
    submitting: false,
    submitFailed: false,
    /** 设备门控：是否正在查询绑定设备 */
    deviceCheckLoading: true,
    /** 设备门控：确认无任何绑定设备（查询失败 fail-open，不置 true） */
    hasNoDevice: false,
  },

  /**
   * 进入页面时检查绑定设备：无设备则禁用表单并提示去绑定。
   * 返回 Promise 供测试 await。
   */
  onLoad() {
    return this.checkDevices();
  },

  /**
   * 仅在「上次检查为无设备」时重查：配网完成返回后可直接提交，
   * 正常有设备时 onShow 不多发请求。
   */
  onShow() {
    if (this.data.hasNoDevice && !this.data.deviceCheckLoading) {
      this.checkDevices();
    }
  },

  /**
   * 查询绑定设备状态。
   * 查询失败（网络异常等）fail-open：反馈是求助通道，不被网络问题堵死。
   */
  async checkDevices() {
    this.setData({ deviceCheckLoading: true, hasNoDevice: false });
    try {
      await ensureAuthToken();
      const res = await getDeviceList();
      const devices = res.data || [];
      this.setData({ hasNoDevice: devices.length === 0 });
    } catch (error) {
      console.warn("[feedback] device check failed, fail-open:", error);
      this.setData({ hasNoDevice: false });
    } finally {
      this.setData({ deviceCheckLoading: false });
    }
  },

  /**
   * 无设备时的主行动按钮：跳转 BLE 配网流程
   */
  onGoBindDevice() {
    wx.navigateTo({
      url: "/pages/device-provision/device-provision",
    });
  },

  onContentInput(event: WechatMiniprogram.TouchEvent) {
    const content = limitContent(String(event.detail.value || ""));
    this.setData({
      content,
      contentLength: countCharacters(content),
      canSubmit: content.trim().length > 0,
    });

    // 同步拦截粘贴等可能绕过 maxlength 的输入。
    return content;
  },

  onContactInput(event: WechatMiniprogram.TouchEvent) {
    const contact = String(event.detail.value || "").trim();
    this.setData({ contact });
    return contact;
  },

  async onSubmit() {
    // 设备门控兜底：无设备不提交（UI 已禁用，此处防程序化调用）
    if (this.data.hasNoDevice) return;
    if (this.data.submitting) return;

    const content = String(this.data.content || "").trim();
    const contact = String(this.data.contact || "").trim();

    if (!content) {
      wx.showToast({ title: "请输入问题或建议", icon: "none" });
      return;
    }
    if (countCharacters(content) > MAX_CONTENT_LENGTH) {
      wx.showToast({ title: "问题或建议最多 200 字", icon: "none" });
      return;
    }
    if (contact && !MAINLAND_PHONE_PATTERN.test(contact)) {
      wx.showToast({ title: "请输入正确的手机号", icon: "none" });
      return;
    }

    this.setData({
      submitting: true,
      canSubmit: false,
      submitFailed: false,
    });
    try {
      await ensureAuthToken();
      await submitFeedback({
        content,
        contact: contact || undefined,
      });

      this.setData({
        content: "",
        contact: "",
        contentLength: 0,
      });
      wx.showToast({ title: "提交成功", icon: "success" });
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (error) {
      this.setData({ submitFailed: true });
    } finally {
      this.setData({
        submitting: false,
        canSubmit: String(this.data.content || "").trim().length > 0,
      });
    }
  },
});
