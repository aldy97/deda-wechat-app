import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  ensureAuthToken: jest.fn(),
  getChildProfile: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

describe("child info page", () => {
  const harness = installPageHarness();
  let page: any;
  let formatChildGender: (gender?: string | null) => string;
  let formatChildBirthday: (birthday?: string | null) => string;

  beforeAll(() => {
    formatChildGender = require("./child-info").formatChildGender;
    formatChildBirthday = require("./child-info").formatChildBirthday;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    page = harness.createInstance();
    mockApi.ensureAuthToken.mockResolvedValue("token");
    mockApi.getChildProfile.mockResolvedValue({
      data: {
        id: "profile-id",
        name: "乐乐",
        englishName: "Bagel",
        gender: "female",
        birthday: "2020-05-20",
      },
    });
  });

  it("maps male and female to the requested labels", () => {
    expect(formatChildGender("male")).toBe("王子");
    expect(formatChildGender("男")).toBe("王子");
    expect(formatChildGender("female")).toBe("公主");
    expect(formatChildGender("女")).toBe("公主");
    expect(formatChildGender(null)).toBe("未设置");
  });

  it("uses deviceId as the child ID and formats profile data", async () => {
    await page.onLoad({ deviceId: "dev-001" });
    await page.onReady();

    expect(mockApi.getChildProfile).toHaveBeenCalledWith("dev-001");
    expect(page.data.deviceId).toBe("dev-001");
    expect(page.data.childName).toBe("乐乐");
    expect(page.data.genderLabel).toBe("公主");
    expect(page.data.birthdayLabel).toBe("2020.05.20");
    expect(page.data.loadError).toBe(false);
  });

  it("哄睡管理入口：带着 deviceId 进入哄睡配置页", () => {
    page.setData({ deviceId: "dev-001" });

    page.onGoSleepManage();

    expect(harness.wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/sleep-config/sleep-config?id=dev-001",
    });
  });

  it("缺少 deviceId：直接进入加载失败态且不请求档案", async () => {
    await page.onLoad({});
    await page.onReady();

    expect(mockApi.getChildProfile).not.toHaveBeenCalled();
    expect(page.data.loading).toBe(false);
    expect(page.data.loadError).toBe(true);
  });

  it("档案读取失败：loadError 置真，加载态收口", async () => {
    mockApi.getChildProfile.mockRejectedValue(new Error("network"));
    await page.onLoad({ deviceId: "dev-001" });
    await page.onReady();

    expect(page.data.loadError).toBe(true);
    expect(page.data.loading).toBe(false);
  });

  it("只有英文名时回落到英文名", async () => {
    mockApi.getChildProfile.mockResolvedValue({
      data: { englishName: "Bagel" },
    });
    await page.onLoad({ deviceId: "dev-001" });
    await page.onReady();

    expect(page.data.childName).toBe("Bagel");
    expect(page.data.genderLabel).toBe("未设置");
    expect(page.data.birthdayLabel).toBe("未设置");
  });

  it("生日缺失：展示未设置", () => {
    expect(formatChildBirthday(null)).toBe("未设置");
  });
});
