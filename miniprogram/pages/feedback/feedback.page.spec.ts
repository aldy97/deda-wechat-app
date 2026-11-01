import {
  ensureAuthToken,
  getWechatPhoneNumber,
  submitFeedback,
} from "../../api/api";
import { installPageHarness } from "../../tests/page-harness";

jest.mock("../../api/api", () => ({
  ensureAuthToken: jest.fn(),
  getWechatPhoneNumber: jest.fn(),
  submitFeedback: jest.fn(),
}));

const mockEnsureAuthToken = ensureAuthToken as jest.Mock;
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
});
