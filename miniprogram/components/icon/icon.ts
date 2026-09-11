/**
 * 通用 SVG 图标组件
 * 基于 Phosphor Icons 风格，支持 name、size、color 属性。
 */
Component({
  properties: {
    /** 图标名称，对应 static/icons/ 下的文件名（不含 .svg） */
    name: {
      type: String,
      value: '',
    },
    /** 图标尺寸，支持 rpx 单位或数字（默认 40rpx） */
    size: {
      type: String,
      value: '40rpx',
    },
    /** 图标颜色 */
    color: {
      type: String,
      value: '#4a90d9',
    },
  },

  data: {
    iconPath: '',
    iconStyle: '',
  },

  observers: {
    'name, size, color': function (name: string, size: string, color: string) {
      this.updateIcon(name, size, color);
    },
  },

  methods: {
    updateIcon(name: string, size: string, color: string) {
      if (!name) return;
      const iconPath = `/static/icons/${name}.svg`;
      const iconStyle = `width: ${size}; height: ${size}; color: ${color};`;
      this.setData({ iconPath, iconStyle });
    },
  },
});
