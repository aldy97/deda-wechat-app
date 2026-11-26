/**
 * 跨页「当前孩子」选择存储。
 *
 * 设备列表（首页）与更懂TA 共用同一 key：任一页切换孩子，
 * 另一页 next onShow 必须落在同一台设备上。
 */

const wxStub = {
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
};
(globalThis as any).wx = wxStub;

import {
  SELECTED_DEVICE_KEY,
  readSelectedDeviceId,
  resolveSelectedDeviceId,
  writeSelectedDeviceId,
} from "./selected-device";

describe("selected-device store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wxStub.getStorageSync.mockReturnValue("");
  });

  it("key 固定为 selected_device_id", () => {
    expect(SELECTED_DEVICE_KEY).toBe("selected_device_id");
  });

  it("读取：命中返回字符串，空值与异常都回退空串", () => {
    wxStub.getStorageSync.mockReturnValue("dev-2");
    expect(readSelectedDeviceId()).toBe("dev-2");

    wxStub.getStorageSync.mockReturnValue(undefined);
    expect(readSelectedDeviceId()).toBe("");

    wxStub.getStorageSync.mockImplementation(() => {
      throw new Error("storage broken");
    });
    expect(readSelectedDeviceId()).toBe("");
  });

  it("写入：非空落 storage，空串删除 key", () => {
    writeSelectedDeviceId("dev-2");
    expect(wxStub.setStorageSync).toHaveBeenCalledWith(
      SELECTED_DEVICE_KEY,
      "dev-2",
    );

    writeSelectedDeviceId("");
    expect(wxStub.removeStorageSync).toHaveBeenCalledWith(SELECTED_DEVICE_KEY);
  });

  it("写入异常不冒泡到页面", () => {
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    wxStub.setStorageSync.mockImplementation(() => {
      throw new Error("storage full");
    });

    expect(() => writeSelectedDeviceId("dev-2")).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("解析：preferred 命中 → 原样；未命中 → 第一台；空列表 → 空串", () => {
    const devices = [{ id: "dev-1" }, { id: "dev-2" }];

    expect(resolveSelectedDeviceId(devices, "dev-2")).toBe("dev-2");
    expect(resolveSelectedDeviceId(devices, "gone")).toBe("dev-1");
    expect(resolveSelectedDeviceId(devices, "")).toBe("dev-1");
    expect(resolveSelectedDeviceId([], "dev-2")).toBe("");
  });
});
