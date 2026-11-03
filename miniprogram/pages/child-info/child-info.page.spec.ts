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

  beforeAll(() => {
    formatChildGender = require("./child-info").formatChildGender;
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
});
