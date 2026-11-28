/**
 * 展开 / 收起箭头（CSS 画的 V 形，不是图标字体）。
 *
 * 收起时 V 朝下、展开时朝上，靠 transform 过渡做 180° 反转：
 * 不需要两张图、不会出现图标切换时的闪烁，尺寸与描边由属性传入。
 * 颜色走 currentColor，跟随使用处的文字颜色，不额外引入色板变量。
 */
Component({
  properties: {
    /** 是否展开：true 时箭头翻转朝上 */
    open: {
      type: Boolean,
      value: false,
    },
    /** 箭头边长（rpx） */
    size: {
      type: Number,
      value: 12,
    },
    /** 描边宽度（rpx） */
    weight: {
      type: Number,
      value: 3,
    },
  },
});
