import {
  bindDevice,
  getLearningStatsDaily,
  getLearningStatsModeUsage,
  getSleepConfig,
  controlDeviceVolume,
  submitFeedback,
  updateDeviceOrder,
  updateSleepConfig,
} from "./api";
import { request } from "../utils/request";

jest.mock("../utils/request", () => ({ request: jest.fn() }));

const mockRequest = request as jest.Mock;

describe("learning stats daily request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue({ code: 0, message: "success", data: [] });
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
