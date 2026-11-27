import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  ensureAuthToken: jest.fn(),
  getDeviceList: jest.fn(),
  updateDeviceOrder: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe("child list page", () => {
  const harness = installPageHarness();
  let page: any;

  beforeAll(() => {
    require("./child-list");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
    harness.wx.getWindowInfo = jest.fn().mockReturnValue({ windowWidth: 375 });
    mockApi.ensureAuthToken.mockResolvedValue("token");
    mockApi.getDeviceList.mockResolvedValue({
      data: [
        {
          id: "dev-001",
          name: "DEV001",
          childProfile: { name: "乐乐", gender: "female" },
        },
        {
          id: "dev 002",
          name: "DEV002",
          childProfile: { englishName: "Bagel", gender: null },
        },
      ],
    });
    mockApi.updateDeviceOrder.mockResolvedValue({
      data: { orderedDeviceIds: ["dev 002", "dev-001"] },
    });
  });

  it("loads children from devices and navigates with deviceId", async () => {
    await page.onLoad();
    page.onReady();
    await page.initialLoad;

    expect(page.data.children).toMatchObject([
      { deviceId: "dev-001", name: "乐乐" },
      { deviceId: "dev 002", name: "Bagel" },
    ]);

    page.onChildTap({ currentTarget: { dataset: { deviceId: "dev 002" } } });
    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/child-info/child-info?deviceId=dev%20002",
    });
  });

  it("maps gender from child profile for avatar rendering", async () => {
    await page.onLoad();
    page.onReady();
    await page.initialLoad;

    expect(page.data.children.map((item: any) => item.gender)).toEqual([
      "female",
      null,
    ]);
  });

  it("shows an error state when the device request fails", async () => {
    mockApi.getDeviceList.mockRejectedValue(new Error("offline"));

    await page.onLoad();
    page.onReady();
    await page.initialLoad;

    expect(page.data.loadError).toBe(true);
    expect(page.data.loading).toBe(false);
    expect(page.data.children).toEqual([]);
  });

  it("首个 onShow 早于 onReady：不重复发请求", async () => {
    page.onLoad();
    page.onShow();
    page.onReady();
    await page.initialLoad;

    expect(mockApi.getDeviceList).toHaveBeenCalledTimes(1);
  });

  it("onShow 二次进入：静默刷新，loading 不翻 true、旧列表保持渲染", async () => {
    page.onLoad();
    page.onReady();
    await page.initialLoad;
    expect(mockApi.getDeviceList).toHaveBeenCalledTimes(1);

    let resolveList!: (value: unknown) => void;
    mockApi.getDeviceList.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    page.onShow();
    await flushMicrotasks();

    expect(page.data.loading).toBe(false);
    expect(page.data.children.map((item: any) => item.deviceId)).toEqual([
      "dev-001",
      "dev 002",
    ]);
    expect(mockApi.getDeviceList).toHaveBeenCalledTimes(2);

    resolveList({
      data: [
        {
          id: "dev-001",
          name: "DEV001",
          childProfile: { name: "乐乐", gender: "male" },
        },
      ],
    });
    await flushMicrotasks();

    expect(page.data.children).toMatchObject([
      { deviceId: "dev-001", gender: "male" },
    ]);
  });

  it("静默刷新失败：保留旧列表，不进入错误态", async () => {
    page.onLoad();
    page.onReady();
    await page.initialLoad;

    mockApi.getDeviceList.mockRejectedValue(new Error("offline"));
    page.onShow();
    await flushMicrotasks();

    expect(page.data.children).toHaveLength(2);
    expect(page.data.loadError).toBe(false);
  });

  it("排序保存或拖拽中 onShow 不刷新，避免冲掉乐观顺序", async () => {
    page.onLoad();
    page.onReady();
    await page.initialLoad;

    page.setData({ saving: true });
    page.onShow();
    await flushMicrotasks();
    expect(mockApi.getDeviceList).toHaveBeenCalledTimes(1);

    page.setData({ saving: false });
    page.onDragStart({
      currentTarget: { dataset: { index: 0 } },
      touches: [{ clientY: 100 }],
    });
    page.onShow();
    await flushMicrotasks();
    expect(mockApi.getDeviceList).toHaveBeenCalledTimes(1);
  });

  it("puts the complete order after dragging the first child down", async () => {
    page.onLoad();
    page.onReady();
    await page.initialLoad;
    page.onDragStart({
      currentTarget: { dataset: { index: 0 } },
      touches: [{ clientY: 100 }],
    });
    page.onDragMove({ touches: [{ clientY: 276 }] });
    await page.onDragEnd();

    expect(mockApi.updateDeviceOrder).toHaveBeenCalledWith([
      "dev 002",
      "dev-001",
    ]);
    expect(page.data.children.map((item: any) => item.deviceId)).toEqual([
      "dev 002",
      "dev-001",
    ]);
    expect(page.data.children.map((item: any) => item.gender)).toEqual([
      null,
      "female",
    ]);
    expect(page.data.saving).toBe(false);
  });

  it("restores the previous order when saving fails", async () => {
    mockApi.updateDeviceOrder.mockRejectedValue(new Error("save failed"));
    await page.onLoad();
    page.onReady();
    await page.initialLoad;
    page.onDragStart({
      currentTarget: { dataset: { index: 0 } },
      touches: [{ clientY: 100 }],
    });
    page.onDragMove({ touches: [{ clientY: 276 }] });
    await page.onDragEnd();

    expect(page.data.children.map((item: any) => item.deviceId)).toEqual([
      "dev-001",
      "dev 002",
    ]);
    expect(harness.wx.showToast).toHaveBeenCalledWith({
      title: "排序保存失败",
      icon: "none",
    });
  });

  it("onChildTap 缺少 deviceId：不导航", () => {
    page.onChildTap({ currentTarget: { dataset: {} } });

    expect(harness.wx.navigateTo).not.toHaveBeenCalled();
  });

  it("从第 2 项向上拖到第 1 项：顺序与 gender 一起移动", async () => {
    await page.onLoad();
    page.onReady();
    await page.initialLoad;
    page.onDragStart({
      currentTarget: { dataset: { index: 1 } },
      touches: [{ clientY: 300 }],
    });
    page.onDragMove({ touches: [{ clientY: 100 }] });
    await page.onDragEnd();

    expect(page.data.children.map((item: any) => item.deviceId)).toEqual([
      "dev 002",
      "dev-001",
    ]);
    expect(page.data.children.map((item: any) => item.gender)).toEqual([
      null,
      "female",
    ]);
  });

  it("拖拽超出边界：位移被夹在首尾槽位之间", async () => {
    await page.onLoad();
    page.onReady();
    await page.initialLoad;
    page.onDragStart({
      currentTarget: { dataset: { index: 0 } },
      touches: [{ clientY: 100 }],
    });
    page.onDragMove({ touches: [{ clientY: 9999 }] });
    await page.onDragEnd();

    expect(page.data.children.map((item: any) => item.deviceId)).toEqual([
      "dev 002",
      "dev-001",
    ]);
  });

  it("服务端返回不完整顺序：保留本地乐观顺序", async () => {
    mockApi.updateDeviceOrder.mockResolvedValue({
      data: { orderedDeviceIds: ["ghost", "dev 002"] },
    });
    await page.onLoad();
    page.onReady();
    await page.initialLoad;
    page.onDragStart({
      currentTarget: { dataset: { index: 0 } },
      touches: [{ clientY: 100 }],
    });
    page.onDragMove({ touches: [{ clientY: 276 }] });
    await page.onDragEnd();

    expect(page.data.children.map((item: any) => item.deviceId)).toEqual([
      "dev 002",
      "dev-001",
    ]);
    expect(page.data.saving).toBe(false);
  });

  it("拖拽取消：恢复原始顺序并收起拖拽态", async () => {
    await page.onLoad();
    page.onReady();
    await page.initialLoad;
    page.onDragStart({
      currentTarget: { dataset: { index: 0 } },
      touches: [{ clientY: 100 }],
    });
    page.onDragMove({ touches: [{ clientY: 276 }] });
    page.onDragCancel();

    expect(page.data.children.map((item: any) => item.deviceId)).toEqual([
      "dev-001",
      "dev 002",
    ]);
    expect(page.data.draggingIndex).toBe(-1);
  });

  it("onDragStart 在保存中或不足两个孩子时不启动", async () => {
    await page.onLoad();
    page.onReady();
    await page.initialLoad;
    page.setData({ saving: true });
    page.onDragStart({
      currentTarget: { dataset: { index: 0 } },
      touches: [{ clientY: 100 }],
    });
    expect(page.dragState).toBeNull();

    page.setData({ saving: false, children: [page.data.children[0]] });
    page.onDragStart({
      currentTarget: { dataset: { index: 0 } },
      touches: [{ clientY: 100 }],
    });
    expect(page.dragState).toBeNull();
  });

  it("onDragMove / onDragEnd / onDragCancel 无状态时安全返回", async () => {
    page.onDragMove({ touches: [{ clientY: 100 }] });
    await page.onDragEnd();
    page.onDragCancel();

    expect(page.data.draggingIndex).toBe(-1);
  });
});
