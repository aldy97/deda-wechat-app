/**
 * 哄睡服务通知订阅封装（契约 MINI_PROGRAM_API.md §11）。
 *
 * 微信一次性订阅消息：每次 accept 仅允许服务端推送 1 条，
 * 因此这里每次 accept 只上报 1 点额度（count=1），额度池由后端累计。
 *
 * 两种用法：
 * - silentTopUpSleepReminder / withSubscriptionTopUp：寄生在既有 tap
 *   handler 上的静默补额，每会话最多一次，所有失败吞掉；
 * - requestSleepReminderSubscription：sleep-manage 首次保存时的显式授权弹窗。
 */
import { reportPushSubscription } from "../api/api";

/**
 * 哄睡提醒订阅消息模板 ID。
 * 占位值：正式模板在微信公众平台申请后改这里，
 * 并与后端 env WECHAT_TMPL_SLEEP_REMINDER 保持一致。
 */
export const SLEEP_REMINDER_TEMPLATE_ID = "tmpl-sleep-reminder";

type SubscribeResult = "accept" | "reject" | "dismiss";

let sessionTopUpDone = false;

/** 测试专用：重置会话级节流标记 */
export function __resetPushSubscriptionSession(): void {
  sessionTopUpDone = false;
}

function canRequestSubscribe(): boolean {
  return (
    typeof wx !== "undefined" &&
    typeof wx.requestSubscribeMessage === "function"
  );
}

function report(result: "accept" | "reject"): void {
  reportPushSubscription({
    templateId: SLEEP_REMINDER_TEMPLATE_ID,
    result,
    ...(result === "accept" ? { count: 1 } : {}),
  }).catch(() => {
    // 上报失败吞掉：静默补额绝不影响业务交互
  });
}

/**
 * 静默补额：在用户手势 handler 内调用（bindtap 链路），
 * 已授权过的用户不会再看到弹窗，微信直接回调 accept。
 * 每会话最多弹一次；wx 缺失 / 弹窗失败 / 上报失败全部吞掉。
 */
export function silentTopUpSleepReminder(): void {
  if (sessionTopUpDone) return;
  sessionTopUpDone = true;
  if (!canRequestSubscribe()) return;
  wx.requestSubscribeMessage({
    tmplIds: [SLEEP_REMINDER_TEMPLATE_ID],
    success: (res) => {
      const r = res[SLEEP_REMINDER_TEMPLATE_ID];
      if (r === "accept") report("accept");
      else if (r === "reject") report("reject");
      // ban 等状态不上报
    },
    fail: () => {
      // 非手势调用 / 系统拒绝等，吞掉
    },
  });
}

/**
 * 语法糖：包裹 Page 配置对象中的指定 handler，
 * 在原逻辑执行前插入一次静默补额。返回新对象，不改原 config。
 *
 * @example
 * Page(withSubscriptionTopUp({ onTapSave() { ... } }, ["onTapSave"]));
 */
export function withSubscriptionTopUp<P extends Record<string, unknown>>(
  pageConfig: P,
  handlerNames: string[],
): P {
  const wrapped: Record<string, unknown> = { ...pageConfig };
  for (const name of handlerNames) {
    const original = wrapped[name];
    if (typeof original !== "function") continue;
    wrapped[name] = function (this: unknown, ...args: unknown[]) {
      silentTopUpSleepReminder();
      return (original as (...a: unknown[]) => unknown).apply(this, args);
    };
  }
  return wrapped as P;
}

/**
 * 显式授权弹窗（sleep-manage 首次保存哄睡配置时调用）。
 * 必须挂在用户点击手势链路上；resolve 授权结果，绝不 reject。
 */
export function requestSleepReminderSubscription(): Promise<SubscribeResult> {
  return new Promise((resolve) => {
    if (!canRequestSubscribe()) {
      resolve("dismiss");
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [SLEEP_REMINDER_TEMPLATE_ID],
      success: (res) => {
        const r = res[SLEEP_REMINDER_TEMPLATE_ID];
        if (r === "accept") {
          report("accept");
          resolve("accept");
        } else if (r === "reject") {
          report("reject");
          resolve("reject");
        } else {
          resolve("dismiss");
        }
      },
      fail: () => resolve("dismiss"),
    });
  });
}
