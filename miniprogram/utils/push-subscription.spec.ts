/**
 * push-subscription 单测。
 *
 * 锁定两条铁律：
 * 1. 静默补额绝不干扰业务交互——wx 缺失、弹窗失败、上报失败全部吞掉；
 * 2. 每次 accept 只上报 1 点额度——微信一次性订阅每次授权仅允许发 1 条，
 *    虚报额度会在发送时以 43101 反噬并把订阅标记 exhausted。
 */
import {
  SLEEP_REMINDER_TEMPLATE_ID,
  __resetPushSubscriptionSession,
  requestSleepReminderSubscription,
  silentTopUpSleepReminder,
  withSubscriptionTopUp,
} from "./push-subscription";
import { reportPushSubscription } from "../api/api";

jest.mock("../api/api", () => ({
  reportPushSubscription: jest.fn().mockResolvedValue({ code: 0, data: {} }),
}));

const mockReport = reportPushSubscription as jest.Mock;

const originalWx = (globalThis as any).wx;

function mockWxRequestSubscribe(
  impl: (opt: {
    tmplIds: string[];
    success?: (res: Record<string, string>) => void;
    fail?: (err: unknown) => void;
  }) => void,
) {
  (globalThis as any).wx = { requestSubscribeMessage: jest.fn(impl) };
  return (globalThis as any).wx.requestSubscribeMessage as jest.Mock;
}

afterEach(() => {
  (globalThis as any).wx = originalWx;
});

beforeEach(() => {
  jest.clearAllMocks();
  __resetPushSubscriptionSession();
});

