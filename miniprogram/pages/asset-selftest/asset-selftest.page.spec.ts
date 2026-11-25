import { installPageHarness } from "../../tests/page-harness";
import {
  forceRefreshAppAssets,
  loadAppAssets,
  resolveAppAsset,
} from "../../utils/app-assets";

jest.mock("../../utils/app-assets", () => ({
  forceRefreshAppAssets: jest.fn(),
  loadAppAssets: jest.fn(),
  resolveAppAsset: jest.fn(),
}));

const mockLoadAppAssets = loadAppAssets as jest.Mock;
const mockForceRefreshAppAssets = forceRefreshAppAssets as jest.Mock;
const mockResolveAppAsset = resolveAppAsset as jest.Mock;

const harness = installPageHarness();

require("./asset-selftest");

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("asset-selftest page", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadAppAssets.mockReset();
    mockForceRefreshAppAssets.mockReset();
    mockResolveAppAsset.mockReset();
    harness.wx.getAccountInfoSync.mockReturnValue({
      miniProgram: { envVersion: "develop", version: "1.2.3" },
    });
    page = harness.createInstance();
  });

  it("release 环境：显示门控文案，不加载 manifest", async () => {
    harness.wx.getAccountInfoSync.mockReturnValue({
      miniProgram: { envVersion: "release", version: "1.2.3" },
    });

    page.onLoad();
    await flushAsync();

    expect(page.data.release).toBe(true);
    expect(page.data.loading).toBe(false);
    expect(mockLoadAppAssets).not.toHaveBeenCalled();
  });

  it("dev 环境成功：展示 manifest 状态、版本与探针 URL", async () => {
    mockLoadAppAssets.mockResolvedValue({ version: "v1", assets: {} });
    mockResolveAppAsset.mockReturnValue({
      url: "https://cdn.example.com/remote-probe.png",
    });

    page.onLoad();
    await flushAsync();

    expect(mockLoadAppAssets).toHaveBeenCalled();
    expect(page.data.loading).toBe(false);
    expect(page.data.manifestStatus).toBe("已加载");
    expect(page.data.manifestVersion).toBe("v1");
    expect(page.data.probeUrl).toBe("https://cdn.example.com/remote-probe.png");
  });

  it("dev 环境失败：展示加载失败状态", async () => {
    mockLoadAppAssets.mockRejectedValue(new Error("network down"));

    page.onLoad();
    await flushAsync();

    expect(page.data.loading).toBe(false);
    expect(page.data.manifestStatus).toBe("加载失败");
  });

  it("manifest 未命中：probeUrl 为空", async () => {
    mockLoadAppAssets.mockResolvedValue({ version: "v1", assets: {} });
    mockResolveAppAsset.mockReturnValue(null);

    page.onLoad();
    await flushAsync();

    expect(page.data.manifestVersion).toBe("v1");
    expect(page.data.probeUrl).toBe("");
  });

  it("manifest 版本为空：manifestVersion 回退为空串", async () => {
    mockLoadAppAssets.mockResolvedValue({ version: "", assets: {} });
    mockResolveAppAsset.mockReturnValue(null);

    page.onLoad();
    await flushAsync();

    expect(page.data.manifestVersion).toBe("");
  });

  it("wx.getAccountInfoSync 抛错：按 develop 处理并加载 manifest", async () => {
    harness.wx.getAccountInfoSync.mockImplementation(() => {
      throw new Error("no account info");
    });
    mockLoadAppAssets.mockResolvedValue({ version: "v1", assets: {} });

    page.onLoad();
    await flushAsync();

    expect(mockLoadAppAssets).toHaveBeenCalled();
    expect(page.data.release).toBe(false);
  });

  it("强制刷新成功：更新状态并复位 refreshing", async () => {
    mockForceRefreshAppAssets.mockResolvedValue({ version: "v2", assets: {} });
    mockResolveAppAsset.mockReturnValue({
      url: "https://cdn.example.com/remote-probe-v2.png",
    });

    await page.onForceRefresh();

    expect(mockForceRefreshAppAssets).toHaveBeenCalled();
    expect(page.data.refreshing).toBe(false);
    expect(page.data.manifestStatus).toBe("已加载");
    expect(page.data.manifestVersion).toBe("v2");
    expect(page.data.probeUrl).toBe(
      "https://cdn.example.com/remote-probe-v2.png",
    );
  });

  it("强制刷新失败：展示加载失败并复位 refreshing", async () => {
    mockForceRefreshAppAssets.mockRejectedValue(new Error("network down"));

    await page.onForceRefresh();

    expect(page.data.refreshing).toBe(false);
    expect(page.data.manifestStatus).toBe("加载失败");
  });

  it("强制刷新进行中：忽略重复点击", async () => {
    page.setData({ refreshing: true });

    await page.onForceRefresh();

    expect(mockForceRefreshAppAssets).not.toHaveBeenCalled();
  });
});
