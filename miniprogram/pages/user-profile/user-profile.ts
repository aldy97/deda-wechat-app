import { getUserProfile, updateUserProfile } from "../../api/api";
import { normalizeChildGender } from "../../utils/child-gender";
import { formatDate } from "../../utils/date";
import { readNavBarMetrics } from "../../utils/nav-bar";
import {
  normalizeNickname,
  writeCachedProfile,
} from "../../utils/user-profile";

type Gender = "male" | "female";

interface ProfileForm {
  nickname: string;
  gender: Gender | null;
  birthday: string;
}

interface ProfileSnapshot {
  /** 已归一化的初始昵称，用于判断是否有改动 */
  nickname: string;
  gender: Gender | null;
  birthday: string;
}

function toSnapshot(form: ProfileForm): ProfileSnapshot {
  return {
    nickname: normalizeNickname(form.nickname),
    gender: form.gender ?? null,
    birthday: form.birthday || "",
  };
}

function hasChanges(form: ProfileForm, initial: ProfileSnapshot): boolean {
  const current = toSnapshot(form);
  return (
    current.nickname !== initial.nickname ||
    current.gender !== initial.gender ||
    current.birthday !== initial.birthday
  );
}

/**
 * 用户信息页：查看/修改家长昵称、性别、生日。
 * 前端约束昵称 10 字以内；手机号不在本页展示（只在反馈里填写并回写账号）。
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
    /** 生日选择器上限：今天 */
    today: "",
    /** 表单数据 */
    form: {
      nickname: "",
      gender: null,
      birthday: "",
    } as ProfileForm,
    /** 服务端当前档案快照，用于判断是否有改动 */
    initial: {
      nickname: "",
      gender: null,
      birthday: "",
    } as ProfileSnapshot,
    /** 昵称非空且任一字段有改动时才允许保存 */
    canSave: false,
  },

  onLoad() {
    const { statusBarHeight, navBarHeight } = readNavBarMetrics();
    this.setData({
      statusBarHeight,
      navBarHeight,
      today: formatDate(new Date(), "YYYY-MM-DD"),
    });
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
      const form: ProfileForm = {
        nickname: profile.nickname ?? "",
        gender: normalizeChildGender(profile.gender),
        birthday: profile.birthday ?? "",
      };
      this.setData({
        form,
        initial: toSnapshot(form),
        canSave: false,
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
    const form = { ...this.data.form, nickname: event.detail.value };
    const canSave =
      Boolean(normalizeNickname(form.nickname)) &&
      hasChanges(form, this.data.initial);
    this.setData({ "form.nickname": form.nickname, canSave });
  },

  /**
   * 性别点选；再次点击已选项则取消，允许为空
   */
  onSelectGender(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.gender as Gender | undefined;
    if (value !== "male" && value !== "female") return;
    const gender = this.data.form.gender === value ? null : value;
    const form = { ...this.data.form, gender };
    this.setData({
      "form.gender": gender,
      canSave:
        Boolean(normalizeNickname(form.nickname)) &&
        hasChanges(form, this.data.initial),
    });
  },

  /**
   * 生日选择（原生 picker，返回 YYYY-MM-DD）
   */
  onBirthdayChange(event: WechatMiniprogram.PickerChange) {
    const birthday = String(event.detail.value || "");
    const form = { ...this.data.form, birthday };
    this.setData({
      "form.birthday": birthday,
      canSave:
        Boolean(normalizeNickname(form.nickname)) &&
        hasChanges(form, this.data.initial),
    });
  },

  /**
   * 保存：只提交变化字段；昵称必填
   */
  async onSave() {
    if (this.data.saving) return;

    const nickname = normalizeNickname(this.data.form.nickname);
    if (!nickname) return;

    if (!hasChanges(this.data.form, this.data.initial)) return;

    const payload: {
      nickname?: string;
      gender?: Gender | null;
      birthday?: string | null;
    } = {};
    if (nickname !== this.data.initial.nickname) {
      payload.nickname = nickname;
    }
    if ((this.data.form.gender ?? null) !== this.data.initial.gender) {
      payload.gender = this.data.form.gender ?? null;
    }
    if ((this.data.form.birthday || "") !== this.data.initial.birthday) {
      payload.birthday = this.data.form.birthday || null;
    }

    this.setData({ saving: true });
    try {
      const res = await updateUserProfile(payload);
      if (res?.data) {
        writeCachedProfile(res.data);
      }
      const form: ProfileForm = {
        nickname: res?.data?.nickname ?? nickname,
        gender: normalizeChildGender(res?.data?.gender),
        birthday: res?.data?.birthday ?? "",
      };
      this.setData({
        saving: false,
        form,
        initial: toSnapshot(form),
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
