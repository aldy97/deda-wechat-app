/**
 * elly-image 组件契约：fallback 首帧、manifest 命中切换、加载成功回传原始宽高、
 * 远程失败回退与卸载后不再写数据。
 */
import { installComponentHarness } from "../../tests/component-harness";
import { isDevEnv } from "../../config/api.config";
import {
  forceRefreshAppAssets,
  loadAppAssets,
  resolveAppAsset,
  takeMissHealChance,
} from "../../utils/app-assets";

jest.mock("../../utils/app-assets", () => ({
  loadAppAssets: jest.fn(),
  resolveAppAsset: jest.fn(),
  forceRefreshAppAssets: jest.fn(),
  takeMissHealChance: jest.fn(),
}));

jest.mock("../../config/api.config", () => ({
  isDevEnv: jest.fn(() => false),
}));

const mockLoadAssets = loadAppAssets as jest.Mock;
const mockResolveAsset = resolveAppAsset as jest.Mock;
const mockForceRefresh = forceRefreshAppAssets as jest.Mock;
const mockTakeHeal = takeMissHealChance as jest.Mock;
const mockIsDevEnv = isDevEnv as jest.Mock;

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
    mockForceRefresh.mockResolvedValue({ version: "", assets: {} });
    // 默认不消耗自愈额度：保持既有用例的「未命中就保持 fallback」语义
    mockTakeHeal.mockReturnValue(false);
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

  it("远程图失败且没有 fallback：回落到空串而不是 undefined", async () => {
    const instance = create({ fallback: "" });

    instance.lifetimes.attached();
    await flush();
    expect(instance.data.displayedSrc).toBe("");

    instance.setData({ displayedSrc: REMOTE, useWebp: true });
    instance.onImageError();

    expect(instance.data.displayedSrc).toBe("");
    expect(instance.data.errored).toBe(false);
  });

  it("组件已卸载：图片失败时不再写数据", () => {
    const instance = create();
    instance.detached = true;
    instance.setData({ displayedSrc: REMOTE, useWebp: true });

    instance.onImageError();

    expect(instance.data.displayedSrc).toBe(REMOTE);
    expect(instance.data.errored).toBe(false);
  });

  it("fallback 也失败：显示占位且不再重试", () => {
    const instance = create();
    instance.setData({ displayedSrc: FALLBACK, useWebp: false });

    instance.onImageError();

    expect(instance.data.errored).toBe(true);
  });

  it("manifest 未命中：消耗一次自愈额度，强制刷新命中后切图", async () => {
    mockTakeHeal.mockReturnValue(true);
    mockResolveAsset
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ url: REMOTE });
    const instance = create({ assetKey: "adventure-story/hero-bg" });

    instance.lifetimes.attached();
    await flush();
    await flush();

    expect(mockForceRefresh).toHaveBeenCalledTimes(1);
    expect(instance.data.displayedSrc).toBe(REMOTE);
    expect(instance.data.useWebp).toBe(true);
    expect(instance.triggerEvent).not.toHaveBeenCalledWith(
      "unavailable",
      expect.anything(),
    );
  });

  it("自愈后仍未命中：抛 unavailable(lookup)，hero 页保持空串", async () => {
    mockTakeHeal.mockReturnValue(true);
    const instance = create({
      fallback: "",
      assetKey: "adventure-story/hero-bg",
    });

    instance.lifetimes.attached();
    await flush();
    await flush();

    expect(mockForceRefresh).toHaveBeenCalledTimes(1);
    expect(instance.data.displayedSrc).toBe("");
    expect(instance.triggerEvent).toHaveBeenCalledWith("unavailable", {
      assetKey: "adventure-story/hero-bg",
      reason: "lookup",
    });
  });

  it("本会话没有自愈额度：不发强制刷新，直接抛 unavailable(lookup)", async () => {
    mockTakeHeal.mockReturnValue(false);
    const instance = create({
      fallback: "",
      assetKey: "adventure-story/hero-bg",
    });

    instance.lifetimes.attached();
    await flush();
    await flush();

    expect(mockForceRefresh).not.toHaveBeenCalled();
    expect(instance.triggerEvent).toHaveBeenCalledWith("unavailable", {
      assetKey: "adventure-story/hero-bg",
      reason: "lookup",
    });
  });

  it("manifest 拉取失败：抛 unavailable(manifest)，hero 页保持空串", async () => {
    mockLoadAssets.mockRejectedValue(new Error("network"));
    const instance = create({
      fallback: "",
      assetKey: "adventure-story/hero-bg",
    });

    instance.lifetimes.attached();
    await flush();

    expect(instance.data.displayedSrc).toBe("");
    expect(instance.triggerEvent).toHaveBeenCalledWith("unavailable", {
      assetKey: "adventure-story/hero-bg",
      reason: "manifest",
    });
  });

  it("远程图失败且没有 fallback：抛 unavailable(load)，回落到空串", () => {
    const instance = create({
      fallback: "",
      assetKey: "adventure-story/hero-bg",
    });
    instance.setData({ displayedSrc: REMOTE, useWebp: true });

    instance.onImageError();

    expect(instance.data.displayedSrc).toBe("");
    expect(instance.triggerEvent).toHaveBeenCalledWith("unavailable", {
      assetKey: "adventure-story/hero-bg",
      reason: "load",
    });
  });

  it("远程图失败但有 fallback：不抛 unavailable（页面上仍有图）", () => {
    const instance = create({ assetKey: "owner-info/mascot" });
    instance.setData({ displayedSrc: REMOTE, useWebp: true });

    instance.onImageError();

    expect(instance.triggerEvent).not.toHaveBeenCalledWith(
      "unavailable",
      expect.anything(),
    );
  });

  it("unavailable 每个实例只抛一次", () => {
    const instance = create({
      fallback: "",
      assetKey: "adventure-story/hero-bg",
    });
    instance.setData({ displayedSrc: REMOTE, useWebp: true });

    instance.onImageError();
    instance.setData({ displayedSrc: REMOTE, useWebp: true });
    instance.onImageError();

    const calls = (instance.triggerEvent as jest.Mock).mock.calls.filter(
      (call) => call[0] === "unavailable",
    );
    expect(calls).toHaveLength(1);
  });

  it("有包内兜底图时 manifest 失败不抛 unavailable：页面上仍有图可显示", async () => {
    mockLoadAssets.mockRejectedValue(new Error("network"));
    const instance = create({ assetKey: "owner-info/mascot" });

    instance.lifetimes.attached();
    await flush();

    expect(instance.data.displayedSrc).toBe(FALLBACK);
    expect(instance.triggerEvent).not.toHaveBeenCalledWith(
      "unavailable",
      expect.anything(),
    );
  });

  it("组件已卸载：自愈结果不再写数据也不再抛事件", async () => {
    mockTakeHeal.mockReturnValue(true);
    const instance = create({
      fallback: "",
      assetKey: "adventure-story/hero-bg",
    });
    instance.detached = true;

    instance.lifetimes.attached();
    await flush();
    await flush();

    expect(instance.data.displayedSrc).toBe("");
    expect(instance.triggerEvent).not.toHaveBeenCalledWith(
      "unavailable",
      expect.anything(),
    );
  });

  it("强制刷新失败：抛 unavailable(lookup)，hero 页保持空串", async () => {
    mockTakeHeal.mockReturnValue(true);
    mockForceRefresh.mockRejectedValue(new Error("network down"));
    const instance = create({
      fallback: "",
      assetKey: "adventure-story/hero-bg",
    });

    instance.lifetimes.attached();
    await flush();
    await flush();

    expect(instance.data.displayedSrc).toBe("");
    expect(instance.triggerEvent).toHaveBeenCalledWith("unavailable", {
      assetKey: "adventure-story/hero-bg",
      reason: "lookup",
    });
  });

  it("刷新期间组件被卸载：回来时不再写数据", async () => {
    mockTakeHeal.mockReturnValue(true);
    let releaseRefresh: (value: unknown) => void = () => {};
    mockForceRefresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseRefresh = resolve;
        }),
    );
    const instance = create({ assetKey: "adventure-story/hero-bg" });

    instance.lifetimes.attached();
    await flush();
    instance.detached = true;
    releaseRefresh({ version: "", assets: {} });
    await flush();
    await flush();

    expect(instance.data.displayedSrc).toBe(FALLBACK);
    expect(instance.triggerEvent).not.toHaveBeenCalledWith(
      "unavailable",
      expect.anything(),
    );
  });

  it("开发环境打一条 warn，便于真机调试定位缺失展示位", async () => {
    mockIsDevEnv.mockReturnValueOnce(true);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const instance = create({
      fallback: "",
      assetKey: "adventure-story/hero-bg",
    });
    instance.lifetimes.attached();
    await flush();
    await flush();

    expect(warn).toHaveBeenCalledWith(
      "[elly-image] unavailable",
      "adventure-story/hero-bg",
      "lookup",
    );
    warn.mockRestore();
  });
});
