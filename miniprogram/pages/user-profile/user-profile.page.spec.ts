import { installPageHarness } from "../../tests/page-harness";

const mockApi = {
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
};
jest.mock("../../api/api", () => mockApi);

const PROFILE = {
  id: "user-1",
  nickname: "熊爸爸",
  phone: null,
  gender: null,
  birthday: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  deviceCount: 2,
  childCount: 2,
};

function inputEvent(value: string) {
  return { detail: { value } };
}

function genderEvent(value: string) {
  return { currentTarget: { dataset: { gender: value } } };
}

function pickerEvent(value: string) {
  return { detail: { value } };
}

describe("user profile page", () => {
  const harness = installPageHarness();
  let page: any;

  beforeAll(() => {
    require("./user-profile");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    harness.wx.getStorageSync.mockReturnValue("");
    page = harness.createInstance();
    mockApi.getUserProfile.mockResolvedValue({
      code: 0,
      message: "",
      data: PROFILE,
    });
    mockApi.updateUserProfile.mockResolvedValue({
      code: 0,
      message: "",
      data: { ...PROFILE, nickname: "熊妈妈" },
    });
  });

  it("backfills nickname/gender/birthday from the server profile", async () => {
    mockApi.getUserProfile.mockResolvedValue({
      code: 0,
      message: "",
      data: {
        ...PROFILE,
        nickname: "熊妈妈",
        gender: "female",
        birthday: "1990-05-20",
      },
    });

    await page.onLoad();

    expect(page.data.loading).toBe(false);
    expect(page.data.loadError).toBe(false);
    expect(page.data.form).toEqual({
      nickname: "熊妈妈",
      gender: "female",
      birthday: "1990-05-20",
    });
    expect(page.data.initial).toEqual({
      nickname: "熊妈妈",
      gender: "female",
      birthday: "1990-05-20",
    });
    expect(page.data.canSave).toBe(false);
    // 手机号不在家长信息页展示
    expect(page.data).not.toHaveProperty("phoneText");
    expect(page.data).not.toHaveProperty("phoneUnbound");
  });

  it("disables saving for an empty or unchanged nickname", async () => {
    await page.onLoad();

    page.onNicknameChange(inputEvent("   "));
    expect(page.data.canSave).toBe(false);

    page.onNicknameChange(inputEvent("熊妈"));
    expect(page.data.canSave).toBe(true);

    page.onNicknameChange(inputEvent("  熊爸爸 "));
    expect(page.data.canSave).toBe(false);
  });

  it("enables saving for a first nickname when the profile has none", async () => {
    mockApi.getUserProfile.mockResolvedValue({
      code: 0,
      message: "",
      data: { ...PROFILE, nickname: null },
    });
    await page.onLoad();

    page.onNicknameChange(inputEvent("熊爸"));

    expect(page.data.initial.nickname).toBe("");
    expect(page.data.canSave).toBe(true);
  });

  it("toggles gender and allows clearing the selection", async () => {
    await page.onLoad();

    page.onSelectGender(genderEvent("male"));
    expect(page.data.form.gender).toBe("male");
    expect(page.data.canSave).toBe(true);

    page.onSelectGender(genderEvent("male"));
    expect(page.data.form.gender).toBeNull();
    expect(page.data.canSave).toBe(false);
  });

  it("updates birthday from the native picker", async () => {
    await page.onLoad();

    page.onBirthdayChange(pickerEvent("1992-08-08"));

    expect(page.data.form.birthday).toBe("1992-08-08");
    expect(page.data.canSave).toBe(true);
  });

  it("does not submit a blank nickname", async () => {
    await page.onLoad();

    page.onNicknameChange(inputEvent("   "));
    await page.onSave();

    expect(mockApi.updateUserProfile).not.toHaveBeenCalled();
  });

  it("saves only the changed nickname, caches it and navigates back", async () => {
    await page.onLoad();

    page.onNicknameChange(inputEvent("  熊妈妈  "));
    await page.onSave();

    expect(mockApi.updateUserProfile).toHaveBeenCalledWith({
      nickname: "熊妈妈",
    });
    expect(harness.wx.setStorageSync).toHaveBeenCalledWith(
      "user_profile_cache",
      JSON.stringify({ ...PROFILE, nickname: "熊妈妈" }),
    );
    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "保存成功" }),
    );
    expect(harness.wx.navigateBack).toHaveBeenCalled();
    expect(page.data.saving).toBe(false);
  });

  it("saves only gender when nickname is unchanged", async () => {
    await page.onLoad();

    page.onSelectGender(genderEvent("female"));
    await page.onSave();

    expect(mockApi.updateUserProfile).toHaveBeenCalledWith({
      gender: "female",
    });
  });

  it("saves only birthday when nickname is unchanged", async () => {
    await page.onLoad();

    page.onBirthdayChange(pickerEvent("1991-01-02"));
    await page.onSave();

    expect(mockApi.updateUserProfile).toHaveBeenCalledWith({
      birthday: "1991-01-02",
    });
  });

  it("caps the nickname at 10 characters on save", async () => {
    await page.onLoad();

    page.onNicknameChange(inputEvent("一二三四五六七八九十十一"));
    await page.onSave();

    expect(mockApi.updateUserProfile).toHaveBeenCalledWith({
      nickname: "一二三四五六七八九十",
    });
  });

  it("keeps the draft and resets the button when saving fails", async () => {
    mockApi.updateUserProfile.mockRejectedValue(new Error("offline"));
    await page.onLoad();

    page.onNicknameChange(inputEvent("新昵称"));
    await page.onSave();

    expect(page.data.form.nickname).toBe("新昵称");
    expect(page.data.saving).toBe(false);
    expect(harness.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "保存失败" }),
    );
    expect(harness.wx.navigateBack).not.toHaveBeenCalled();
    expect(harness.wx.setStorageSync).not.toHaveBeenCalled();
  });

  it("ignores a second tap while a save is in flight", async () => {
    let resolveSave: (value: any) => void = () => undefined;
    mockApi.updateUserProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    await page.onLoad();

    page.onNicknameChange(inputEvent("新昵称"));
    const pending = page.onSave();
    await page.onSave();

    expect(mockApi.updateUserProfile).toHaveBeenCalledTimes(1);
    expect(page.data.saving).toBe(true);

    resolveSave({
      code: 0,
      message: "",
      data: { ...PROFILE, nickname: "新昵称" },
    });
    await pending;

    expect(page.data.saving).toBe(false);
  });

  it("shows a retryable error when loading fails", async () => {
    mockApi.getUserProfile.mockRejectedValueOnce(new Error("offline"));

    await page.onLoad();

    expect(page.data.loadError).toBe(true);
    expect(page.data.loading).toBe(false);

    await page.onRetryLoad();

    expect(mockApi.getUserProfile).toHaveBeenCalledTimes(2);
    expect(page.data.loadError).toBe(false);
    expect(page.data.form.nickname).toBe("熊爸爸");
  });

  it("navigates back from the custom nav bar", () => {
    page.onBack();

    expect(harness.wx.navigateBack).toHaveBeenCalled();
  });

  it("treats an empty payload as a load failure", async () => {
    mockApi.getUserProfile.mockResolvedValue({
      code: 0,
      message: "",
      data: null,
    });

    await page.onLoad();

    expect(page.data.loadError).toBe(true);
    expect(page.data.loading).toBe(false);
  });
});
