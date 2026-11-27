import { request } from "../utils/request";
import { reportClientInfo } from "./client-info";

jest.mock("../utils/request", () => ({ request: jest.fn() }));

const mockRequest = request as jest.Mock;

describe("reportClientInfo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockResolvedValue({
      code: 0,
      message: "success",
      data: { success: true, skipped: false },
    });
  });

  it("posts the phone brand to /users/client-info", async () => {
    const res = await reportClientInfo({ brand: "Apple" });

    expect(mockRequest).toHaveBeenCalledWith({
      method: "POST",
      url: "/users/client-info",
      data: { brand: "Apple" },
    });
    expect(res.data).toEqual({ success: true, skipped: false });
  });
});
