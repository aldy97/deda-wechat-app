import {
  bindDevice,
  getDeviceAboutInfo,
  getLearningStatsDaily,
  getLearningStatsModeUsage,
  getSleepConfig,
  getUserProfile,
  controlDeviceVolume,
  reportPushSubscription,
  submitFeedback,
  updateDeviceOrder,
  updateSleepConfig,
  updateUserProfile,
} from "./api";
import { request } from "../utils/request";

jest.mock("../utils/request", () => ({ request: jest.fn() }));

const mockRequest = request as jest.Mock;

describe("learning stats daily request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue({ code: 0, message: "success", data: [] });
  });

  it("loads about info from the device detail endpoint", async () => {
    const detail = {
      deviceId: "aabbccddeeff",
      deviceCode: null,
      firmwareVersion: "V1.01",
      networkType: "WiFi",
      macAddress: "aabbccddeeff",
      createdAt: "2026-11-25T00:30:00.000Z",
      id: "internal-uuid",
    };
    mockRequest.mockResolvedValue({ code: 0, message: "", data: detail });

    const res = await getDeviceAboutInfo("dev/1");

    expect(mockRequest).toHaveBeenCalledWith({
      method: "GET",
      url: "/devices/dev%2F1",
    });
    expect(res.data).toBe(detail);
  });

  it("serializes scope=all for the parent report trend", async () => {
    await getLearningStatsDaily("dev-local-001", 7, { scope: "all" });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "GET",
      url: "/learning-stats/daily?days=7&deviceId=dev-local-001&scope=all",
    });
  });

  it("keeps existing mode filtering unchanged when scope is omitted", async () => {
    await getLearningStatsDaily("dev-local-001", 7, { mode: "free_chat" });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "GET",
      url: "/learning-stats/daily?days=7&deviceId=dev-local-001&mode=free_chat",
    });
  });

  it("requests rolling mode usage with the seven-day default", async () => {
    await getLearningStatsModeUsage("dev local 001");

    expect(mockRequest).toHaveBeenCalledWith({
      method: "GET",
      url: "/learning-stats/mode-usage?deviceId=dev%20local%20001&days=7",
    });
  });

  it("passes an optional rolling usage end date", async () => {
    await getLearningStatsModeUsage("dev-local-001", 7, "2026-11-01");

    expect(mockRequest).toHaveBeenCalledWith({
      method: "GET",
      url: "/learning-stats/mode-usage?deviceId=dev-local-001&days=7&endDate=2026-11-01",
    });
  });

  it("posts feedback without accepting a client-side user id", async () => {
    await submitFeedback({
      content: "建议增加夜间模式",
      contact: "13800138000",
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "POST",
      url: "/feedbacks",
      data: {
        content: "建议增加夜间模式",
        contact: "13800138000",
      },
    });
  });

  it("posts push subscription report to /push-subscriptions", async () => {
    await reportPushSubscription({
      templateId: "tmpl-sleep-reminder",
      result: "accept",
      count: 1,
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "POST",
      url: "/push-subscriptions",
      data: {
        templateId: "tmpl-sleep-reminder",
        result: "accept",
        count: 1,
      },
    });
  });

  it("posts push subscription reject without count", async () => {
    await reportPushSubscription({
      templateId: "tmpl-sleep-reminder",
      result: "reject",
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "POST",
      url: "/push-subscriptions",
      data: {
        templateId: "tmpl-sleep-reminder",
        result: "reject",
      },
    });
  });

  it("puts the complete device order", async () => {
    await updateDeviceOrder(["dev-002", "dev-001"]);

    expect(mockRequest).toHaveBeenCalledWith({
      method: "PUT",
      url: "/devices/order",
      data: { orderedDeviceIds: ["dev-002", "dev-001"] },
    });
  });

  it("binds a device by deviceId", async () => {
    await bindDevice({ deviceId: "aabbccddeeff" });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "POST",
      url: "/devices/bind",
      data: { deviceId: "aabbccddeeff" },
    });
  });
});

describe("sleep config contract (backend: /sleep-configs/device/:deviceId)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue({ code: 0, message: "success", data: null });
  });

  it("reads the sleep config by device id", async () => {
    await getSleepConfig("dev-local-001");

    expect(mockRequest).toHaveBeenCalledWith({
      method: "GET",
      url: "/sleep-configs/device/dev-local-001",
    });
  });

  it("toggles the master switch with a partial patch", async () => {
    await updateSleepConfig("dev-local-001", { enabled: true });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "PATCH",
      url: "/sleep-configs/device/dev-local-001",
      data: { enabled: true },
    });
  });

  it("sends both mode and minutes for a custom duration", async () => {
    await updateSleepConfig("dev-local-001", {
      durationMode: "custom",
      durationMinutes: 20,
    });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "PATCH",
      url: "/sleep-configs/device/dev-local-001",
      data: { durationMode: "custom", durationMinutes: 20 },
    });
  });

  it("omits durationMinutes when switching back to default", async () => {
    await updateSleepConfig("dev-local-001", { durationMode: "default" });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "PATCH",
      url: "/sleep-configs/device/dev-local-001",
      data: { durationMode: "default" },
    });
  });

  it("sends the sleep time in HH:mm", async () => {
    await updateSleepConfig("dev-local-001", { sleepTime: "21:30" });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "PATCH",
      url: "/sleep-configs/device/dev-local-001",
      data: { sleepTime: "21:30" },
    });
  });
});

describe("device volume control request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue({
      code: 0,
      message: "success",
      data: { success: true, deviceId: "dev-local-001", action: "volume" },
    });
  });

  it("posts action=volume to the control endpoint (契约 3.6)", async () => {
    await controlDeviceVolume("dev-local-001", 65);

    expect(mockRequest).toHaveBeenCalledWith({
      method: "POST",
      url: "/devices/dev-local-001/control",
      data: { action: "volume", volume: 65 },
    });
  });

  it("url-encodes the device id", async () => {
    await controlDeviceVolume("dev local 001", 0);

    expect(mockRequest).toHaveBeenCalledWith({
      method: "POST",
      url: "/devices/dev%20local%20001/control",
      data: { action: "volume", volume: 0 },
    });
  });
});

describe("user profile contract (backend: /users/profile)", () => {
  const profile = {
    id: "user-1",
    nickname: "熊爸爸",
    phone: null,
    gender: null,
    birthday: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    deviceCount: 2,
    childCount: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue({
      code: 0,
      message: "success",
      data: profile,
    });
  });

  it("reads the current parent profile with GET", async () => {
    const res = await getUserProfile();

    expect(mockRequest).toHaveBeenCalledWith({
      method: "GET",
      url: "/users/profile",
    });
    expect(res.data).toBe(profile);
  });

  it("patches the nickname and nothing else", async () => {
    await updateUserProfile({ nickname: "熊爸爸" });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "PATCH",
      url: "/users/profile",
      data: { nickname: "熊爸爸" },
    });
  });

  it("只传性别时只发送 gender", async () => {
    await updateUserProfile({ gender: "female" });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "PATCH",
      url: "/users/profile",
      data: { gender: "female" },
    });
  });

  it("同时传性别与生日时原样透传，支持 null 清空", async () => {
    await updateUserProfile({ gender: null, birthday: "1990-05-20" });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "PATCH",
      url: "/users/profile",
      data: { gender: null, birthday: "1990-05-20" },
    });
  });
});
