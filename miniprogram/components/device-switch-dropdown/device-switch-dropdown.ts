/**
 * 共享「孩子设备下拉」组件。
 *
 * 首页导航栏（variant="nav"）与「更懂TA」页头（默认 pill）共用同一份实现：
 * 单设备不展开；选中后只抛 change，由页面决定是否加载报告 / 切换卡片。
 */
Component({
  properties: {
    /** 可选设备：{ id, name }，name 由页面用 getDeviceDisplayName 解析好 */
    devices: {
      type: Array,
      value: [] as Array<{ id: string; name: string }>,
    },
    /** 当前选中设备 id */
    selectedId: {
      type: String,
      value: "",
    },
    /** 当前选中设备展示名（loading 时忽略） */
    selectedName: {
      type: String,
      value: "",
    },
    /** 设备列表加载中：触发按钮显示「加载设备中」 */
    loading: {
      type: Boolean,
      value: false,
    },
    /** pill = 更懂TA 页头淡紫胶囊；nav = 首页导航栏白底描边 */
    variant: {
      type: String,
      value: "pill",
    },
  },

  data: {
    open: false,
  },

  observers: {
    devices(devices: Array<unknown>) {
      const length = Array.isArray(devices) ? devices.length : 0;
      if (length <= 1 && this.data.open) {
        this.setData({ open: false });
      }
    },
  },

  pageLifetimes: {
    hide() {
      if (this.data.open) {
        this.setData({ open: false });
      }
    },
  },

  methods: {
    onToggle() {
      if (this.data.devices.length <= 1) return;
      this.setData({ open: !this.data.open });
    },

    onClose() {
      if (this.data.open) {
        this.setData({ open: false });
      }
    },

    onSelect(event: WechatMiniprogram.TouchEvent) {
      const deviceId = String(event?.currentTarget?.dataset?.id || "");
      this.setData({ open: false });
      if (!deviceId || deviceId === this.data.selectedId) return;
      this.triggerEvent("change", { deviceId });
    },
  },
});
