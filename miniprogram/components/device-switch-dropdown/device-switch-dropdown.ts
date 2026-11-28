/**
 * 共享「孩子设备下拉」组件。
 *
 * 首页导航栏与「更懂TA」页头共用同一份实现（同一套尺寸，不做变体）：
 * 选中后只抛 change，由页面决定是否加载报告 / 切换卡片；
 * 传 addable 时菜单底部多一项「添加设备」，点击抛 add（首页把绑定入口收在这里）。
 */
Component({
  properties: {
    /** 可选设备：{ id, name, gender }，name 由页面用 getDeviceDisplayName 解析好 */
    devices: {
      type: Array,
      value: [] as Array<{ id: string; name: string; gender?: string }>,
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
    /** 当前选中孩子的性别，决定胶囊左侧头像；空值走中性头像 */
    selectedGender: {
      type: String,
      value: "",
    },
    /** 设备列表加载中：触发按钮显示「加载设备中」 */
    loading: {
      type: Boolean,
      value: false,
    },
    /** 菜单底部是否提供「添加设备」入口（设备列表页用） */
    addable: {
      type: Boolean,
      value: false,
    },
    /** 「添加设备」文案 */
    addLabel: {
      type: String,
      value: "添加设备",
    },
    /**
     * 菜单锚定方向：right = 右边缘对齐胶囊（页头在右侧时用），
     * left = 左边缘对齐胶囊（胶囊贴屏幕左边时用，否则 264rpx 的菜单会被推出屏幕）
     */
    menuAlign: {
      type: String,
      value: "right",
    },
  },

  data: {
    open: false,
  },

  observers: {
    devices(devices: Array<unknown>) {
      const length = Array.isArray(devices) ? devices.length : 0;
      // 只剩一个设备且不能添加时菜单没有意义，自动收起
      if (length <= 1 && !this.data.addable && this.data.open) {
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
      // 单设备时，只有「添加设备」入口能让菜单有意义
      if (this.data.devices.length <= 1 && !this.data.addable) return;
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

    onAdd() {
      this.setData({ open: false });
      this.triggerEvent("add");
    },
  },
});
