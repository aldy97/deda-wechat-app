const mockApi = { ensureAuthToken: jest.fn() };
const mockClientInfo = { reportClientInfoIfNeeded: jest.fn() };
const mockRequest = jest.fn();
jest.mock("./api/api", () => mockApi);
jest.mock("./utils/client-info", () => mockClientInfo);
jest.mock("./utils/request", () => ({ request: mockRequest }));
jest.mock("./utils/monitor", () => ({
  hookApp: (config: any) => config,
  reportError: jest.fn(),
}));

/** app 启动：静默登录成功后触发手机品牌上报 */
describe("app launch", () => {
  let config: any;

  beforeAll(() => {
    (globalThis as any).App = jest.fn((appConfig: any) => {
      config = appConfig;
    });
    require("./app");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue({ code: 0, message: "ok", data: {} });
    mockApi.ensureAuthToken.mockResolvedValue("jwt-token");
    mockClientInfo.reportClientInfoIfNeeded.mockResolvedValue(undefined);
  });

  it("auth 成功后上报品牌", async () => {
    config.onLaunch();
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }

    expect(mockApi.ensureAuthToken).toHaveBeenCalledTimes(1);
    expect(mockClientInfo.reportClientInfoIfNeeded).toHaveBeenCalledTimes(1);
  });
});
