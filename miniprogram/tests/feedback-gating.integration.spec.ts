/**
 * 反馈页设备门控集成测试：只桩 wx.request，打穿 feedback 页 → api.ts → request.ts。
 * 验证 GET /devices 空列表时表单禁用、有设备/查询失败时可正常 POST /feedbacks。
 */
import { installIntegrationHarness } from "./integration-harness";
import { API_BASE_URL } from "../config/api.config";

const harness = installIntegrationHarness();

require("../pages/feedback/feedback");

interface WxReqOpts {
  url: string;
  method: string;
  data?: unknown;
  success?: (res: { statusCode: number; data: unknown }) => void;
  fail?: (err: { errMsg: string }) => void;
}

/** 按 URL 路由 mock 响应：设备列表与反馈提交分开控制 */
function mockRoutes(routes: {
  devices: { ok: boolean; data?: unknown };
  feedback?: { ok: boolean; data?: unknown };
}) {
  harness.wx.request.mockImplementation((opts: WxReqOpts) => {
    if (opts.url.endsWith("/devices")) {
      if (routes.devices.ok) {
        opts.success?.({
          statusCode: 200,
          data: { code: 0, message: "success", data: routes.devices.data },
        });
      } else {
        opts.fail?.({ errMsg: "request:fail network down" });
      }
      return;
    }
    if (opts.url.endsWith("/feedbacks")) {
      opts.success?.({
        statusCode: 201,
        data: {
          code: 0,
          message: "success",
          data: routes.feedback?.data ?? {
            feedbackId: "fb-1",
            createdAt: "2026-11-10T00:00:00Z",
          },
        },
      });
      return;
    }
    throw new Error(`unexpected request: ${opts.url}`);
  });
}

describe("feedback 设备门控全链路", () => {
  let page: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // 预置 token，避免 ensureAuthToken 触发 wx.login 链路
    harness.wx.getStorageSync.mockImplementation((key: string) =>
      key === "token" ? "test-token" : "",
    );
    page = harness.createInstance();
  });

  it("GET /devices 返回空数组 → 无设备门控生效", async () => {
    mockRoutes({ devices: { ok: true, data: [] } });

    await page.onLoad();

    expect(page.data.hasNoDevice).toBe(true);
    expect(harness.lastRequest()).toMatchObject({
      method: "GET",
      url: `${API_BASE_URL}/devices`,
    });
  });

  it("有设备 → 可提交，POST /feedbacks payload 与现状一致", async () => {
    jest.useFakeTimers();
    try {
      mockRoutes({
        devices: { ok: true, data: [{ id: "dev-1", name: "Elly" }] },
        feedback: { ok: true },
      });
      await page.onLoad();
      expect(page.data.hasNoDevice).toBe(false);

      page.onContentInput({ detail: { value: "  希望增加夜间模式  " } });
      page.onContactInput({ detail: { value: "13800138000" } });
      await page.onSubmit();

      expect(harness.lastRequest()).toMatchObject({
        method: "POST",
        url: `${API_BASE_URL}/feedbacks`,
        data: { content: "希望增加夜间模式", contact: "13800138000" },
      });
      expect(harness.wx.showToast).toHaveBeenCalledWith({
        title: "提交成功",
        icon: "success",
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("GET /devices 网络失败 → fail-open，仍可提交反馈", async () => {
    jest.useFakeTimers();
    try {
      mockRoutes({ devices: { ok: false }, feedback: { ok: true } });
      await page.onLoad();
      expect(page.data.hasNoDevice).toBe(false);

      page.onContentInput({ detail: { value: "断网时也要能反馈" } });
      await page.onSubmit();

      expect(harness.lastRequest()).toMatchObject({
        method: "POST",
        url: `${API_BASE_URL}/feedbacks`,
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
