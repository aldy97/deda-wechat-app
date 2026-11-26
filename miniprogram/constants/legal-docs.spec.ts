/**
 * 协议文案守门：两份静态文案的结构、生效日期与合规要点。
 * 文案是纯数据，没有分支逻辑；这里钉死「不能是空壳」「不能留占位符」
 * 「必须写明运营主体与注销渠道」，防止上线时把草案发出去。
 */
import { LEGAL_DOCS, resolveLegalDoc } from "./legal-docs";

const DOC_KEYS = ["privacy", "terms"] as const;

function joinedText(key: (typeof DOC_KEYS)[number]): string {
  const doc = LEGAL_DOCS[key];
  return [doc.title, ...doc.sections.map((s) => `${s.title}\n${s.body}`)].join(
    "\n",
  );
}

describe("legal-docs 文案", () => {
  it("两份文档的 key 与标题一一对应", () => {
    expect(LEGAL_DOCS.privacy.key).toBe("privacy");
    expect(LEGAL_DOCS.privacy.title).toBe("隐私政策");
    expect(LEGAL_DOCS.terms.key).toBe("terms");
    expect(LEGAL_DOCS.terms.title).toBe("用户协议");
  });

  it("生效日期为 2026-11-26", () => {
    for (const key of DOC_KEYS) {
      expect(LEGAL_DOCS[key].updatedAt).toBe("2026-11-26");
    }
  });

  it("每份文档至少 8 个章节，标题与正文均非空", () => {
    for (const key of DOC_KEYS) {
      const { sections } = LEGAL_DOCS[key];
      expect(sections.length).toBeGreaterThanOrEqual(8);
      for (const section of sections) {
        expect(section.title.trim().length).toBeGreaterThan(0);
        expect(section.body.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("两份文案标题互异（不同文档不会渲染成同一篇）", () => {
    expect(new Set(DOC_KEYS.map((key) => LEGAL_DOCS[key].title)).size).toBe(2);
  });

  it("写明运营主体：上海山谷来信人工智能科技有限公司", () => {
    for (const key of DOC_KEYS) {
      expect(joinedText(key)).toContain("上海山谷来信人工智能科技有限公司");
    }
  });

  it("隐私政策写明应用内注销路径、儿童个人信息与联系方式", () => {
    const text = joinedText("privacy");
    expect(text).toContain("注销");
    expect(text).toContain("儿童");
    expect(text).toContain("用户反馈");
  });

  it("用户协议写明应用内注销路径与监护人责任", () => {
    const text = joinedText("terms");
    expect(text).toContain("注销");
    expect(text).toContain("监护人");
  });

  it("不含未替换的占位符", () => {
    for (const key of DOC_KEYS) {
      expect(joinedText(key)).not.toMatch(/TODO|FIXME|待补充|XXX|占位/);
    }
  });
});

describe("resolveLegalDoc", () => {
  it("缺省与非法参数都兜底到隐私政策", () => {
    expect(resolveLegalDoc(undefined)).toBe(LEGAL_DOCS.privacy);
    expect(resolveLegalDoc("")).toBe(LEGAL_DOCS.privacy);
    expect(resolveLegalDoc("unknown")).toBe(LEGAL_DOCS.privacy);
  });

  it("已知 key 返回对应文档", () => {
    expect(resolveLegalDoc("privacy")).toBe(LEGAL_DOCS.privacy);
    expect(resolveLegalDoc("terms")).toBe(LEGAL_DOCS.terms);
  });
});
