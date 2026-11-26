import { getOwnerInfo, updateOwnerInfo, OwnerInfo } from "../../api/api";
import { formatDate } from "../../utils/date";

/** 设备列表缓存键（与 device-list 保持一致） */
const DEVICE_LIST_CACHE_KEY = "device_list_cache";

/** 取不到系统信息时的导航栏兜底尺寸（px） */
const DEFAULT_STATUS_BAR_HEIGHT = 20;
const DEFAULT_NAV_BAR_HEIGHT = 44;

/** 未填生日时日期选择器的默认落点 */
const DEFAULT_BIRTHDAY = new Date("2020-05-20").getTime();

type Gender = "male" | "female";

/**
 * 孩子信息页
 * 绑定成功后自动引导进入，也可从设备设置页再次进入编辑。
 * 展示并编辑昵称、英文名、性别与生日。
 */
Page({
  data: {
    deviceId: "",
    /** 绑定成功后自动引导进入（来自配网页 redirectTo） */
    fromBind: false,
    /** 页面加载中 */
    loading: true,
    /** 加载失败 */
    loadError: false,
    /** 保存中 */
    saving: false,
    /** 自定义导航栏：状态栏高度（px） */
    statusBarHeight: DEFAULT_STATUS_BAR_HEIGHT,
    /** 自定义导航栏：导航栏内容高度（px），与微信胶囊按钮垂直对齐 */
    navBarHeight: DEFAULT_NAV_BAR_HEIGHT,
    /** 生日选择器上限：今天 */
    maxBirthday: Date.now(),
    /** 装饰性爪印分隔（固定 4 枚） */
    pawItems: ["paw-1", "paw-2", "paw-3", "paw-4"],
    /** 页头气泡文案（仅在绑定引导流程展示） */
    bubbleLines: [
      "请先录入宝贝的信息吧～",
      "我们会根据孩子的年龄调整对话的语速、用词和内容，请尽量准确填写",
    ],
    /** 表单数据 */
    form: {
      name: "",
      englishName: "",
      birthday: "",
      gender: null,
    } as OwnerInfo,
    /** 是否显示日期选择弹窗 */
    showDatePicker: false,
    /** 日期选择器当前值的时间戳 */
    currentDate: DEFAULT_BIRTHDAY,
  },

  onLoad(options: Record<string, string>) {
    const deviceId = options?.id || "";
    this.applyNavBarMetrics();
    this.setData({
      deviceId,
      fromBind: options?.from === "bind",
      maxBirthday: Date.now(),
      loading: Boolean(deviceId),
      loadError: !deviceId,
    });
  },

  onReady() {
    if (!this.data.deviceId) return;
    return this.fetchOwnerInfo(this.data.deviceId);
  },

  /**
   * 自定义导航栏尺寸：状态栏高度 + 菜单胶囊按钮的水平中线对齐。
   * 老基础库或测试环境取不到胶囊信息时退回 20 / 44 默认值。
   */
  applyNavBarMetrics() {
    let statusBarHeight = DEFAULT_STATUS_BAR_HEIGHT;
    let navBarHeight = DEFAULT_NAV_BAR_HEIGHT;

    try {
      const info = wx.getWindowInfo();
      if (typeof info?.statusBarHeight === "number") {
        statusBarHeight = info.statusBarHeight;
      }

      const menu = wx.getMenuButtonBoundingClientRect();
      if (menu && menu.top >= statusBarHeight && menu.height > 0) {
        navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
      }
    } catch (error) {
      // 取不到系统信息时保留默认值，页面仍可正常渲染
    }

    this.setData({ statusBarHeight, navBarHeight });
  },

  /**
   * 获取孩子信息
   */
  async fetchOwnerInfo(deviceId: string) {
    this.setData({ loading: true, loadError: false });
    try {
      const res = await getOwnerInfo(deviceId);
      const info = res.data;
      const birthday = info?.birthday || "";
      this.setData({
        "form.name": info?.name || "",
        "form.englishName": info?.englishName || "",
        "form.birthday": birthday,
        "form.gender": info?.gender ?? null,
        currentDate: birthday ? new Date(birthday).getTime() : DEFAULT_BIRTHDAY,
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
    return this.fetchOwnerInfo(this.data.deviceId);
  },

  /**
   * 昵称输入变化
   */
  onNameChange(event: WechatMiniprogram.Input) {
    this.setData({ "form.name": event.detail.value });
  },

  /**
   * 英文名输入变化
   */
  onEnglishNameChange(event: WechatMiniprogram.Input) {
    this.setData({ "form.englishName": event.detail.value });
  },

  /**
   * 性别卡片点选；再次点击已选项则取消，允许为空
   */
  onSelectGender(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.gender as Gender | undefined;
    if (value !== "male" && value !== "female") return;
    this.setData({
      "form.gender": this.data.form.gender === value ? null : value,
    });
  },

  /**
   * 返回：绑定引导链路等同「稍后再填」，设置链路回设置页
   */
  onBack() {
    if (this.data.fromBind) {
      wx.switchTab({ url: "/pages/device-list/device-list" });
      return;
    }
    wx.navigateBack();
  },

  /**
   * 打开日期选择器
   */
  onOpenDatePicker() {
    const currentDate = this.data.form.birthday
      ? new Date(this.data.form.birthday).getTime()
      : DEFAULT_BIRTHDAY;
    this.setData({ showDatePicker: true, currentDate });
  },

  /**
   * 关闭日期选择器
   */
  onCloseDatePicker() {
    this.setData({ showDatePicker: false });
  },

  /**
   * 日期选择器值变化
   */
  onDateChange(event: WechatMiniprogram.TouchEvent) {
    const timestamp = event.detail as unknown as number;
    this.setData({ "form.birthday": formatDate(timestamp, "YYYY-MM-DD") });
  },

  /**
   * 确认日期选择
   */
  onDateConfirm(event: WechatMiniprogram.TouchEvent) {
    const timestamp = event.detail as unknown as number;
    this.setData({
      "form.birthday": formatDate(timestamp, "YYYY-MM-DD"),
      showDatePicker: false,
    });
  },

  /**
   * 保存孩子信息
   */
  async onSave() {
    if (this.data.saving) return;

    const name = (this.data.form.name || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      const { englishName, birthday, gender } = this.data.form;
      await updateOwnerInfo(this.data.deviceId, {
        name,
        englishName: englishName || undefined,
        birthday: birthday || undefined,
        gender: gender || null,
      });
      this.setData({ saving: false });
      wx.showToast({ title: "保存成功", icon: "success" });
      // 保存成功后清除设备列表缓存，确保返回列表页时重新加载
      this.clearDeviceListCache();
      setTimeout(() => {
        if (this.data.fromBind) {
          // 绑定引导链路：继续下一步（哄睡设置），由哄睡页完成后回设备列表
          wx.redirectTo({
            url: `/pages/sleep-manage/sleep-manage?id=${encodeURIComponent(this.data.deviceId)}&from=bind`,
          });
        } else {
          wx.navigateBack();
        }
      }, 800);
    } catch (error) {
      this.setData({ saving: false });
      wx.showToast({ title: "保存失败", icon: "none" });
    }
  },

  /**
   * 清除设备列表缓存
   */
  clearDeviceListCache() {
    try {
      wx.removeStorageSync(DEVICE_LIST_CACHE_KEY);
    } catch (error) {
      console.warn("[owner-info] 清除设备列表缓存失败", error);
    }
  },
});
