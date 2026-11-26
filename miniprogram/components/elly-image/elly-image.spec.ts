/**
 * elly-image 组件契约：fallback 首帧、manifest 命中切换、加载成功回传原始宽高、
 * 远程失败回退与卸载后不再写数据。
 */
import { installComponentHarness } from "../../tests/component-harness";
import { loadAppAssets, resolveAppAsset } from "../../utils/app-assets";

jest.mock("../../utils/app-assets", () => ({
  loadAppAssets: jest.fn(),
  resolveAppAsset: jest.fn(),
}));

const mockLoadAssets = loadAppAssets as jest.Mock;
const mockResolveAsset = resolveAppAsset as jest.Mock;

const FALLBACK = "/static/images/kid-info/logo.png";
const REMOTE = "https://cdn.example.com/hero.webp";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("elly-image 组件", () => {
  const harness = installComponentHarness();

  beforeAll(() => {
    require("./elly-image");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadAssets.mockResolvedValue({ version: "", assets: {} });
    mockResolveAsset.mockReturnValue(null);
  });

  function create(props: Record<string, unknown> = {}) {
    return harness.createInstance({ fallback: FALLBACK, ...props });
  }

  it("attached 先渲染 fallback，未命中 manifest 时保持不变", async () => {
    const instance = create({ assetKey: "owner-info/mascot" });

    instance.lifetimes.attached();
    await flush();

    expect(instance.data.displayedSrc).toBe(FALLBACK);
    expect(instance.data.useWebp).toBe(false);
    expect(instance.data.errored).toBe(false);
  });

  it("manifest 命中：切到远程 URL 并置 webp", async () => {
    mockResolveAsset.mockReturnValue({ url: REMOTE });
    const instance = create({ assetKey: "sleep-config/hero-bg" });

    instance.lifetimes.attached();
    await flush();

    expect(instance.data.displayedSrc).toBe(REMOTE);
    expect(instance.data.useWebp).toBe(true);
    expect(instance.data.errored).toBe(false);
  });

  it("manifest 拉取失败：保持 fallback", async () => {
    mockLoadAssets.mockRejectedValue(new Error("network"));
    const instance = create({ assetKey: "sleep-config/hero-bg" });

    instance.lifetimes.attached();
    await flush();

    expect(instance.data.displayedSrc).toBe(FALLBACK);
    expect(instance.data.useWebp).toBe(false);
  });

  it("组件已卸载：拿不到结果后不再写数据", async () => {
    mockResolveAsset.mockReturnValue({ url: REMOTE });
    const instance = create({ assetKey: "sleep-config/hero-bg" });
    instance.detached = true;

    instance.lifetimes.attached();
    await flush();

    expect(instance.data.displayedSrc).toBe(FALLBACK);
    expect(instance.data.useWebp).toBe(false);
  });

  it("detached 生命周期：标记已卸载", () => {
    const instance = create();

    instance.lifetimes.detached();

    expect(instance.detached).toBe(true);
  });

  it("图片加载成功：把原始宽高通过 load 事件抛给调用方", () => {
    const instance = create();

    instance.onImageLoad({ detail: { width: 1080, height: 640 } });

    expect(instance.triggerEvent).toHaveBeenCalledWith("load", {
      width: 1080,
      height: 640,
    });
  });

  it("缺少 detail：仍抛 load 事件，宽高为 undefined，不抛错", () => {
    const instance = create();

    instance.onImageLoad(undefined as never);

    expect(instance.triggerEvent).toHaveBeenCalledWith("load", {
      width: undefined,
      height: undefined,
    });
  });

  it("远程图失败：回退本地 fallback 并清掉 webp 标记", () => {
    const instance = create();
    instance.setData({ displayedSrc: REMOTE, useWebp: true });

    instance.onImageError();

    expect(instance.data.displayedSrc).toBe(FALLBACK);
    expect(instance.data.useWebp).toBe(false);
    expect(instance.data.errored).toBe(false);
  });

  it("远程图失败且没有 fallback：回落到空串而不是 undefined", () => {
    const instance = create({ fallback: "" });
    instance.setData({ displayedSrc: REMOTE, useWebp: true });

    instance.onImageError();

    expect(instance.data.displayedSrc).toBe("");
    expect(instance.data.errored).toBe(false);
  });

  it("fallback 也失败：显示占位且不再重试", () => {
    const instance = create();
    instance.setData({ displayedSrc: FALLBACK, useWebp: false });

    instance.onImageError();

    expect(instance.data.errored).toBe(true);
  });
});
