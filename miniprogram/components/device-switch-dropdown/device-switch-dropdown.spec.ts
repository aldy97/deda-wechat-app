/**
 * 共享「孩子设备下拉」组件契约。
 *
 * 首页导航栏与「更懂TA」页头共用同一份实现：单设备不展开、
 * 选中后抛 change 交给页面决定数据加载，页面只提供 devices/selectedId/selectedName。
 */
import { installComponentHarness } from "../../tests/component-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const harness = installComponentHarness();

const DEVICES = [
  { id: "d1", name: "小明" },
  { id: "d2", name: "小红" },
];

function readWxml(): string {
  return fs.readFileSync(
    path.join(__dirname, "device-switch-dropdown.wxml"),
    "utf8",
  );
}

describe("device-switch-dropdown 组件", () => {
  beforeAll(() => {
    require("./device-switch-dropdown");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function create(props: Record<string, unknown> = {}) {
    return harness.createInstance({
      devices: DEVICES,
      selectedId: "d1",
      selectedName: "小明",
      ...props,
    });
  }

  it("默认收起", () => {
    expect(create().data.open).toBe(false);
  });

  it("单设备：点击不展开", () => {
    const instance = create({ devices: [DEVICES[0]], selectedName: "小明" });

    instance.onToggle();

    expect(instance.data.open).toBe(false);
  });

  it("多设备：点击展开，再点收起", () => {
    const instance = create();

    instance.onToggle();
    expect(instance.data.open).toBe(true);

    instance.onToggle();
    expect(instance.data.open).toBe(false);
  });

  it("点遮罩关闭", () => {
    const instance = create();
    instance.onToggle();

    instance.onClose();

    expect(instance.data.open).toBe(false);
  });

  it("选择其他孩子：关闭并抛出 change", () => {
    const instance = create();
    instance.onToggle();

    instance.onSelect({ currentTarget: { dataset: { id: "d2" } } });

    expect(instance.data.open).toBe(false);
    expect(instance.triggerEvent).toHaveBeenCalledWith("change", {
      deviceId: "d2",
    });
  });

  it("选择当前孩子：只关闭，不抛 change", () => {
    const instance = create();
    instance.onToggle();

    instance.onSelect({ currentTarget: { dataset: { id: "d1" } } });

    expect(instance.data.open).toBe(false);
    expect(instance.triggerEvent).not.toHaveBeenCalled();
  });

  it("设备数量降到 1 台：自动收起", () => {
    const instance = create();
    instance.onToggle();
    expect(instance.data.open).toBe(true);

    instance.observers.devices([DEVICES[0]]);

    expect(instance.data.open).toBe(false);
  });

  it("页面隐藏时自动收起", () => {
    const instance = create();
    instance.onToggle();

    instance.pageLifetimes.hide();

    expect(instance.data.open).toBe(false);
  });

  it("选中事件缺少 dataset：只关闭不抛 change", () => {
    const instance = create();
    instance.onToggle();

    instance.onSelect({} as never);

    expect(instance.data.open).toBe(false);
    expect(instance.triggerEvent).not.toHaveBeenCalled();
  });

  it("收起状态收到设备变化 / 页面隐藏：不写 data", () => {
    const instance = create();
    instance.setData.mockClear();

    instance.observers.devices([DEVICES[0]]);
    instance.observers.devices(null);
    instance.pageLifetimes.hide();

    expect(instance.setData).not.toHaveBeenCalled();
  });

  it("wxml：遮罩 + 菜单 + 可访问性属性齐全", () => {
    const wxml = readWxml();

    expect(wxml).toContain('class="device-switch-mask"');
    expect(wxml).toContain('bind:tap="onClose"');
    expect(wxml).toContain('aria-haspopup="menu"');
    expect(wxml).toContain('aria-expanded="{{ open }}"');
    expect(wxml).toContain('aria-role="menu"');
    expect(wxml).toContain('bind:tap="onSelect"');
    expect(wxml).toContain("device-dropdown-check");
  });
});
