/**
 * about-device 页面装配测试。
 * 聚合设备详情、状态与本地环境；任一接口失败只影响对应分组。
 */
import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getDeviceAboutInfo: jest.fn(),
  getDeviceStatus: jest.fn(),
  ensureAuthToken: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const harness = installPageHarness();

require("./about-device");

const DETAIL = {
  deviceId: "aabbccddeeff",
  deviceCode: "1608281053529797520",
  firmwareVersion: "CMS1W8bd_V1.01_828_brtc_version",
  networkType: "WiFi",
  macAddress: "AABBCCDDEEFF",
  characterKey: "elly",
};

const STATUS = {
  deviceId: "aabbccddeeff",
  status: "online",
  battery: 65,
  volume: 80,
  isCharging: true,
  networkMode: "wifi",
  wifiRssi: -65,
  lastActiveAt: new Date(2026, 10, 25, 10, 32).toISOString(),
};

function mockAllSuccess() {
  mockApi.ensureAuthToken.mockResolvedValue(undefined);
  mockApi.getDeviceAboutInfo.mockResolvedValue({
    code: 0,
    message: "",
    data: DETAIL,
  });
  mockApi.getDeviceStatus.mockResolvedValue({
    code: 0,
    message: "",
    data: STATUS,
  });
}

describe("about-device page", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAllSuccess();
    page = harness.createInstance();
    page.onLoad({ id: "dev-1" });
  });

  it("onReady 聚合详情与状态并生成三个分组", async () => {
    await page.onReady();

    expect(mockApi.ensureAuthToken).toHaveBeenCalled();
    expect(mockApi.getDeviceAboutInfo).toHaveBeenCalledWith("dev-1");
    expect(mockApi.getDeviceStatus).toHaveBeenCalledWith("dev-1");
    expect(page.data.loading).toBe(false);
    expect(page.data.sections.map((section: any) => section.title)).toEqual([
      "设备身份",
      "运行状态",
      "版本与环境",
    ]);
    expect(page.data.collectedAt).toBeUndefined();

    const statusRows = page.data.sections[1].rows;
    expect(statusRows.map((row: any) => row.label)).toEqual([
      "在线状态",
      "电量",
      "音量",
      "网络",
    ]);
    expect(statusRows[0].value).toBe("在线");
    expect(statusRows[3].value).toBe("WiFi · -65 dBm");
  });

  it("本地环境信息进入版本分组，手机与系统分行", async () => {
    await page.onReady();

    const versionRows = page.data.sections[2].rows;
    expect(versionRows.find((row: any) => row.key === "wechat").value).toBe(
      "8.0.50",
    );
    expect(versionRows.find((row: any) => row.key === "phone").value).toBe(
      "iPhone 15",
    );
    expect(versionRows.find((row: any) => row.key === "system").value).toBe(
      "iOS 18.2",
    );
  });

  it("详情为 null：展示空态，不当作加载失败", async () => {
    mockApi.getDeviceAboutInfo.mockResolvedValue({
      code: 0,
      message: "",
      data: null,
    });

    await page.onReady();

    expect(page.data.sections).toEqual([]);
    expect(page.data.loadFailed).toBe(false);
    expect(harness.wx.showToast).not.toHaveBeenCalled();
  });

  it("详情加载失败：toast 并标记失败态", async () => {
    mockApi.getDeviceAboutInfo.mockRejectedValue(new Error("boom"));

    await page.onReady();

    expect(page.data.sections).toEqual([]);
    expect(page.data.loadFailed).toBe(true);
    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "加载失败" }),
    );
  });

  it("状态请求失败：状态分组显示未获取，身份/版本仍展示", async () => {
    mockApi.getDeviceStatus.mockRejectedValue(new Error("boom"));

    await page.onReady();

    expect(page.data.sections).toHaveLength(3);
    const statusRows = page.data.sections[1].rows;
    expect(statusRows.map((row: any) => row.value)).toEqual([
      "未获取",
      "未获取",
      "未获取",
      "未获取",
    ]);
  });

  it("状态 404：提示设备不存在或已解绑", async () => {
    mockApi.getDeviceStatus.mockRejectedValue(
      Object.assign(new Error("not found"), { statusCode: 404 }),
    );

    await page.onReady();

    const statusRows = page.data.sections[1].rows;
    expect(statusRows[0].value).toBe("设备不存在或已解绑");
  });

  it("状态请求无状态码兜底：按 failed 处理，不崩溃", async () => {
    mockApi.getDeviceStatus.mockRejectedValue(undefined);

    await page.onReady();

    const statusRows = page.data.sections[1].rows;
    expect(statusRows.map((row: any) => row.value)).toEqual([
      "未获取",
      "未获取",
      "未获取",
      "未获取",
    ]);
    expect(page.data.loadFailed).toBe(false);
  });

  it("重新检测：再次拉取状态并复位 refreshing", async () => {
    await page.onReady();
    expect(page.data.refreshing).toBe(false);

    await page.onRefresh();

    expect(mockApi.getDeviceStatus).toHaveBeenCalledTimes(2);
    expect(page.data.refreshing).toBe(false);
  });

  it("复制诊断信息：写入含设备 ID 的纯文本，不含采集时间", async () => {
    await page.onReady();

    page.onCopyDiagnostics();

    const call = harness.wx.setClipboardData.mock.calls[0][0];
    expect(call.data).toContain("【DEDA 设备诊断信息】");
    expect(call.data).not.toContain("采集时间");
    expect(call.data).toContain("设备 ID：aabbccddeeff");
    expect(call.data).toContain("【运行状态】");
    expect(call.data).toContain("在线状态：在线");
    expect(call.data).toContain("微信版本：8.0.50");
    expect(call.data).not.toContain("小程序版本");
    expect(call.data).not.toContain("基础库");
    expect(call.data).toContain("手机：iPhone 15");
    expect(call.data).toContain("系统：iOS 18.2");
    expect(call.data).not.toContain("当前对话模式");
  });

  it("复制诊断信息失败：toast 提示", async () => {
    await page.onReady();
    harness.wx.setClipboardData.mockImplementationOnce((options: any) => {
      options.fail?.();
    });

    page.onCopyDiagnostics();

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "复制失败" }),
    );
  });

  it("缺少 deviceId：不发请求，直接空态", async () => {
    const bare = harness.createInstance();
    bare.onLoad({});

    await bare.onReady();

    expect(mockApi.getDeviceAboutInfo).not.toHaveBeenCalled();
    expect(bare.data.loading).toBe(false);
    expect(bare.data.sections).toEqual([]);
  });

  it("本地环境 API 异常：版本分组回退未获取，页面不白屏", async () => {
    harness.wx.getAppBaseInfo.mockImplementationOnce(() => {
      throw new Error("no app base info");
    });
    harness.wx.getDeviceInfo.mockImplementationOnce(() => {
      throw new Error("no device info");
    });

    await page.onReady();

    const versionRows = page.data.sections[2].rows;
    expect(versionRows.find((row: any) => row.key === "wechat").value).toBe(
      "未获取",
    );
    expect(versionRows.find((row: any) => row.key === "phone").value).toBe(
      "未获取",
    );
    expect(versionRows.find((row: any) => row.key === "system").value).toBe(
      "未获取",
    );
    expect(page.data.loadFailed).toBe(false);
  });

  it("ensureAuthToken 失败：继续请求并正常渲染", async () => {
    mockApi.ensureAuthToken.mockRejectedValue(new Error("token failed"));

    await page.onReady();

    expect(page.data.sections).toHaveLength(3);
    expect(page.data.loadFailed).toBe(false);
  });

  it("重新检测进行中：忽略重复点击", async () => {
    page.setData({ refreshing: true });

    await page.onRefresh();

    expect(mockApi.getDeviceStatus).not.toHaveBeenCalled();
  });

  it("空分组时复制诊断信息不调用剪贴板", () => {
    page.onCopyDiagnostics();

    expect(harness.wx.setClipboardData).not.toHaveBeenCalled();
  });

  it("复制行：把 data-value 写入剪贴板", () => {
    page.onCopyRow({
      currentTarget: { dataset: { value: "aabbccddeeff" } },
    });

    expect(harness.wx.setClipboardData).toHaveBeenCalledWith(
      expect.objectContaining({ data: "aabbccddeeff" }),
    );
  });

  it("空值不触发剪贴板", () => {
    page.onCopyRow({ currentTarget: { dataset: { value: "" } } });

    expect(harness.wx.setClipboardData).not.toHaveBeenCalled();
  });

  it("复制失败：toast 提示", () => {
    harness.wx.setClipboardData.mockImplementationOnce((options: any) => {
      options.fail?.();
    });

    page.onCopyRow({ currentTarget: { dataset: { value: "abc" } } });

    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "复制失败" }),
    );
  });

  it("长按版本分组进入素材自检页", () => {
    page.onLongPressVersion({
      currentTarget: { dataset: { key: "version" } },
    });

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/asset-selftest/asset-selftest",
    });
  });

  it("长按非版本分组不跳转", () => {
    page.onLongPressVersion({
      currentTarget: { dataset: { key: "identity" } },
    });

    expect(harness.wx.navigateTo).not.toHaveBeenCalled();
  });
});