describe("silentTopUpSleepReminder", () => {
  it("accept 时上报 1 点额度", () => {
    mockWxRequestSubscribe((opt) =>
      opt.success?.({ [SLEEP_REMINDER_TEMPLATE_ID]: "accept" }),
    );

    silentTopUpSleepReminder();

    expect(mockReport).toHaveBeenCalledWith({
      templateId: SLEEP_REMINDER_TEMPLATE_ID,
      result: "accept",
      count: 1,
    });
  });

  it("reject 时上报拒绝（清零额度）", () => {
    mockWxRequestSubscribe((opt) =>
      opt.success?.({ [SLEEP_REMINDER_TEMPLATE_ID]: "reject" }),
    );

    silentTopUpSleepReminder();

    expect(mockReport).toHaveBeenCalledWith({
      templateId: SLEEP_REMINDER_TEMPLATE_ID,
      result: "reject",
    });
  });

  it("ban（用户关闭全局开关）时不上报", () => {
    mockWxRequestSubscribe((opt) =>
      opt.success?.({ [SLEEP_REMINDER_TEMPLATE_ID]: "ban" }),
    );

    silentTopUpSleepReminder();

    expect(mockReport).not.toHaveBeenCalled();
  });

  it("同一会话只触发一次（节流）", () => {
    const wxMock = mockWxRequestSubscribe((opt) =>
      opt.success?.({ [SLEEP_REMINDER_TEMPLATE_ID]: "accept" }),
    );

    silentTopUpSleepReminder();
    silentTopUpSleepReminder();
    silentTopUpSleepReminder();

    expect(wxMock).toHaveBeenCalledTimes(1);
  });

  it("wx 或 requestSubscribeMessage 不存在时静默返回", () => {
    (globalThis as any).wx = undefined;
    expect(() => silentTopUpSleepReminder()).not.toThrow();

    (globalThis as any).wx = {};
    expect(() => silentTopUpSleepReminder()).not.toThrow();
  });

  it("弹窗 fail 时吞掉不上报", () => {
    mockWxRequestSubscribe((opt) => opt.fail?.({ errMsg: "deny" }));

    expect(() => silentTopUpSleepReminder()).not.toThrow();
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("上报接口失败时吞掉，不产生未捕获 rejection", async () => {
    mockReport.mockRejectedValueOnce(new Error("network"));
    mockWxRequestSubscribe((opt) =>
      opt.success?.({ [SLEEP_REMINDER_TEMPLATE_ID]: "accept" }),
    );

    silentTopUpSleepReminder();
    // 让微任务跑完，若未 catch 这里会让 jest 报 unhandled rejection
    await Promise.resolve();
    await Promise.resolve();
    expect(mockReport).toHaveBeenCalled();
  });
});

describe("withSubscriptionTopUp", () => {
  it("包裹指定 handler：先静默补额再执行原逻辑，保留 this 与返回值", () => {
    const wxMock = mockWxRequestSubscribe((opt) =>
      opt.success?.({ [SLEEP_REMINDER_TEMPLATE_ID]: "accept" }),
    );
    const calls: string[] = [];
    const config = {
      onTapSave(this: { tag: string }, event: { id: number }) {
        calls.push(`original:${this.tag}:${event.id}`);
        return "saved";
      },
    };

    const wrapped = withSubscriptionTopUp(config, ["onTapSave"]);
    const ret = wrapped.onTapSave.call({ tag: "ctx" }, { id: 7 });

    expect(wxMock).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["original:ctx:7"]);
    expect(ret).toBe("saved");
  });

  it("未列名的 handler 不被包裹", () => {
    const wxMock = mockWxRequestSubscribe((opt) =>
      opt.success?.({ [SLEEP_REMINDER_TEMPLATE_ID]: "accept" }),
    );
    const original = jest.fn();
    const config = { onTapSave: jest.fn(), onTapOther: original };

    const wrapped = withSubscriptionTopUp(config, ["onTapSave"]);
    wrapped.onTapOther();

    expect(wxMock).not.toHaveBeenCalled();
    expect(wrapped.onTapOther).toBe(original);
  });

  it("列名的 handler 不存在时跳过、不炸", () => {
    const config = { onTapSave: jest.fn() };

    expect(() =>
      withSubscriptionTopUp(config, ["onTapSave", "onNotExist"]),
    ).not.toThrow();
  });

  it("不修改原 config 对象（返回新对象）", () => {
    mockWxRequestSubscribe(() => {});
    const original = jest.fn();
    const config = { onTapSave: original };

    const wrapped = withSubscriptionTopUp(config, ["onTapSave"]);

    expect(config.onTapSave).toBe(original);
    expect(wrapped.onTapSave).not.toBe(original);
  });
});

describe("requestSleepReminderSubscription", () => {
  it("accept：上报并 resolve accept", async () => {
    mockWxRequestSubscribe((opt) =>
      opt.success?.({ [SLEEP_REMINDER_TEMPLATE_ID]: "accept" }),
    );

    await expect(requestSleepReminderSubscription()).resolves.toBe("accept");
    expect(mockReport).toHaveBeenCalledWith({
      templateId: SLEEP_REMINDER_TEMPLATE_ID,
      result: "accept",
      count: 1,
    });
  });

  it("reject：上报拒绝并 resolve reject", async () => {
    mockWxRequestSubscribe((opt) =>
      opt.success?.({ [SLEEP_REMINDER_TEMPLATE_ID]: "reject" }),
    );

    await expect(requestSleepReminderSubscription()).resolves.toBe("reject");
    expect(mockReport).toHaveBeenCalledWith({
      templateId: SLEEP_REMINDER_TEMPLATE_ID,
      result: "reject",
    });
  });

  it("fail（系统拒绝/非手势调用）：resolve dismiss 且不上报", async () => {
    mockWxRequestSubscribe((opt) => opt.fail?.({ errMsg: "not in tap" }));

    await expect(requestSleepReminderSubscription()).resolves.toBe("dismiss");
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("wx 不存在：resolve dismiss", async () => {
    (globalThis as any).wx = undefined;

    await expect(requestSleepReminderSubscription()).resolves.toBe("dismiss");
  });
});
