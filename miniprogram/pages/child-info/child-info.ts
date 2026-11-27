import { ensureAuthToken, getChildProfile } from "../../api/api";
import { normalizeChildGender } from "../../utils/child-gender";

export function formatChildGender(gender?: string | null): string {
  const normalized = normalizeChildGender(gender);
  if (normalized === "male") {
    return "王子";
  }
  if (normalized === "female") {
    return "公主";
  }
  return "未设置";
}

export function formatChildBirthday(birthday?: string | null): string {
  return birthday ? birthday.slice(0, 10).replace(/-/g, ".") : "未设置";
}

Page({
  data: {
    loading: true,
    loadError: false,
    deviceId: "",
    childName: "未设置",
    genderLabel: "未设置",
    avatarGender: "",
    birthdayLabel: "未设置",
  },

  onLoad(options: Record<string, string>) {
    const deviceId = options?.deviceId || "";
    this.setData({ deviceId });
    if (!deviceId) {
      this.setData({ loading: false, loadError: true });
    }
  },

  onReady() {
    if (!this.data.deviceId) return;
    return this.loadChildInfo();
  },

  async loadChildInfo() {
    this.setData({ loading: true, loadError: false });
    try {
      await ensureAuthToken();
      const res = await getChildProfile(this.data.deviceId);
      const profile = res.data;
      this.setData({
        childName: profile?.name || profile?.englishName || "未设置",
        avatarGender: profile?.gender ?? "",
        genderLabel: formatChildGender(profile?.gender),
        birthdayLabel: formatChildBirthday(profile?.birthday),
      });
    } catch (error) {
      this.setData({ loadError: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 跳转哄睡配置页
   */
  onGoSleepManage() {
    wx.navigateTo({
      url: `/pages/sleep-config/sleep-config?id=${this.data.deviceId}`,
    });
  },
});
