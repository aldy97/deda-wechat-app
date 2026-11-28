import { getUserProfile, UserProfile } from "../../api/api";
import {
  isProfileEmpty,
  profileDisplayName,
  profileMeta,
  readCachedProfile,
  writeCachedProfile,
} from "../../utils/user-profile";

/**
 * 我的页面：家长资料卡 + 功能入口。
 * 资料卡在 onShow 时先渲染缓存、再请求刷新，保证从用户信息页返回后立即更新。
 */
Page({
  data: {
    /** 首屏加载中（骨架屏） */
    loading: true,
    /** 无缓存且请求失败时展示错误态 */
    loadError: false,
    /** 当前展示的家长档案 */
    profile: null as UserProfile | null,
    /** 未设置昵称（资料卡显示「去填写」） */
    isEmptyProfile: true,
    /** 资料卡主文案 */
    displayName: "未设置昵称",
    /** 资料卡副文案（设备数 · 孩子数） */
    metaText: "",
    /** 家长性别：决定资料卡头像用 dad / mum 包内图；空值保留占位图标 */
    parentGender: "",
  },

  onShow() {
    const cached = readCachedProfile();
    if (cached) {
      this.applyProfile(cached);
      this.setData({ loading: false, loadError: false });
    } else {
      this.setData({ loading: true, loadError: false });
    }
    return this.fetchProfile();
  },

  /**
   * 拉取家长档案；有缓存时失败不打扰用户，继续展示缓存。
   */
  async fetchProfile() {
    try {
      const res = await getUserProfile();
      const profile = res?.data ?? null;
      if (!profile) {
        throw new Error("empty profile");
      }
      this.setData({ loading: false, loadError: false });
      this.applyProfile(profile);
      writeCachedProfile(profile);
    } catch (error) {
      this.setData({
        loading: false,
        loadError: !this.data.profile,
      });
    }
  },

  applyProfile(profile: UserProfile) {
    this.setData({
      profile,
      isEmptyProfile: isProfileEmpty(profile),
      displayName: profileDisplayName(profile.nickname),
      metaText: profileMeta(profile.deviceCount, profile.childCount),
      parentGender: profile.gender ?? "",
    });
  },

  /**
   * 错误态原地重试
   */
  onRetryLoad() {
    this.setData({ loading: true, loadError: false });
    return this.fetchProfile();
  },

  /**
   * 资料卡：错误态重试，其余状态进入用户信息页；加载中不响应。
   */
  onProfileCardTap() {
    if (this.data.loading) return;
    if (this.data.loadError) {
      return this.onRetryLoad();
    }
    wx.navigateTo({ url: "/pages/user-profile/user-profile" });
  },

  onChildListTap() {
    wx.navigateTo({ url: "/pages/child-list/child-list" });
  },

  onFeedbackTap() {
    wx.navigateTo({ url: "/pages/feedback/feedback" });
  },

  onPrivacyTap() {
    wx.navigateTo({ url: "/pages/agreement/agreement?doc=privacy" });
  },

  onAgreementTap() {
    wx.navigateTo({ url: "/pages/agreement/agreement?doc=terms" });
  },
});
