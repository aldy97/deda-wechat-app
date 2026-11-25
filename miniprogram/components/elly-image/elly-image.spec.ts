import { installComponentHarness } from "../../tests/component-harness";
import { loadAppAssets, resolveAppAsset } from "../../utils/app-assets";

jest.mock("../../utils/app-assets", () => ({
  loadAppAssets: jest.fn(),
  resolveAppAsset: jest.fn(),
}));

const mockLoadAppAssets = loadAppAssets as jest.Mock;
const mockResolveAppAsset = resolveAppAsset as jest.Mock;

const harness = installComponentHarness();

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("elly-image component", () => {
  beforeAll(() => {
    require("./elly-image");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadAppAssets.mockReset();
    mockResolveAppAsset.mockReset();
    mockResolveAppAsset.mockReturnValue(null);
  });

  it("attached 先渲染 fallback，再尝试 manifest", async () => {
    mockLoadAppAssets.mockResolvedValue({ version: "", assets: {} });
    const instance = harness.createInstance({
      assetKey: "diagnostics/remote-probe",
      fallback: "/static/images/kid-info/logo.png",
    });

    instance.lifetimes.attached();

    expect(instance.setData).toHaveBeenCalledWith({
      displayedSrc: "/static/images/kid-info/logo.png",
      useWebp: false,
      errored: false,
    });

    await flushAsync();
    expect(mockLoadAppAssets).toHaveBeenCalled();
  });

  it("fallback 为空字符串时渲染空 src", () => {
    mockLoadAppAssets.mockResolvedValue({ version: "", assets: {} });
    const instance = harness.createInstance({
      assetKey: "diagnostics/remote-probe",
      fallback: "",
    });

    instance.lifetimes.attached();

    expect(instance.setData).toHaveBeenCalledWith({
      displayedSrc: "",
      useWebp: false,
      errored: false,
    });
  });

  it("命中 manifest：切换远程 URL 并允许 webp", async () => {
    mockLoadAppAssets.mockResolvedValue({ version: "v1", assets: {} });
    mockResolveAppAsset.mockReturnValue({
      url: "https://cdn.example.com/remote-probe.png",
    });
    const instance = harness.createInstance({
      assetKey: "diagnostics/remote-probe",
      fallback: "/static/images/kid-info/logo.png",
    });

    instance.lifetimes.attached();
    await flushAsync();

    expect(instance.setData).toHaveBeenCalledWith({
      displayedSrc: "https://cdn.example.com/remote-probe.png",
      useWebp: true,
      errored: false,
    });
  });

  it("未命中保持 fallback，不切换到远程", async () => {
    mockLoadAppAssets.mockResolvedValue({ version: "", assets: {} });
    mockResolveAppAsset.mockReturnValue(null);
    const instance = harness.createInstance({
      assetKey: "diagnostics/remote-probe",
      fallback: "/static/images/kid-info/logo.png",
    });

    instance.lifetimes.attached();
    await flushAsync();

    expect(instance.setData).toHaveBeenCalledTimes(1);
    expect(instance.setData).toHaveBeenCalledWith({
      displayedSrc: "/static/images/kid-info/logo.png",
      useWebp: false,
      errored: false,
    });
  });

  it("manifest 拉取失败保持 fallback", async () => {
    mockLoadAppAssets.mockRejectedValue(new Error("network down"));
    const instance = harness.createInstance({
      assetKey: "diagnostics/remote-probe",
      fallback: "/static/images/kid-info/logo.png",
    });

    instance.lifetimes.attached();
    await flushAsync();

    expect(instance.setData).toHaveBeenCalledTimes(1);
  });

  it("detached 后 Promise 返回不得 setData", async () => {
    let resolveLoad: (value: any) => void = () => {};
    mockLoadAppAssets.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    mockResolveAppAsset.mockReturnValue({
      url: "https://cdn.example.com/remote-probe.png",
    });
    const instance = harness.createInstance({
      assetKey: "diagnostics/remote-probe",
      fallback: "/static/images/kid-info/logo.png",
    });

    instance.lifetimes.attached();
    instance.lifetimes.detached();
    resolveLoad({ version: "", assets: {} });
    await flushAsync();

    expect(instance.setData).toHaveBeenCalledTimes(1);
  });

  it("远程 binderror 回退本地 fallback", () => {
    const instance = harness.createInstance({
      assetKey: "diagnostics/remote-probe",
      fallback: "/static/images/kid-info/logo.png",
    });
    instance.setData({
      displayedSrc: "https://cdn.example.com/remote-probe.png",
      useWebp: true,
    });

    instance.onImageError();

    expect(instance.setData).toHaveBeenLastCalledWith({
      displayedSrc: "/static/images/kid-info/logo.png",
      useWebp: false,
      errored: false,
    });
  });

  it("远程 binderror 且 fallback 为空：清空远程并保持非 webp", () => {
    const instance = harness.createInstance({
      assetKey: "diagnostics/remote-probe",
      fallback: "",
    });
    instance.setData({
      displayedSrc: "https://cdn.example.com/remote-probe.png",
      useWebp: true,
    });

    instance.onImageError();

    expect(instance.setData).toHaveBeenLastCalledWith({
      displayedSrc: "",
      useWebp: false,
      errored: false,
    });
  });

  it("本地 fallback 也失败：显示占位，不循环重试", () => {
    const instance = harness.createInstance({
      assetKey: "diagnostics/remote-probe",
      fallback: "/static/images/kid-info/logo.png",
    });
    instance.setData({ useWebp: false });

    instance.onImageError();

    expect(instance.setData).toHaveBeenLastCalledWith({ errored: true });
  });

  it("detached 后 binderror 不 setData", () => {
    const instance = harness.createInstance({
      assetKey: "diagnostics/remote-probe",
      fallback: "/static/images/kid-info/logo.png",
    });
    instance.lifetimes.detached();

    instance.onImageError();

    expect(instance.setData).not.toHaveBeenCalled();
  });
});
