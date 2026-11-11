/**
 * sleep-manage 哄睡通知订阅接入测试。
 *
 * 锁定交互口径：
 * - 首次保存操作（未标记过）→ 显式授权弹窗一次，并写入本地标记；
 * - 之后的手势操作 → 静默补额（已授权用户无感），不再显式弹窗；
 * - 授权结果绝不阻塞哄睡配置的保存。
 */
import { getSleepConfig, updateSleepConfig } from "../../api/api";
import {
  requestSleepReminderSubscription,
  silentTopUpSleepReminder,
} from "../../utils/push-subscription";
import { installPageHarness } from "../../tests/page-harness";

jest.mock("../../api/api", () => ({
  getSleepConfig: jest.fn(),
  updateSleepConfig: jest.fn(),
}));
jest.mock("../../utils/push-subscription", () => ({
  requestSleepReminderSubscription: jest.fn().mockResolvedValue("accept"),
  silentTopUpSleepReminder: jest.fn(),
}));

const mockUpdateSleepConfig = updateSleepConfig as jest.Mock;
const mockRequestSubscription = requestSleepReminderSubscription as jest.Mock;
const mockSilentTopUp = silentTopUpSleepReminder as jest.Mock;

const SUBSCRIBE_ASKED_KEY = "sleepReminderSubscribeAsked";

describe("sleep-manage 哄睡通知订阅", () => {
  const harness = installPageHarness();

  beforeAll(() => {
    require("./sleep-manage");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getSleepConfig as jest.Mock).mockResolvedValue({
      code: 0,
      message: "success",
      data: null,
    });
    mockUpdateSleepConfig.mockResolvedValue({
      code: 0,
      message: "success",
      data: {},
    });
    harness.wx.getStorageSync.mockReturnValue("");
  });

  it("首次保存操作：显式请求授权一次并写入本地标记", () => {
    const page = harness.createInstance();
    page.onLoad({ id: "dev-1" });

    page.onToggleEnabled({ detail: true });

    expect(mockRequestSubscription).toHaveBeenCalledTimes(1);
    expect(mockSilentTopUp).not.toHaveBeenCalled();
    expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
      SUBSCRIBE_ASKED_KEY,
      "1",
    );
    expect(page.data.subscriptionAsked).toBe(true);
  });

  it("已标记过（本地 storage 有值）：静默补额、不显式弹窗", () => {
    harness.wx.getStorageSync.mockImplementation((key: string) =>
      key === SUBSCRIBE_ASKED_KEY ? "1" : "",
    );
    const page = harness.createInstance();
    page.onLoad({ id: "dev-1" });

    page.onToggleEnabled({ detail: true });

    expect(mockSilentTopUp).toHaveBeenCalledTimes(1);
    expect(mockRequestSubscription).not.toHaveBeenCalled();
  });

  it("同页第二次操作：转为静默补额，不再显式弹窗", () => {
    const page = harness.createInstance();
    page.onLoad({ id: "dev-1" });

    page.onToggleEnabled({ detail: true });
    page.onToggleForce({ detail: true });

    expect(mockRequestSubscription).toHaveBeenCalledTimes(1);
    expect(mockSilentTopUp).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["onToggleForce", () => ({ detail: true })],
    ["onConfirmTime", () => undefined],
    ["onConfirmDuration", () => undefined],
  ])("%s 同样触发订阅请求", (handlerName, makeEvent) => {
    const page = harness.createInstance();
    page.onLoad({ id: "dev-1" });

    const event = makeEvent();
    page[handlerName](event);

    expect(mockRequestSubscription).toHaveBeenCalledTimes(1);
  });

  it("授权结果不阻塞保存：拒绝授权后配置仍正常提交", async () => {
    mockRequestSubscription.mockResolvedValueOnce("reject");
    const page = harness.createInstance();
    page.onLoad({ id: "dev-1" });

    page.onToggleEnabled({ detail: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockUpdateSleepConfig).toHaveBeenCalledWith("dev-1", {
      enabled: true,
    });
  });
});
