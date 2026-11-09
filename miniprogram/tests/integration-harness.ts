/**
 * 集成测试基座。
 *
 * 与 page-harness 的区别：只桩 wx.request 等底层微信 API，
 * 不 mock ../../api/api —— 驱动「页面 → api.ts → request.ts」全链路，
 * 锁定 HTTP method / URL / payload / 统一信封 / 401 重登录等跨层行为。
 *
 * 用法（每个集成 spec 文件只驱动一个页面，与 Page 捕获一一对应）：
 *   const harness = installIntegrationHarness();
 *   require("../pages/some-page/some-page");
 *   const page = harness.createInstance();
 *   harness.mockHttpSuccess({ ... });
 *   await page.onSomeAction();
 *   expect(harness.lastRequest()).toMatchObject({ method: "POST", url: "..." });
 */

import { installPageHarness, PageHarness } from "./page-harness";

interface WxRequestOptions {
  url: string;
  method: string;
  data?: unknown;
  header?: Record<string, string>;
  success?: (res: { statusCode: number; data: unknown }) => void;
  fail?: (err: { errMsg: string }) => void;
}

export interface IntegrationHarness extends PageHarness {
  /** 最近一次 wx.request 调用的完整参数 */
  lastRequest: () => WxRequestOptions | undefined;
  /** 让下一次起的所有 wx.request 以统一成功信封返回 */
  mockHttpSuccess: (data: unknown, statusCode?: number) => void;
  /** 让下一次起的所有 wx.request 以 HTTP 错误返回（body 为后端错误体） */
  mockHttpError: (statusCode: number, body?: unknown) => void;
  /** 让下一次起的所有 wx.request 走网络失败 */
  mockNetworkFail: (errMsg?: string) => void;
}

export function installIntegrationHarness(): IntegrationHarness {
  const harness = installPageHarness();

  const requestMock = jest.fn();
  (globalThis as any).wx.request = requestMock;
  harness.wx.request = requestMock;

  return {
    ...harness,
    lastRequest: () =>
      requestMock.mock.calls.length
        ? requestMock.mock.calls[requestMock.mock.calls.length - 1][0]
        : undefined,
    mockHttpSuccess: (data, statusCode = 200) => {
      requestMock.mockImplementation((options: WxRequestOptions) => {
        options.success?.({
          statusCode,
          data: { code: 0, message: "success", data },
        });
      });
    },
    mockHttpError: (statusCode, body) => {
      requestMock.mockImplementation((options: WxRequestOptions) => {
        options.success?.({ statusCode, data: body });
      });
    },
    mockNetworkFail: (errMsg = "request:fail network down") => {
      requestMock.mockImplementation((options: WxRequestOptions) => {
        options.fail?.({ errMsg });
      });
    },
  };
}
