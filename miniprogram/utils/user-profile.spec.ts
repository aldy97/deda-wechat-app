import {
  PROFILE_CACHE_KEY,
  isProfileEmpty,
  normalizeNickname,
  profileDisplayName,
  profileMeta,
  readCachedProfile,
  writeCachedProfile,
} from "./user-profile";

const PROFILE = {
  id: "user-1",
  nickname: "熊爸爸",
  phone: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  deviceCount: 2,
  childCount: 2,
};

describe("user-profile cache", () => {
  let storage: Record<string, jest.Mock>;

  beforeEach(() => {
    storage = {
      getStorageSync: jest.fn().mockReturnValue(""),
      setStorageSync: jest.fn(),
    };
    (globalThis as any).wx = storage;
  });

  it("round-trips a profile through the cache key", () => {
    writeCachedProfile(PROFILE);

    expect(storage.setStorageSync).toHaveBeenCalledWith(
      PROFILE_CACHE_KEY,
      JSON.stringify(PROFILE),
    );

    storage.getStorageSync.mockReturnValue(JSON.stringify(PROFILE));
    expect(readCachedProfile()).toEqual(PROFILE);
  });

  it("returns null when nothing is cached", () => {
    expect(readCachedProfile()).toBeNull();
  });

  it("returns null when storage throws", () => {
    storage.getStorageSync.mockImplementation(() => {
      throw new Error("storage broken");
    });

    expect(readCachedProfile()).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    storage.getStorageSync.mockReturnValue("{not json");

    expect(readCachedProfile()).toBeNull();
  });

  it("returns null on a structurally invalid payload", () => {
    storage.getStorageSync.mockReturnValue(
      JSON.stringify({ id: "user-1", nickname: 42 }),
    );

    expect(readCachedProfile()).toBeNull();
  });

  it("accepts a null nickname and null phone", () => {
    const empty = { ...PROFILE, nickname: null, phone: null };
    storage.getStorageSync.mockReturnValue(JSON.stringify(empty));

    expect(readCachedProfile()).toEqual(empty);
  });

  it("swallows write failures", () => {
    storage.setStorageSync.mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => writeCachedProfile(PROFILE)).not.toThrow();
  });
});

describe("profileDisplayName", () => {
  it("uses the trimmed nickname", () => {
    expect(profileDisplayName("  熊爸爸 ")).toBe("熊爸爸");
  });

  it("falls back for null, empty and blank nicknames", () => {
    expect(profileDisplayName(null)).toBe("未设置昵称");
    expect(profileDisplayName("")).toBe("未设置昵称");
    expect(profileDisplayName("   ")).toBe("未设置昵称");
  });
});

describe("profileMeta", () => {
  it("joins device and child counts", () => {
    expect(profileMeta(2, 2)).toBe("2 台设备 · 2 个孩子");
  });

  it("drops the child segment when there are no children", () => {
    expect(profileMeta(2, 0)).toBe("2 台设备");
  });

  it("reports the no-device state", () => {
    expect(profileMeta(0, 0)).toBe("还没有绑定设备");
  });
});

describe("isProfileEmpty", () => {
  it("treats a missing profile as empty", () => {
    expect(isProfileEmpty(null)).toBe(true);
  });

  it("treats a null or blank nickname as empty", () => {
    expect(isProfileEmpty({ ...PROFILE, nickname: null })).toBe(true);
    expect(isProfileEmpty({ ...PROFILE, nickname: "  " })).toBe(true);
  });

  it("treats a real nickname as filled", () => {
    expect(isProfileEmpty(PROFILE)).toBe(false);
  });
});

describe("normalizeNickname", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeNickname("  小熊 ")).toBe("小熊");
  });

  it("caps the result at 20 characters", () => {
    expect(normalizeNickname("a".repeat(30))).toHaveLength(20);
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeNickname("   ")).toBe("");
  });
});
