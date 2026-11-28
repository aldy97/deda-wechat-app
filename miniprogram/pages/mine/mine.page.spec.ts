import { installPageHarness } from "../../tests/page-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const mockApi = {
  getUserProfile: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const PROFILE = {
  id: "user-1",
  nickname: "熊爸爸",
  phone: "18016235670",
  createdAt: "2026-11-01T00:00:00.000Z",
  deviceCount: 2,
  childCount: 2,
};

const EMPTY_PROFILE = {
  ...PROFILE,
  nickname: null,
  deviceCount: 0,
  childCount: 0,
};

const harness = installPageHarness();

beforeAll(() => {
  require("./mine");
});

describe("mine page profile card", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    harness.wx.getStorageSync.mockReturnValue("");
    page = harness.createInstance();
    mockApi.getUserProfile.mockResolvedValue({
      code: 0,
      message: "",
      data: PROFILE,
    });
  });

  it("starts in the loading state and resolves into the filled state", async () => {
    expect(page.data.loading).toBe(true);

    await page.onShow();

    expect(page.data.loading).toBe(false);
    expect(page.data.loadError).toBe(false);
    expect(page.data.isEmptyProfile).toBe(false);
    expect(page.data.displayName).toBe("熊爸爸");
    expect(page.data.metaText).toBe("2 台设备 · 2 个孩子");
    expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
      "user_profile_cache",
      JSON.stringify(PROFILE),
    );
  });

  it("shows the empty state when the nickname is unset", async () => {
    mockApi.getUserProfile.mockResolvedValue({
      code: 0,
      message: "",
      data: EMPTY_PROFILE,
    });

    await page.onShow();

    expect(page.data.isEmptyProfile).toBe(true);
    expect(page.data.displayName).toBe("未设置昵称");
    expect(page.data.metaText).toBe("还没有绑定设备");
  });

  it("renders the cache before the request settles, then refreshes it", async () => {
    harness.wx.getStorageSync.mockReturnValue(JSON.stringify(PROFILE));
    let resolveRequest: (value: any) => void = () => undefined;
    mockApi.getUserProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const pending = page.onShow();

    expect(page.data.loading).toBe(false);
    expect(page.data.displayName).toBe("熊爸爸");

    const fresh = { ...PROFILE, nickname: "熊妈妈" };
    resolveRequest({ code: 0, message: "", data: fresh });
    await pending;

    expect(page.data.displayName).toBe("熊妈妈");
    expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
      "user_profile_cache",
      JSON.stringify(fresh),
    );
  });

  it("keeps showing the cache when the refresh fails", async () => {
    harness.wx.getStorageSync.mockReturnValue(JSON.stringify(PROFILE));
    mockApi.getUserProfile.mockRejectedValue(new Error("offline"));

    await page.onShow();

    expect(page.data.loading).toBe(false);
    expect(page.data.loadError).toBe(false);
    expect(page.data.displayName).toBe("熊爸爸");
  });

  it("shows the error state without a cache and retries on card tap", async () => {
    mockApi.getUserProfile.mockRejectedValueOnce(new Error("offline"));

    await page.onShow();

    expect(page.data.loading).toBe(false);
    expect(page.data.loadError).toBe(true);
    expect(harness.wx.navigateTo).not.toHaveBeenCalled();

    mockApi.getUserProfile.mockResolvedValue({
      code: 0,
      message: "",
      data: PROFILE,
    });
    await page.onProfileCardTap();

    expect(mockApi.getUserProfile).toHaveBeenCalledTimes(2);
    expect(page.data.loadError).toBe(false);
    expect(page.data.displayName).toBe("熊爸爸");
    expect(harness.wx.navigateTo).not.toHaveBeenCalled();
  });

  it("家长选了性别：资料卡头像用包内 dad/mum 图展示", async () => {
    mockApi.getUserProfile.mockResolvedValue({
      code: 0,
      message: "",
      data: { ...PROFILE, gender: "male" },
    });

    await page.onShow();

    expect(page.data.parentGender).toBe("male");
  });

  it("头像走包内静态图，src 是字面量（不走 manifest、不能动态绑定）", () => {
    const wxml: string = fs.readFileSync(
      path.join(__dirname, "mine.wxml"),
      "utf8",
    );

    expect(wxml).toContain('src="/static/images/parent-info/dad.png"');
    expect(wxml).toContain('src="/static/images/parent-info/mum.png"');
    expect(wxml).toContain("parentGender === 'male'");
    expect(wxml).toContain("parentGender === 'female'");
    // 静态资源闸口要求本地路径可静态解析
    expect(wxml).not.toContain('src="{{');
  });

  it("没选性别：保留原来的占位图标，不展示父母形象", async () => {
    await page.onShow();

    expect(page.data.parentGender).toBe("");

    const wxml: string = fs.readFileSync(
      path.join(__dirname, "mine.wxml"),
      "utf8",
    );
    expect(wxml).toContain('<van-icon wx:else name="user-o"');
  });

  it("opens the user profile page from the card", async () => {
    await page.onShow();

    page.onProfileCardTap();

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/user-profile/user-profile",
    });
  });

  it("treats an empty payload as a load failure", async () => {
    mockApi.getUserProfile.mockResolvedValue({
      code: 0,
      message: "",
      data: null,
    });

    await page.onShow();

    expect(page.data.loadError).toBe(true);
    expect(page.data.loading).toBe(false);
  });

  it("ignores card taps while the first load is still running", async () => {
    mockApi.getUserProfile.mockReturnValue(new Promise(() => undefined));

    page.onShow();
    page.onProfileCardTap();

    expect(mockApi.getUserProfile).toHaveBeenCalledTimes(1);
    expect(harness.wx.navigateTo).not.toHaveBeenCalled();
  });
});

describe("mine page navigation", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
  });

  it("opens the child list only through the dedicated handler", () => {
    page.onChildListTap();

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/child-list/child-list",
    });
    expect(page.onSettingsTap).toBeUndefined();
    expect(page.onContactTap).toBeUndefined();
  });

  it("opens the feedback page from the feedback entry", () => {
    page.onFeedbackTap();

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/feedback/feedback",
    });
  });

  it("opens the privacy policy from the privacy entry", () => {
    page.onPrivacyTap();

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/agreement/agreement?doc=privacy",
    });
  });

  it("opens the user agreement from the agreement entry", () => {
    page.onAgreementTap();

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/agreement/agreement?doc=terms",
    });
  });
});
