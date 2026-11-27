/**
 * child-avatar 组件契约：
 * 性别 → 男孩/女孩/中性头像；未知或未设置回落中性头像；
 * 图片失败露出灰圆兜底；尺寸由调用方以 rpx 传入。
 */
import { installComponentHarness } from "../../tests/component-harness";

declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const BOY = "/static/images/kid-info/avatar_boy.png";
const GIRL = "/static/images/kid-info/avatar_girl.png";
const NEUTRAL = "/static/images/kid-info/avatar_neutral.png";

const harness = installComponentHarness();

function readWxml(): string {
  return fs.readFileSync(path.join(__dirname, "child-avatar.wxml"), "utf8");
}

describe("child-avatar 组件", () => {
  beforeAll(() => {
    require("./child-avatar");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function render(props: Record<string, unknown> = {}) {
    const instance = harness.createInstance(props);
    instance.lifetimes.attached();
    return instance;
  }

  it("male 渲染男孩头像", () => {
    const instance = render({ gender: "male" });

    expect(instance.data.avatarSrc).toBe(BOY);
    expect(instance.data.label).toBe("男孩头像");
  });

  it("female 渲染女孩头像", () => {
    const instance = render({ gender: "female" });

    expect(instance.data.avatarSrc).toBe(GIRL);
    expect(instance.data.label).toBe("女孩头像");
  });

  it("历史写法「男 / 女」同样命中", () => {
    expect(render({ gender: "男" }).data.avatarSrc).toBe(BOY);
    expect(render({ gender: "女" }).data.avatarSrc).toBe(GIRL);
  });

  it("未设置或未知性别回落中性头像", () => {
    for (const gender of ["", null, undefined, "其他"]) {
      const instance = render({ gender });
      expect(instance.data.avatarSrc).toBe(NEUTRAL);
      expect(instance.data.label).toBe("默认孩子头像");
    }
  });

  it("性别变化时通过 observer 切换头像", () => {
    const instance = render({ gender: "male" });

    instance.observers.gender.call(instance, "female");

    expect(instance.data.avatarSrc).toBe(GIRL);
    expect(instance.data.label).toBe("女孩头像");
  });

  it("默认尺寸 88rpx，允许调用方覆盖", () => {
    expect(render().data.size).toBe(88);
    expect(render({ size: 80 }).data.size).toBe(80);
  });

  it("图片加载失败：置 failed 露出灰圆兜底", () => {
    const instance = render({ gender: "male" });

    instance.onImageError();

    expect(instance.data.failed).toBe(true);
  });

  it("wxml 只在有图且未失败时渲染 image，并保持圆形", () => {
    const wxml = readWxml();

    expect(wxml).toContain('wx:if="{{avatarSrc && !failed}}"');
    expect(wxml).toContain('aria-label="{{label}}"');
  });
});
