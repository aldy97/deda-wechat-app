import { loadAppAssets, resolveAppAsset } from "../../utils/app-assets";

/**
 * 说明书长图走远端素材通道。
 *
 * 事故背景（2026-11-28）：原图 1280×11785 / 900KB 直接打进包，真机调试上传
 * 报 80051（source size 2441KB > 2MB）。图片已从仓库移出，改由 app-assets
 * manifest 下发 URL；manifest 未登记或拉取失败时显示空态，不阻塞页面。
 */
const MANUAL_ASSET_KEY = "user-manual/long-image";

Page({
  data: {
    manualUrl: "",
    loading: true,
  },

  onLoad() {
    loadAppAssets()
      .then(() => {
        const entry = resolveAppAsset(MANUAL_ASSET_KEY);
        this.setData({
          manualUrl: entry ? entry.url : "",
          loading: false,
        });
      })
      .catch(() => {
        this.setData({ manualUrl: "", loading: false });
      });
  },
});
