/**
 * 自定义导航栏尺寸工具的单测。
 *
 * 覆盖：正常胶囊对齐、胶囊缺失/异常回退、API 抛错回退。
 */
import {
  DEFAULT_NAV_BAR_HEIGHT,
  DEFAULT_STATUS_BAR_HEIGHT,
  readNavBarMetrics,
} from "./nav-bar";

const wxStub = {
  getWindowInfo: jest.fn(),
  getMenuButtonBoundingClientRect: jest.fn(),
};

(globalThis as any).wx = wxStub;

describe("readNavBarMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wxStub.getWindowInfo.mockReturnValue({ statusBarHeight: 20 });
    wxStub.getMenuButtonBoundingClientRect.mockReturnValue({
      top: 26,
      height: 32,
    });
  });

  it("按状态栏高度与胶囊中线计算导航栏高度", () => {
    wxStub.getWindowInfo.mockReturnValue({ statusBarHeight: 24 });
    wxStub.getMenuButtonBoundingClientRect.mockReturnValue({
      top: 28,
      height: 30,
    });

    // (28 - 24) * 2 + 30 = 38
    expect(readNavBarMetrics()).toEqual({
      statusBarHeight: 24,
      navBarHeight: 38,
    });
  });

  it("默认胶囊：状态栏 20、导航栏 44", () => {
    expect(readNavBarMetrics()).toEqual({
      statusBarHeight: DEFAULT_STATUS_BAR_HEIGHT,
      navBarHeight: DEFAULT_NAV_BAR_HEIGHT,
    });
  });

  it("胶囊 top 小于状态栏或高度为 0：导航栏回退默认值", () => {
    wxStub.getWindowInfo.mockReturnValue({ statusBarHeight: 24 });
    wxStub.getMenuButtonBoundingClientRect.mockReturnValue({
      top: 10,
      height: 32,
    });
    expect(readNavBarMetrics()).toEqual({
      statusBarHeight: 24,
      navBarHeight: DEFAULT_NAV_BAR_HEIGHT,
    });

    wxStub.getMenuButtonBoundingClientRect.mockReturnValue({
      top: 26,
      height: 0,
    });
    expect(readNavBarMetrics()).toEqual({
      statusBarHeight: 24,
      navBarHeight: DEFAULT_NAV_BAR_HEIGHT,
    });
  });

  it("状态栏高度不是数字：保留默认状态栏高度", () => {
    wxStub.getWindowInfo.mockReturnValue({});

    expect(readNavBarMetrics().statusBarHeight).toBe(
      DEFAULT_STATUS_BAR_HEIGHT,
    );
  });

  it("取胶囊信息抛错：整体回退默认值", () => {
    wxStub.getMenuButtonBoundingClientRect.mockImplementation(() => {
      throw new Error("not supported");
    });

    expect(readNavBarMetrics()).toEqual({
      statusBarHeight: DEFAULT_STATUS_BAR_HEIGHT,
      navBarHeight: DEFAULT_NAV_BAR_HEIGHT,
    });
  });
});
