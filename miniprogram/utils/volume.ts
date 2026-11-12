/**
 * 音量步进纯函数（不依赖 wx，可完整单测）。
 *
 * 规则：交互上只允许以 VOLUME_STEP 为步长调节；当前值非整十时先归整——
 * 往下 floor 到十位、往上 ceil 到十位；已是整十则 ±VOLUME_STEP。
 * 结果始终 clamp 在 [VOLUME_MIN, VOLUME_MAX]。
 *
 * 以 10 为步长是**交互约束**而非协议约束：服务端 POST /devices/:id/control
 * 仍接受 0-100 任意整数，故归一化必须在前端完成——device-link 的 setVolume
 * 有 Number.isInteger 校验，小数会被 400 拒绝。
 */

/** 交互步长 */
export const VOLUME_STEP = 10;
/** 协议下界 */
export const VOLUME_MIN = 0;
/** 协议上界 */
export const VOLUME_MAX = 100;

function clamp(value: number): number {
  if (value < VOLUME_MIN) return VOLUME_MIN;
  if (value > VOLUME_MAX) return VOLUME_MAX;
  return value;
}

/**
 * 归一化服务端 `GET /devices/:id/status` 返回的 volume（契约 number | null）。
 * 仅接受有限数字：小数四舍五入、越界 clamp；其余一律 null 表示「音量未知」，
 * 调用方据此禁用步进按钮，不用猜测值去下发（避免显示 60 实为 35 时越调越大）。
 */
export function normalizeVolume(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clamp(Math.round(value));
}

/** 往下一档：整十则 -VOLUME_STEP，否则 floor 到十位 */
export function snapVolumeDown(value: number): number {
  const stepped =
    value % VOLUME_STEP === 0
      ? value - VOLUME_STEP
      : Math.floor(value / VOLUME_STEP) * VOLUME_STEP;
  return clamp(stepped);
}

/** 往上一档：整十则 +VOLUME_STEP，否则 ceil 到十位 */
export function snapVolumeUp(value: number): number {
  const stepped =
    value % VOLUME_STEP === 0
      ? value + VOLUME_STEP
      : Math.ceil(value / VOLUME_STEP) * VOLUME_STEP;
  return clamp(stepped);
}
