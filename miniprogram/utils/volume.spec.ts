/**
 * 音量步进纯函数单测。
 *
 * 规则（2026-11-12 确认）：交互上只允许以 10 为步长调节；当前值非整十时先归整——
 * 往下 floor 到十位、往上 ceil 到十位；已是整十则 ±10；结果 clamp 到 [0,100]。
 */
import {
  normalizeVolume,
  snapVolumeDown,
  snapVolumeUp,
  VOLUME_MAX,
  VOLUME_MIN,
  VOLUME_STEP,
} from "./volume";

describe("normalizeVolume", () => {
  it("契约内的整数原样返回", () => {
    expect(normalizeVolume(0)).toBe(0);
    expect(normalizeVolume(80)).toBe(80);
    expect(normalizeVolume(100)).toBe(100);
  });

  it("小数四舍五入（服务端 pickNumber 不挡小数，下发前必须归一为整数）", () => {
    expect(normalizeVolume(47.4)).toBe(47);
    expect(normalizeVolume(47.5)).toBe(48);
    expect(normalizeVolume(47.6)).toBe(48);
  });

  it("越界值 clamp 到 0-100", () => {
    expect(normalizeVolume(120)).toBe(VOLUME_MAX);
    expect(normalizeVolume(-5)).toBe(VOLUME_MIN);
  });

  it("null / undefined / NaN / Infinity / 非数字一律 null（音量未知）", () => {
    expect(normalizeVolume(null)).toBeNull();
    expect(normalizeVolume(undefined)).toBeNull();
    expect(normalizeVolume(NaN)).toBeNull();
    expect(normalizeVolume(Infinity)).toBeNull();
    expect(normalizeVolume("80")).toBeNull();
    expect(normalizeVolume({})).toBeNull();
  });
});

describe("snapVolumeDown", () => {
  it.each([
    [80, 70],
    [70, 60],
    [47, 40],
    [75, 70],
    [50, 40],
    [5, 0],
    [95, 90],
    [10, 0],
  ])("%i → %i", (input, expected) => {
    expect(snapVolumeDown(input)).toBe(expected);
  });

  it("0 保持 0，不越下界", () => {
    expect(snapVolumeDown(0)).toBe(VOLUME_MIN);
  });
});

describe("snapVolumeUp", () => {
  it.each([
    [80, 90],
    [47, 50],
    [75, 80],
    [50, 60],
    [5, 10],
    [95, 100],
    [90, 100],
  ])("%i → %i", (input, expected) => {
    expect(snapVolumeUp(input)).toBe(expected);
  });

  it("100 保持 100，不越上界", () => {
    expect(snapVolumeUp(100)).toBe(VOLUME_MAX);
  });
});

describe("步长与区间常量", () => {
  it("步长 10、区间 0-100", () => {
    expect(VOLUME_STEP).toBe(10);
    expect(VOLUME_MIN).toBe(0);
    expect(VOLUME_MAX).toBe(100);
  });
});
