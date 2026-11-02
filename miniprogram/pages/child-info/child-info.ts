import { ensureAuthToken, getChildProfile } from "../../api/api";

export function formatChildGender(gender?: string | null): string {
  const normalized = gender?.trim().toLowerCase();
  if (normalized === "male" || normalized === "m" || normalized === "男") {
    return "王子";
  }
  if (normalized === "female" || normalized === "f" || normalized === "女") {
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
    birthdayLabel: "未设置",
  },

  async onLoad(options: Record<string, string>) {
    const deviceId = options?.deviceId || "";
    this.setData({ deviceId });
    if (!deviceId) {
      this.setData({ loading: false, loadError: true });
      return;
    }
    await this.loadChildInfo();
  },

  async loadChildInfo() {
    this.setData({ loading: true, loadError: false });
    try {
      await ensureAuthToken();
      const res = await getChildProfile(this.data.deviceId);
      const profile = res.data;
      this.setData({
        childName: profile?.name || profile?.englishName || "未设置",
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
   * 跳转哄睡管理页
   */
  onGoSleepManage() {
    wx.navigateTo({
      url: `/pages/sleep-manage/sleep-manage?id=${this.data.deviceId}`,
    });
  },
});
