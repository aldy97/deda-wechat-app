import { installPageHarness } from "../../tests/page-harness";

const mockApi = { login: jest.fn() };
const mockClientInfo = { reportClientInfoIfNeeded: jest.fn() };
jest.mock("../../api/api", () => mockApi);
jest.mock("../../utils/client-info", () => mockClientInfo);

const harness = installPageHarness();

/** 登录页：登录成功写 token 并触发手机品牌上报 */
describe("login page", () => {
  let page: any;

  beforeAll(() => {
    require("./login");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    harness.wx.login = jest.fn((options: any) =>
      options.success({ code: "wx-code" }),
    );
    mockApi.login.mockResolvedValue({
      code: 0,
      message: "success",
      data: {
        token: "jwt-token",
        userInfo: { id: "u1", openid: "o1", phone: null },
      },
    });
    mockClientInfo.reportClientInfoIfNeeded.mockResolvedValue(undefined);
    page = harness.createInstance();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("登录成功：写 token、上报品牌、切到设备列表", async () => {
    await page.onLogin();
    await Promise.resolve();

    expect(mockApi.login).toHaveBeenCalledWith({ code: "wx-code" });
    expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
      "token",
      "jwt-token",
    );
    expect(mockClientInfo.reportClientInfoIfNeeded).toHaveBeenCalledTimes(1);

    jest.runOnlyPendingTimers();
    expect(harness.wx.switchTab).toHaveBeenCalledWith({
      url: "/pages/device-list/device-list",
    });
  });
});
