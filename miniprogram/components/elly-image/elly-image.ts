import {
  forceRefreshAppAssets,
  loadAppAssets,
  resolveAppAsset,
  takeMissHealChance,
} from "../../utils/app-assets";
import { isDevEnv } from "../../config/api.config";

/**
 * 组件实例上不在 data 声明的内部标记。
 * 用显式接口替代 `this as any`，detached 后不再 setData。
 */
interface EllyImageSelf {
  detached?: boolean;
  /** unavailable 事件每个实例只抛一次，避免调用方重复收窄版式 */
  unavailableNotified?: boolean;
}

/** 拿不到展示内容的原因：manifest 没拉到 / 键未命中 / 图片加载失败 */
type UnavailableReason = "manifest" | "lookup" | "load";

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
      (this as unknown as typeof this & EllyImageSelf).detached = true;
    },
  },
  methods: {
    loadRemoteAsset() {
      const self = this as unknown as typeof this & EllyImageSelf;
      return loadAppAssets()
        .then(() => {
          if (self.detached) return;
          if (this.applyRemoteAsset()) return;
          return this.healRemoteAsset();
        })
        .catch(() => {
          // manifest 拉取失败：保持 fallback，并告知调用方拿不到图
          this.notifyUnavailable("manifest");
        });
    },

    /** 命中展示位时切到远程图；返回是否命中 */
    applyRemoteAsset(): boolean {
      const self = this as unknown as typeof this & EllyImageSelf;
      const entry = resolveAppAsset(self.data.assetKey);
      if (!entry) return false;
      self.setData({
        displayedSrc: entry.url,
        useWebp: true,
        errored: false,
      });
      return true;
    },

    /**
     * 未命中展示位：用「每会话一次」的额度强制刷新 manifest 再解析。
     *
     * 设备上可能长期持有旧 manifest（拉取失败会回退旧缓存，且页面只拉一次），
     * 表现为新上传的图在真机永远不出现。这条自愈路径让第一次进页面就能拿到。
     */
    healRemoteAsset() {
      const self = this as unknown as typeof this & EllyImageSelf;
      if (!takeMissHealChance()) {
        this.notifyUnavailable("lookup");
        return;
      }
      return forceRefreshAppAssets()
        .then(() => {
          if (self.detached) return;
          if (this.applyRemoteAsset()) return;
          this.notifyUnavailable("lookup");
        })
        .catch(() => {
          this.notifyUnavailable("lookup");
        });
    },

    /** 告知使用方当前拿不到任何可显示内容（页面据此收窄占位高度） */
    notifyUnavailable(reason: UnavailableReason) {
      const self = this as unknown as typeof this & EllyImageSelf;
      if (self.detached || self.unavailableNotified) return;
      // 还有包内兜底图可显示时不打扰调用方，避免页面上有图却把版式收窄
      if (!this.data.errored && this.data.displayedSrc) return;
      self.unavailableNotified = true;
      if (isDevEnv()) {
        console.warn("[elly-image] unavailable", this.data.assetKey, reason);
      }
      this.triggerEvent("unavailable", {
        assetKey: this.data.assetKey,
        reason,
      });
    },

    onImageError() {
      const self = this as unknown as typeof this & EllyImageSelf;
      if (self.detached) return;
      if (this.data.useWebp) {
        // 远程图片失败 → 回退本地 fallback
        const fallback = this.data.fallback || "";
        this.setData({
          displayedSrc: fallback,
          useWebp: false,
          errored: false,
        });
        // 没有包内兜底图：页面上什么都不会显示，需要显式告知
        if (!fallback) this.notifyUnavailable("load");
        return;
      }
      // 本地 fallback 也失败 → 显示占位，不再重试
      this.setData({ errored: true });
      this.notifyUnavailable("load");
    },

    /**
     * 图片加载成功：把原始宽高抛给调用方，供按图片自身比例定高的版式使用。
     */
    onImageLoad(event: WechatMiniprogram.CustomEvent) {
      const detail = event?.detail || {};
      this.triggerEvent("load", {
        width: detail.width,
        height: detail.height,
      });
    },
  },
});
