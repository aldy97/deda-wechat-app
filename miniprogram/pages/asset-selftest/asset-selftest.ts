import {
  forceRefreshAppAssets,
  loadAppAssets,
  resolveAppAsset,
} from "../../utils/app-assets";
import type { AppAssetManifest } from "../../utils/app-assets";
import { APP_ASSET_KEYS } from "../../constants/app-asset-keys";

function getEnvVersion(): string {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion;
  } catch (error) {
    // 非微信环境按开发环境处理，便于单测与自检
    return "develop";
  }
}

function resolveProbeUrl(): string {
  const entry = resolveAppAsset(APP_ASSET_KEYS.DIAGNOSTICS_REMOTE_PROBE);
  return entry ? entry.url : "";
}

function buildProbeState(manifest: AppAssetManifest): {
  manifestVersion: string;
  probeUrl: string;
} {
  return {
    manifestVersion: manifest.version || "",
    probeUrl: resolveProbeUrl(),
  };
}

/** 素材自检页（仅 dev/trial 展示内容；release 显示门控提示）。 */
Page({
  data: {
    release: false,
    loading: true,
    refreshing: false,
    manifestStatus: "",
    manifestVersion: "",
    probeUrl: "",
  },

  onLoad() {
    const envVersion = getEnvVersion();
    if (envVersion === "release") {
      this.setData({ release: true, loading: false });
      return;
    }
    this.loadManifest();
  },

  loadManifest() {
    this.setData({ loading: true });
    return loadAppAssets()
      .then((manifest) => {
        this.setData({
          loading: false,
          manifestStatus: "已加载",
          ...buildProbeState(manifest),
        });
      })
      .catch(() => {
        this.setData({ loading: false, manifestStatus: "加载失败" });
      });
  },

  onForceRefresh() {
    if (this.data.refreshing) return;
    this.setData({ refreshing: true });
    return forceRefreshAppAssets()
      .then((manifest) => {
        this.setData({
          refreshing: false,
          manifestStatus: "已加载",
          ...buildProbeState(manifest),
        });
      })
      .catch(() => {
        this.setData({ refreshing: false, manifestStatus: "加载失败" });
      });
  },
});
