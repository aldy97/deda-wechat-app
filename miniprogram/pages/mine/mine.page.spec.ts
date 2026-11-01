import { installPageHarness } from "../../tests/page-harness";

describe("mine page navigation", () => {
  const harness = installPageHarness();

  beforeAll(() => {
    require("./mine");
  });

  it("opens the child list only through the dedicated handler", () => {
    const page = harness.createInstance();

    page.onChildListTap();

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/child-list/child-list",
    });
    expect(page.onSettingsTap).toBeUndefined();
    expect(page.onContactTap).toBeUndefined();
  });

  it("opens the feedback page from the feedback entry", () => {
    const page = harness.createInstance();

    page.onFeedbackTap();

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/feedback/feedback",
    });
  });
});
