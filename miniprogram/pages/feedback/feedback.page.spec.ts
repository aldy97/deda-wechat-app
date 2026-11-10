import {
  ensureAuthToken,
  getDeviceList,
  getWechatPhoneNumber,
  submitFeedback,
} from "../../api/api";
import { installPageHarness } from "../../tests/page-harness";

jest.mock("../../api/api", () => ({
  ensureAuthToken: jest.fn(),
  getDeviceList: jest.fn(),
  getWechatPhoneNumber: jest.fn(),
  submitFeedback: jest.fn(),
}));

const mockEnsureAuthToken = ensureAuthToken as jest.Mock;
const mockGetDeviceList = getDeviceList as jest.Mock;
const mockGetWechatPhoneNumber = getWechatPhoneNumber as jest.Mock;
const mockSubmitFeedback = submitFeedback as jest.Mock;

describe("feedback page", () => {
  const harness = installPageHarness();

  beforeAll(() => {
    require("./feedback");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureAuthToken.mockResolvedValue("token");
    // 默认有 1 台已绑定设备：保持既有用例行为不变
    mockGetDeviceList.mockResolvedValue({
      code: 0,
      message: "success",
      data: [{ id: "dev-1", name: "Elly" }],
    });
    mockGetWechatPhoneNumber.mockResolvedValue({
      code: 0,
      message: "success",
      data: { phone: "13800138000" },
    });
    mockSubmitFeedback.mockResolvedValue({
      code: 0,
      message: "success",
      data: { feedbackId: "fb-1", createdAt: "2026-11-01T03:00:00Z" },
    });
  });

  it("limits pasted feedback to 200 Unicode characters", () => {
    const page = harness.createInstance();

    const result = page.onContentInput({
      detail: { value: `${"好".repeat(200)}多` },
    });

    expect(result).toHaveLength(200);
    expect(page.data.contentLength).toBe(200);
    expect(page.data.canSubmit).toBe(true);
  });

  it("rejects blank content and invalid contact numbers", async () => {
    const page = harness.createInstance();

    await page.onSubmit();
    expect(mockSubmitFeedback).not.toHaveBeenCalled();

    page.onContentInput({ detail: { value: "希望增加夜间模式" } });
    page.onContactInput({ detail: { value: "12345" } });
    await page.onSubmit();

    expect(mockSubmitFeedback).not.toHaveBeenCalled();
    expect(harness.wx.showToast).toHaveBeenLastCalledWith({
      title: "请输入正确的手机号",
      icon: "none",
    });
  });

  it("prefills the phone number returned by the Wechat authorization flow", async () => {
    const page = harness.createInstance();

    await page.onGetPhoneNumber({
      detail: { code: "phone-code", errMsg: "getPhoneNumber:ok" },
    });

    expect(mockEnsureAuthToken).toHaveBeenCalledTimes(1);
    expect(mockGetWechatPhoneNumber).toHaveBeenCalledWith("phone-code");
    expect(page.data.contact).toBe("13800138000");
    expect(page.data.phoneLoading).toBe(false);
  });

  it("keeps manual input available when phone authorization is denied", async () => {
    const page = harness.createInstance();

    await page.onGetPhoneNumber({
      detail: { code: "", errMsg: "getPhoneNumber:fail user deny" },
    });

    expect(mockGetWechatPhoneNumber).not.toHaveBeenCalled();
    expect(page.data.contact).toBe("");
    expect(harness.wx.showToast).not.toHaveBeenCalled();
  });

  it("submits trimmed content with the authenticated user context", async () => {
    jest.useFakeTimers();
    const page = harness.createInstance();
    page.onContentInput({ detail: { value: "  建议增加夜间模式  " } });
    page.onContactInput({ detail: { value: "13800138000" } });

    await page.onSubmit();

    expect(mockEnsureAuthToken).toHaveBeenCalledTimes(1);
    expect(mockSubmitFeedback).toHaveBeenCalledWith({
      content: "建议增加夜间模式",
      contact: "13800138000",
    });
    expect(harness.wx.showToast).toHaveBeenCalledWith({
      title: "提交成功",
      icon: "success",
    });

    jest.runAllTimers();
    expect(harness.wx.navigateBack).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("shows an inline error and preserves the form after a server failure", async () => {
    mockSubmitFeedback.mockRejectedValueOnce(new Error("HTTP 500"));
    const page = harness.createInstance();
    page.onContentInput({ detail: { value: "希望增加夜间模式" } });
    page.onContactInput({ detail: { value: "13800138000" } });

    await page.onSubmit();

    expect(page.data.submitFailed).toBe(true);
    expect(page.data.content).toBe("希望增加夜间模式");
    expect(page.data.contact).toBe("13800138000");
    expect(page.data.canSubmit).toBe(true);
    expect(page.data.submitting).toBe(false);
    expect(harness.wx.showToast).not.toHaveBeenCalled();
  });

  it("prevents duplicate submissions while a request is pending", async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    mockSubmitFeedback.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const page = harness.createInstance();
    page.onContentInput({ detail: { value: "第一次反馈" } });

    const firstRequest = page.onSubmit();
    await page.onSubmit();

    expect(mockSubmitFeedback).toHaveBeenCalledTimes(1);
    resolveRequest({ code: 0, message: "success", data: {} });
    await firstRequest;
  });

  describe("无设备门控（方案 A 页面内门控）", () => {
    it("有设备：检查完成后表单可用、无提示", async () => {
      const page = harness.createInstance();

      await page.onLoad();

      expect(mockGetDeviceList).toHaveBeenCalledTimes(1);
      expect(page.data.hasNoDevice).toBe(false);
      expect(page.data.deviceCheckLoading).toBe(false);
    });

    it("无设备：hasNoDevice=true，onSubmit 被拦截不发请求", async () => {
      mockGetDeviceList.mockResolvedValue({
        code: 0,
        message: "success",
        data: [],
      });
      const page = harness.createInstance();
      await page.onLoad();

      expect(page.data.hasNoDevice).toBe(true);
      expect(page.data.deviceCheckLoading).toBe(false);

      page.onContentInput({ detail: { value: "反馈内容" } });
      await page.onSubmit();
      expect(mockSubmitFeedback).not.toHaveBeenCalled();
    });

    it("无设备时点击「去绑定设备」→ 跳转 BLE 配网页", async () => {
      mockGetDeviceList.mockResolvedValue({
        code: 0,
        message: "success",
        data: [],
      });
      const page = harness.createInstance();
      await page.onLoad();

      page.onGoBindDevice();

      expect(harness.wx.navigateTo).toHaveBeenCalledWith({
        url: "/pages/device-provision/device-provision",
      });
    });

    it("设备查询失败 fail-open：不当作无设备，表单可用", async () => {
      mockGetDeviceList.mockRejectedValue(new Error("Network error"));
      const page = harness.createInstance();
      await page.onLoad();

      expect(page.data.hasNoDevice).toBe(false);
      expect(page.data.deviceCheckLoading).toBe(false);

      page.onContentInput({ detail: { value: "反馈内容" } });
      await page.onSubmit();
      expect(mockSubmitFeedback).toHaveBeenCalledTimes(1);
    });

    it("检查中：loading 标记为 true 且不显示无设备提示", async () => {
      let resolveList: (v: unknown) => void = () => {};
      mockGetDeviceList.mockReturnValue(
        new Promise((resolve) => (resolveList = resolve)),
      );
      const page = harness.createInstance();
      const loading = page.onLoad();

      expect(page.data.deviceCheckLoading).toBe(true);
      expect(page.data.hasNoDevice).toBe(false);

      resolveList({ code: 0, message: "success", data: [] });
      await loading;
      expect(page.data.deviceCheckLoading).toBe(false);
      expect(page.data.hasNoDevice).toBe(true);
    });

    it("onShow：仅上次检查为无设备时重查；有设备时不发请求", async () => {
      // 有设备 → onShow 不重查
      const pageWithDevice = harness.createInstance();
      await pageWithDevice.onLoad();
      expect(mockGetDeviceList).toHaveBeenCalledTimes(1);
      pageWithDevice.onShow();
      expect(mockGetDeviceList).toHaveBeenCalledTimes(1);

      // 无设备 → onShow 重查；重查到有设备后门控解除
      mockGetDeviceList.mockResolvedValueOnce({
        code: 0,
        message: "success",
        data: [],
      });
      const pageNoDevice = harness.createInstance();
      await pageNoDevice.onLoad();
      expect(pageNoDevice.data.hasNoDevice).toBe(true);

      await pageNoDevice.onShow();
      expect(pageNoDevice.data.hasNoDevice).toBe(false);
    });
  });
});
