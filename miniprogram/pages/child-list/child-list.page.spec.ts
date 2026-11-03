import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  ensureAuthToken: jest.fn(),
  getDeviceList: jest.fn(),
  updateDeviceOrder: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

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
        { id: "dev-001", name: "DEV001", childProfile: { name: "乐乐" } },
        {
          id: "dev 002",
          name: "DEV002",
          childProfile: { englishName: "Bagel" },
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

  it("shows an error state when the device request fails", async () => {
    mockApi.getDeviceList.mockRejectedValue(new Error("offline"));

    await page.onLoad();
    page.onReady();
    await page.initialLoad;

    expect(page.data.loadError).toBe(true);
    expect(page.data.loading).toBe(false);
    expect(page.data.children).toEqual([]);
  });

  it("puts the complete order after dragging the first child down", async () => {
    await page.onLoad();
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
});
