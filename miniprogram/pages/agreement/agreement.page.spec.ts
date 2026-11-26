/**
 * agreement 页面装配测试：doc 参数解析、导航标题同步、非法参数兜底。
 * 页面本身无业务逻辑，只负责把 constants/legal-docs 的文案渲染出去。
 */
import { installPageHarness } from "../../tests/page-harness";

const harness = installPageHarness();

require("./agreement");

describe("agreement page 装配", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("缺省 doc 参数渲染隐私政策并同步导航标题", () => {
    const page = harness.createInstance();

    page.onLoad({});

    expect(page.data.doc.key).toBe("privacy");
    expect(page.data.doc.title).toBe("隐私政策");
    expect(harness.wx.setNavigationBarTitle).toHaveBeenCalledWith({
      title: "隐私政策",
    });
  });

  it("doc=terms 渲染用户协议", () => {
    const page = harness.createInstance();

    page.onLoad({ doc: "terms" });

    expect(page.data.doc.key).toBe("terms");
    expect(page.data.doc.title).toBe("用户协议");
    expect(harness.wx.setNavigationBarTitle).toHaveBeenCalledWith({
      title: "用户协议",
    });
  });

  it("非法 doc 参数兜底隐私政策且不抛错", () => {
    const page = harness.createInstance();

    expect(() => page.onLoad({ doc: "not-exist" })).not.toThrow();
    expect(page.data.doc.key).toBe("privacy");
  });

  it("无 query（undefined）也能正常装配", () => {
    const page = harness.createInstance();

    expect(() => page.onLoad(undefined)).not.toThrow();
    expect(page.data.doc.key).toBe("privacy");
  });

  it("页面默认数据即有一份可渲染的文档", () => {
    const page = harness.createInstance();

    expect(page.data.doc.sections.length).toBeGreaterThan(0);
  });
});
