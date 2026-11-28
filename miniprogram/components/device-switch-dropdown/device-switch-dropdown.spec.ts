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

  it("单设备且不能添加：点击不展开", () => {
    const instance = create({ devices: [DEVICES[0]], selectedName: "小明" });

    instance.onToggle();

    expect(instance.data.open).toBe(false);
  });

  it("单设备但可添加：点击仍可展开（菜单里有「添加设备」）", () => {
    const instance = create({
      devices: [DEVICES[0]],
      selectedName: "小明",
      addable: true,
    });

    instance.onToggle();

    expect(instance.data.open).toBe(true);
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

  it("设备数量降到 1 台且不能添加：自动收起", () => {
    const instance = create();
    instance.onToggle();
    expect(instance.data.open).toBe(true);

    instance.observers.devices([DEVICES[0]]);

    expect(instance.data.open).toBe(false);
  });

  it("可添加时设备降到 1 台：保持展开（仍能进添加设备）", () => {
    const instance = create({ addable: true });
    instance.onToggle();

    instance.observers.devices([DEVICES[0]]);

    expect(instance.data.open).toBe(true);
  });

  it("点「添加设备」：收起菜单并抛 add 事件", () => {
    const instance = create({ addable: true });
    instance.onToggle();

    instance.onAdd();

    expect(instance.data.open).toBe(false);
    expect(instance.triggerEvent).toHaveBeenCalledWith("add");
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
    // 当前选中项不出现在菜单里（胶囊上已经显示了），菜单只列可切换的目标
    expect(wxml).toContain('wx:if="{{ item.id !== selectedId }}"');
    expect(wxml).not.toContain("device-dropdown-check");
  });

  it("wxss：不再有导航栏变体，两处调用共用同一套尺寸", () => {
    // 首页与「更懂TA」页头曾用 variant 切换两套胶囊样式，结果首页那套
    // 被撑到 max-width、把居中 logo 挤到按钮边上。统一成一套后没有变体残留。
    const wxss = fs.readFileSync(
      path.join(__dirname, "device-switch-dropdown.wxss"),
      "utf8",
    );

    expect(wxss).not.toContain(".variant-nav");
    expect(wxss).toContain("min-width: 128rpx");
    expect(wxss).toContain("max-width: 220rpx");
  });

  it("展开箭头用共享 expand-arrow 组件，开合状态交给它自己过渡", () => {
    const wxml = readWxml();
    const config = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "device-switch-dropdown.json"),
        "utf8",
      ),
    );

    expect(config.usingComponents["expand-arrow"]).toBe(
      "/components/expand-arrow/expand-arrow",
    );
    expect(wxml).toContain("<expand-arrow");
    expect(wxml).toContain('open="{{ open }}"');
    // 组件内部不再自己画两条边，箭头形态与动画只有一份实现
    expect(wxml).not.toContain("device-switch-arrow-open");
  });

  it("胶囊与菜单项都用 child-avatar 按性别出头像，选中项同样带头像", () => {
    const wxml = readWxml();
    const config = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "device-switch-dropdown.json"),
        "utf8",
      ),
    );

    expect(config.usingComponents["child-avatar"]).toBe(
      "/components/child-avatar/child-avatar",
    );
    // 胶囊：当前选中孩子
    expect(wxml).toContain('gender="{{ selectedGender }}"');
    // 菜单：列出的每一项都带头像（当前选中项被过滤掉，不会再出现在菜单里）
    expect(wxml).toContain('gender="{{ item.gender }}"');
    expect(wxml).toContain('class="device-dropdown-main"');
    expect(wxml).toContain('wx:if="{{ item.id !== selectedId }}"');
  });

  it("wxss：头像不被压缩，长名字仍在剩余空间里截断", () => {
    const wxss = fs.readFileSync(
      path.join(__dirname, "device-switch-dropdown.wxss"),
      "utf8",
    );

    expect(wxss).toMatch(/\.device-switch__avatar\s*\{[^}]*flex-shrink:\s*0;/);
    expect(wxss).toMatch(
      /\.device-dropdown-item__avatar\s*\{[^}]*flex-shrink:\s*0;/,
    );
    expect(wxss).toMatch(/\.device-dropdown-name\s*\{[^}]*min-width:\s*0;/);
  });

  it("菜单锚定方向由 menuAlign 决定：贴左边时向左对齐，不再溢出屏幕", () => {
    const wxml = readWxml();
    const wxss = fs.readFileSync(
      path.join(__dirname, "device-switch-dropdown.wxss"),
      "utf8",
    );

    expect(wxml).toContain("device-dropdown--{{ menuAlign }}");
    expect(wxss).toMatch(/\.device-dropdown--left\s*\{[^}]*left:\s*0;/);
    expect(wxss).toMatch(/\.device-dropdown--left\s*\{[^}]*right:\s*auto;/);
  });

  it("wxml：可添加时底部渲染「添加设备」入口，且箭头只在有选择意义时出现", () => {
    const wxml = readWxml();

    expect(wxml).toContain('wx:if="{{ addable }}"');
    expect(wxml).toContain('bind:tap="onAdd"');
    expect(wxml).toContain("{{ addLabel }}");
    expect(wxml).toContain("device-dropdown-add");
    expect(wxml).toContain("devices.length > 1 || addable");
  });
});
