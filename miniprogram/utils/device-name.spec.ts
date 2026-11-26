/**
 * 设备/孩子的统一展示名：孩子中文名 > 英文名 > 设备名 > 兜底文案。
 * 首页 dropdown 与更懂TA dropdown 共用，避免两处文案漂移。
 */
import { getDeviceDisplayName } from "./device-name";

describe("device display name", () => {
  it("优先孩子中文名", () => {
    expect(
      getDeviceDisplayName({
        id: "d1",
        name: "Elly 一号",
        childProfile: { name: "小明", englishName: "Ming" },
      }),
    ).toBe("小明");
  });

  it("没有中文名回落英文名", () => {
    expect(
      getDeviceDisplayName({
        id: "d1",
        name: "Elly 一号",
        childProfile: { name: null, englishName: "Ming" },
      }),
    ).toBe("Ming");
  });

  it("没有孩子档案回落设备名", () => {
    expect(getDeviceDisplayName({ id: "d1", name: "Elly 一号" })).toBe(
      "Elly 一号",
    );
    expect(
      getDeviceDisplayName({ id: "d1", name: "Elly 一号", childProfile: null }),
    ).toBe("Elly 一号");
  });

  it("全空使用兜底文案，未传设备也不抛错", () => {
    expect(getDeviceDisplayName({ id: "d1", name: "" })).toBe("设备");
    expect(getDeviceDisplayName(undefined)).toBe("设备");
    expect(getDeviceDisplayName(undefined, "暂无设备")).toBe("暂无设备");
  });
});
