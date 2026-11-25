import { loadAppAssets, resolveAppAsset } from "../../utils/app-assets";

/**
 * 展示型素材图片组件。
 *
 * attached 先渲染本地 fallback，再尝试 manifest；命中则切到远程 URL，
 * 未命中/拉取失败保持 fallback。远程图片 binderror 回退 fallback；
 * fallback 也失败则显示占位，不循环重试。
 */
Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    assetKey: {
      type: String,
      value: "",
    },
    fallback: {
      type: String,
      value: "",
    },
    mode: {
      type: String,
      value: "aspectFill",
    },
    lazyLoad: {
      type: Boolean,
      value: true,
    },
  },
  data: {
    displayedSrc: "",
    useWebp: false,
    errored: false,
  },
  lifetimes: {
    attached() {
      this.setData({
        displayedSrc: this.data.fallback || "",
        useWebp: false,
        errored: false,
      });
      this.loadRemoteAsset();
    },
    detached() {
      (this as any).detached = true;
    },
  },
  methods: {
    loadRemoteAsset() {
      const self = this as any;
      return loadAppAssets()
        .then(() => {
          if (self.detached) return;
          const entry = resolveAppAsset(self.data.assetKey);
          if (!entry) return;
          self.setData({
            displayedSrc: entry.url,
            useWebp: true,
            errored: false,
          });
        })
        .catch(() => {
          // manifest 拉取失败：保持 fallback，不做切换
        });
    },

    onImageError() {
      if ((this as any).detached) return;
      if (this.data.useWebp) {
        // 远程图片失败 → 回退本地 fallback
        this.setData({
          displayedSrc: this.data.fallback || "",
          useWebp: false,
          errored: false,
        });
        return;
      }
      // 本地 fallback 也失败 → 显示占位，不再重试
      this.setData({ errored: true });
    },
  },
});
