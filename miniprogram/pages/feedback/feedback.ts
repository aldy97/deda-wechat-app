import {
  ensureAuthToken,
  getWechatPhoneNumber,
  submitFeedback,
} from "../../api/api";

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
    phoneLoading: false,
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

  async onGetPhoneNumber(
    event: WechatMiniprogram.ButtonGetPhoneNumber,
  ): Promise<void> {
    const { code, errMsg } = event.detail;
    if (!code) {
      if (errMsg && !/deny|cancel/.test(errMsg)) {
        wx.showToast({ title: "获取失败，请手动输入", icon: "none" });
      }
      return;
    }
    if (this.data.phoneLoading) return;

    this.setData({ phoneLoading: true });
    try {
      await ensureAuthToken();
      const res = await getWechatPhoneNumber(code);
      const contact = String(res.data.phone || "");
      if (!MAINLAND_PHONE_PATTERN.test(contact)) {
        throw new Error("Invalid phone number");
      }
      this.setData({ contact, submitFailed: false });
    } catch (error) {
      wx.showToast({ title: "获取失败，请手动输入", icon: "none" });
    } finally {
      this.setData({ phoneLoading: false });
    }
  },

  async onSubmit() {
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
