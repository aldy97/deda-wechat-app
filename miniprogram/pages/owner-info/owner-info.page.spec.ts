/**
 * owner-info 孩子信息页装配测试（page-harness）。
 * 锁定设计稿改版后的行为：
 * - 绑定成功后自动进入（from=bind）与设置入口共用同一页；
 * - 昵称/英文名/性别卡片/生日四项的读取与保存；
 * - 昵称必填；保存成功后按来源继续（绑定引导 → 哄睡设置；设置入口 → 返回）；
 * - 自定义导航尺寸与生日上限。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getOwnerInfo: jest.fn(),
  updateOwnerInfo: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const harness = installPageHarness();
require("./owner-info");

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    code: 0,
    message: "",
    data: {
      id: "profile-id",
      name: "乐乐",
      englishName: "Bagel",
      gender: "female",
      birthday: "2023-12-21",
      ...overrides,
    },
  };
}

function createLoadedPage(options: Record<string, string>) {
  const page = harness.createInstance();
  page.onLoad(options);
  return page;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("owner-info page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    harness.wx.getWindowInfo.mockReturnValue({
      statusBarHeight: 20,
      pixelRatio: 2,
      windowWidth: 375,
    });
    harness.wx.getMenuButtonBoundingClientRect.mockReturnValue({
      top: 26,
      height: 32,
      bottom: 58,
      left: 281,
      right: 368,
      width: 87,
    });
    mockApi.getOwnerInfo.mockResolvedValue(profile());
    mockApi.updateOwnerInfo.mockResolvedValue({
      code: 0,
      message: "",
      data: {},
    });
  });

  it("按胶囊按钮计算自定义导航高度，并设置生日上限", () => {
    harness.wx.getWindowInfo.mockReturnValueOnce({
      statusBarHeight: 24,
      pixelRatio: 2,
      windowWidth: 375,
    });
    harness.wx.getMenuButtonBoundingClientRect.mockReturnValueOnce({
      top: 30,
      height: 36,
      bottom: 66,
      left: 281,
      right: 368,
      width: 87,
    });

    const page = createLoadedPage({ id: "dev-001" });

    expect(page.data.statusBarHeight).toBe(24);
    expect(page.data.navBarHeight).toBe(48);
    expect(page.data.maxBirthday).toBeGreaterThan(0);
    expect(page.data.maxBirthday).toBeLessThanOrEqual(Date.now());
  });

  it("读取档案时回填昵称、英文名、性别和生日", async () => {
    const page = createLoadedPage({ id: "dev-001" });
    await page.onReady();
    await flushMicrotasks();

    expect(mockApi.getOwnerInfo).toHaveBeenCalledWith("dev-001");
    expect(page.data.form).toEqual({
      name: "乐乐",
      englishName: "Bagel",
      gender: "female",
      birthday: "2023-12-21",
    });
    expect(page.data.loadError).toBe(false);
    expect(page.data.loading).toBe(false);
  });

  it("没有 deviceId 时直接进入错误态，不请求接口", async () => {
    const page = createLoadedPage({});
    await page.onReady();
    await flushMicrotasks();

    expect(mockApi.getOwnerInfo).not.toHaveBeenCalled();
    expect(page.data.loading).toBe(false);
    expect(page.data.loadError).toBe(true);
  });

  it("性别卡片支持选中、取消和切换", () => {
    const page = createLoadedPage({ id: "dev-001" });

    page.onSelectGender({
      currentTarget: { dataset: { gender: "male" } },
    });
    expect(page.data.form.gender).toBe("male");

    page.onSelectGender({
      currentTarget: { dataset: { gender: "male" } },
    });
    expect(page.data.form.gender).toBeNull();

    page.onSelectGender({
      currentTarget: { dataset: { gender: "female" } },
    });
    expect(page.data.form.gender).toBe("female");
  });

  it("昵称与英文名输入写回表单", () => {
    const page = createLoadedPage({ id: "dev-001" });

    page.onNameChange({ detail: { value: "熊熊" } });
    page.onEnglishNameChange({ detail: { value: "Bear" } });

    expect(page.data.form.name).toBe("熊熊");
    expect(page.data.form.englishName).toBe("Bear");
  });

  it("保存时提交四项字段并清理设备列表缓存", async () => {
    jest.useFakeTimers();
    try {
      const page = createLoadedPage({ id: "dev-001" });
      await page.onReady();
      await flushMicrotasks();

      page.setData({
        "form.name": "熊熊",
        "form.englishName": "Bear",
        "form.gender": "male",
        "form.birthday": "2021-01-02",
      });
      await page.onSave();

      expect(mockApi.updateOwnerInfo).toHaveBeenCalledWith("dev-001", {
        name: "熊熊",
        englishName: "Bear",
        gender: "male",
        birthday: "2021-01-02",
      });
      expect(harness.wx.removeStorageSync).toHaveBeenCalledWith(
        "device_list_cache",
      );
      jest.advanceTimersByTime(800);
    } finally {
      jest.useRealTimers();
    }
  });

  it("昵称为空时提示且不提交", async () => {
    const page = createLoadedPage({ id: "dev-001" });
    await page.onReady();
    await flushMicrotasks();

    page.setData({ "form.name": "   " });
    await page.onSave();

    expect(mockApi.updateOwnerInfo).not.toHaveBeenCalled();
    expect(harness.wx.showToast).toHaveBeenCalledWith({
      title: "请输入昵称",
      icon: "none",
    });
  });

  it("加载失败后展示错误态，重试可恢复", async () => {
    const page = harness.createInstance();
    mockApi.getOwnerInfo.mockRejectedValueOnce(new Error("boom"));
    page.onLoad({ id: "dev-001" });
    await page.onReady();
    await flushMicrotasks();

    expect(page.data.loadError).toBe(true);
    expect(page.data.loading).toBe(false);

    mockApi.getOwnerInfo.mockResolvedValueOnce(profile());
    await page.onRetryLoad();
    await flushMicrotasks();

    expect(page.data.loadError).toBe(false);
    expect(page.data.form.name).toBe("乐乐");
  });

  it("from=bind 保存成功：redirectTo 哄睡设置，带 from=bind 继续流程", async () => {
    jest.useFakeTimers();
    try {
      const page = createLoadedPage({ id: "dev-002", from: "bind" });
      await page.onReady();
      await flushMicrotasks();

      page.setData({ "form.name": "熊熊" });
      await page.onSave();
      jest.advanceTimersByTime(800);

      expect(harness.wx.redirectTo).toHaveBeenCalledWith({
        url: "/pages/sleep-manage/sleep-manage?id=dev-002&from=bind",
      });
      expect(harness.wx.switchTab).not.toHaveBeenCalled();
      expect(harness.wx.navigateBack).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("已有档案预填后不改任何字段，直接保存即可进入哄睡设置", async () => {
    jest.useFakeTimers();
    try {
      const page = createLoadedPage({ id: "dev-003", from: "bind" });
      await page.onReady();
      await flushMicrotasks();

      expect(page.data.form).toMatchObject({
        name: "乐乐",
        englishName: "Bagel",
        gender: "female",
        birthday: "2023-12-21",
      });

      await page.onSave();
      jest.advanceTimersByTime(800);

      expect(mockApi.updateOwnerInfo).toHaveBeenCalledWith(
        "dev-003",
        expect.objectContaining({ name: "乐乐" }),
      );
      expect(harness.wx.redirectTo).toHaveBeenCalledWith({
        url: "/pages/sleep-manage/sleep-manage?id=dev-003&from=bind",
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("常规进入保存成功：维持 navigateBack 行为", async () => {
    jest.useFakeTimers();
    try {
      const page = createLoadedPage({ id: "dev-001" });
      await page.onReady();
      await flushMicrotasks();

      page.setData({ "form.name": "熊熊" });
      await page.onSave();
      jest.advanceTimersByTime(800);

      expect(harness.wx.navigateBack).toHaveBeenCalled();
      expect(harness.wx.switchTab).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("from=bind 返回键等同稍后再填：回设备列表", () => {
    const page = createLoadedPage({ id: "dev-002", from: "bind" });
    page.onBack();

    expect(harness.wx.switchTab).toHaveBeenCalledWith({
      url: "/pages/device-list/device-list",
    });
  });

  it("常规进入返回键：navigateBack 回设置页", () => {
    const page = createLoadedPage({ id: "dev-001" });
    page.onBack();

    expect(harness.wx.navigateBack).toHaveBeenCalled();
  });

  it("from=bind 标记来自配网引导", async () => {
    const page = createLoadedPage({ id: "dev-002", from: "bind" });
    await page.onReady();
    await flushMicrotasks();

    expect(page.data.deviceId).toBe("dev-002");
    expect(page.data.fromBind).toBe(true);
  });

  it("页头气泡文案两条，绑定引导与日常进入共用同一份数据", () => {
    const page = createLoadedPage({ id: "dev-001" });

    expect(page.data.bubbleLines).toHaveLength(2);
    expect(page.data.bubbleLines[0]).toContain("请先录入宝贝的信息吧");
    expect(page.data.bubbleLines[1]).toContain("语速、用词和内容");
  });

  it("档案为空时表单回到空值，日期选择器落在默认日期", async () => {
    mockApi.getOwnerInfo.mockResolvedValueOnce({
      code: 0,
      message: "",
      data: null,
    });
    const page = createLoadedPage({ id: "dev-001" });
    await page.onReady();
    await flushMicrotasks();

    expect(page.data.form).toEqual({
      name: "",
      englishName: "",
      birthday: "",
      gender: null,
    });

    page.onOpenDatePicker();
    expect(page.data.showDatePicker).toBe(true);
    expect(page.data.currentDate).toBe(new Date("2020-05-20").getTime());
  });

  it("取不到系统信息时导航尺寸退回默认值", () => {
    harness.wx.getWindowInfo.mockImplementationOnce(() => {
      throw new Error("no window info");
    });

    const page = createLoadedPage({ id: "dev-001" });

    expect(page.data.statusBarHeight).toBe(20);
    expect(page.data.navBarHeight).toBe(44);
  });

  it("胶囊位置异常或高度为 0 时不覆盖默认导航高度", () => {
    harness.wx.getWindowInfo.mockReturnValueOnce({
      statusBarHeight: 24,
      pixelRatio: 2,
      windowWidth: 375,
    });
    harness.wx.getMenuButtonBoundingClientRect.mockReturnValueOnce({
      top: 10,
      height: 32,
      bottom: 42,
      left: 281,
      right: 368,
      width: 87,
    });
    const page = createLoadedPage({ id: "dev-001" });
    expect(page.data.navBarHeight).toBe(44);

    harness.wx.getWindowInfo.mockReturnValueOnce({
      statusBarHeight: 24,
      pixelRatio: 2,
      windowWidth: 375,
    });
    harness.wx.getMenuButtonBoundingClientRect.mockReturnValueOnce({
      top: 30,
      height: 0,
      bottom: 30,
      left: 281,
      right: 368,
      width: 87,
    });
    const secondPage = createLoadedPage({ id: "dev-001" });
    expect(secondPage.data.navBarHeight).toBe(44);
  });

  it("忽略非法性别值，不改变当前选择", () => {
    const page = createLoadedPage({ id: "dev-001" });
    page.onSelectGender({
      currentTarget: { dataset: { gender: "female" } },
    });

    page.onSelectGender({ currentTarget: { dataset: {} } });

    expect(page.data.form.gender).toBe("female");
  });

  it("日期选择器支持打开、关闭、滚动和确认", async () => {
    const page = createLoadedPage({ id: "dev-001" });
    await page.onReady();
    await flushMicrotasks();

    page.onOpenDatePicker();
    expect(page.data.showDatePicker).toBe(true);
    expect(page.data.currentDate).toBe(new Date("2023-12-21").getTime());

    page.onCloseDatePicker();
    expect(page.data.showDatePicker).toBe(false);

    const timestamp = new Date(2022, 0, 2).getTime();
    page.onDateChange({ detail: timestamp });
    expect(page.data.form.birthday).toBe("2022-01-02");

    page.onDateConfirm({ detail: timestamp });
    expect(page.data.form.birthday).toBe("2022-01-02");
    expect(page.data.showDatePicker).toBe(false);
  });

  it("选填字段为空时提交 undefined 与 null", async () => {
    jest.useFakeTimers();
    try {
      const page = createLoadedPage({ id: "dev-001" });
      await page.onReady();
      await flushMicrotasks();

      page.setData({
        "form.name": "熊熊",
        "form.englishName": "",
        "form.birthday": "",
        "form.gender": null,
      });
      await page.onSave();
      jest.advanceTimersByTime(800);

      expect(mockApi.updateOwnerInfo).toHaveBeenCalledWith("dev-001", {
        name: "熊熊",
        englishName: undefined,
        birthday: undefined,
        gender: null,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("保存中重复点击不会重复提交", async () => {
    jest.useFakeTimers();
    try {
      const page = createLoadedPage({ id: "dev-001" });
      await page.onReady();
      await flushMicrotasks();
      page.setData({ "form.name": "熊熊" });

      const pending = deferred<{ code: number }>();
      mockApi.updateOwnerInfo.mockReturnValueOnce(pending.promise);

      const firstSave = page.onSave();
      await Promise.resolve();
      expect(page.data.saving).toBe(true);

      await page.onSave();
      expect(mockApi.updateOwnerInfo).toHaveBeenCalledTimes(1);

      pending.resolve({ code: 0 });
      await firstSave;
      jest.advanceTimersByTime(800);
    } finally {
      jest.useRealTimers();
    }
  });

  it("保存失败时恢复可保存状态并提示", async () => {
    const page = createLoadedPage({ id: "dev-001" });
    await page.onReady();
    await flushMicrotasks();
    page.setData({ "form.name": "熊熊" });
    mockApi.updateOwnerInfo.mockRejectedValueOnce(new Error("network"));

    await page.onSave();

    expect(page.data.saving).toBe(false);
    expect(harness.wx.showToast).toHaveBeenCalledWith({
      title: "保存失败",
      icon: "none",
    });
  });

  it("清理缓存异常不影响保存流程", () => {
    harness.wx.removeStorageSync.mockImplementationOnce(() => {
      throw new Error("storage broken");
    });
    const page = createLoadedPage({ id: "dev-001" });

    expect(() => page.clearDeviceListCache()).not.toThrow();
  });
});
