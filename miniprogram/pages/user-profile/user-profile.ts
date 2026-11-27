import { getUserProfile, updateUserProfile } from "../../api/api";
import { readNavBarMetrics } from "../../utils/nav-bar";
import {
  normalizeNickname,
  writeCachedProfile,
} from "../../utils/user-profile";

/**
 * 用户信息页：查看/修改家长昵称。
 * 家长不支持自定义头像，手机号本期只读展示。
 */
Page({
  data: {
    /** 页面加载中 */
    loading: true,
    /** 加载失败（可重试） */
    loadError: false,
    /** 保存中（防重复提交） */
    saving: false,
    /** 自定义导航栏：状态栏高度（px） */
    statusBarHeight: 20,
    /** 自定义导航栏：导航栏内容高度（px） */
    navBarHeight: 44,
    /** 表单数据 */
    form: {
      nickname: "",
    },
    /** 服务端当前昵称（trim 后），用于判断是否有改动 */
    initialNickname: "",
    /** 昵称 trim 后非空且与初始值不同时才允许保存 */
    canSave: false,
    /** 手机号展示文案 */
    phoneText: "未绑定",
    /** 手机号是否未绑定（展示只读提示） */
    phoneUnbound: true,
  },

  onLoad() {
    const { statusBarHeight, navBarHeight } = readNavBarMetrics();
    this.setData({ statusBarHeight, navBarHeight });
    return this.fetchProfile();
  },

  /**
   * 拉取家长档案并回填表单
   */
  async fetchProfile() {
    this.setData({ loading: true, loadError: false });
    try {
      const res = await getUserProfile();
      const profile = res?.data;
      if (!profile) {
        throw new Error("empty profile");
      }
      const nickname = profile.nickname ?? "";
      this.setData({
        "form.nickname": nickname,
        initialNickname: nickname.trim(),
        canSave: false,
        phoneText: profile.phone || "未绑定",
        phoneUnbound: !profile.phone,
      });
    } catch (error) {
      this.setData({ loadError: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载失败后重试
   */
  onRetryLoad() {
    return this.fetchProfile();
  },

  /**
   * 昵称输入变化：实时计算保存按钮可用态
   */
  onNicknameChange(event: WechatMiniprogram.Input) {
    const value = event.detail.value;
    const normalized = normalizeNickname(value);
    this.setData({
      "form.nickname": value,
      canSave: Boolean(normalized) && normalized !== this.data.initialNickname,
    });
  },

  /**
   * 保存昵称：成功后回写缓存并返回「我的」页
   */
  async onSave() {
    if (this.data.saving) return;

    const nickname = normalizeNickname(this.data.form.nickname);
    if (!nickname || nickname === this.data.initialNickname) return;

    this.setData({ saving: true });
    try {
      const res = await updateUserProfile({ nickname });
      if (res?.data) {
        writeCachedProfile(res.data);
      }
      this.setData({
        saving: false,
        initialNickname: nickname,
        canSave: false,
      });
      wx.showToast({ title: "保存成功", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      // 保留草稿，按钮复位，用户可直接重试
      this.setData({ saving: false });
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },

  onBack() {
    wx.navigateBack();
  },
});
