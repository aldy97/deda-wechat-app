/**
 * 科学原理 banner（共享组件）。
 *
 * 哄睡配置页与冒险故事页共用同一套胶囊版式；tone 只切换色板变量：
 * - sleep：粉色渐变 + 黄色 GO 徽标
 * - adventure：森林绿渐变 + 太阳黄 GO 徽标
 * 点击只抛 open 事件，导航目标由使用方决定。
 */
Component({
  properties: {
    /** 左侧文案，如「了解更多哄睡的科学原理」 */
    title: {
      type: String,
      value: "",
    },
    /** 色调：sleep / adventure；不传时默认 sleep */
    tone: {
      type: String,
      value: "sleep",
    },
  },
  methods: {
    onTap() {
      this.triggerEvent("open");
    },
  },
});
