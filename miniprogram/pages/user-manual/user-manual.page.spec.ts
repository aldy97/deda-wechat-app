import { installPageHarness } from "../../tests/page-harness";
import { loadAppAssets, resolveAppAsset } from "../../utils/app-assets";

// 小程序 wx typings 与 @types/node 全局声明冲突，不能混用；
// 这里用 wx typings 已声明的全局 require 引入 node 模块（返回 any）。
declare const __dirname: string;

jest.mock("../../utils/app-assets", () => ({
  loadAppAssets: jest.fn(),
  resolveAppAsset: jest.fn(),
}));

const mockLoadAppAssets = loadAppAssets as jest.Mock;
const mockResolveAppAsset = resolveAppAsset as jest.Mock;

const harness = installPageHarness();

require("./user-manual");

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

// 事故背景（2026-11-28）：说明书长图 1280×11785 / 900KB 直接打进包，
// 真机调试上传报 80051（2441KB > 2MB）。图片已迁到远端素材通道，
// 页面只保留 URL 解析与空态兜底，包内不得再出现该图。
describe("user-manual page", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadAppAssets.mockReset();
    mockResolveAppAsset.mockReset();
    page = harness.createInstance();
  });

  it("manifest 命中：渲染远程 URL 并结束加载态", async () => {
    mockLoadAppAssets.mockResolvedValue({ version: "v1", assets: {} });
    mockResolveAppAsset.mockReturnValue({
      url: "https://cdn.example.com/user-manual.jpg",
    });

    page.onLoad();
    await flushAsync();

    expect(page.data.loading).toBe(false);
    expect(page.data.manualUrl).toBe("https://cdn.example.com/user-manual.jpg");
  });

  it("manifest 未登记该展示位：不渲染图片，显示空态", async () => {
    mockLoadAppAssets.mockResolvedValue({ version: "v1", assets: {} });
    mockResolveAppAsset.mockReturnValue(null);

    page.onLoad();
    await flushAsync();

    expect(page.data.loading).toBe(false);
    expect(page.data.manualUrl).toBe("");
  });

  it("manifest 拉取失败：不抛错，落空态", async () => {
    mockLoadAppAssets.mockRejectedValue(new Error("network down"));

    page.onLoad();
    await flushAsync();

    expect(page.data.loading).toBe(false);
    expect(page.data.manualUrl).toBe("");
  });

  it("页面只按远端素材 key 取图，包内不再引用手册长图", () => {
    const fs = require("fs");
    const path = require("path");
    const read = (name: string) =>
      fs.readFileSync(path.join(__dirname, name), "utf-8");

    expect(read("user-manual.ts")).toContain("user-manual/long-image");
    expect(read("user-manual.wxml")).toContain('mode="widthFix"');
    expect(read("user-manual.wxml")).not.toContain(
      "/static/images/user-manual.jpg",
    );
    expect(
      fs.existsSync(
        path.join(__dirname, "../../static/images/user-manual.jpg"),
      ),
    ).toBe(false);
  });
});
