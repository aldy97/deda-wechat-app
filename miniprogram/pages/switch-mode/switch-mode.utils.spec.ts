import { resolveModeRoute } from "./switch-mode.utils";

describe("switch-mode utils", () => {
  describe("resolveModeRoute", () => {
    it("routes free_chat to the sub-mode picker with device id", () => {
      expect(resolveModeRoute("free_chat", "dev-001")).toBe(
        "/pages/choose-free-chat-mode/choose-free-chat-mode?id=dev-001",
      );
    });

    it("routes textbook_learning to the textbook learning page", () => {
      expect(resolveModeRoute("textbook_learning", "dev-001")).toBe(
        "/pages/textbook-learning/textbook-learning?id=dev-001",
      );
    });

    it("returns null for unknown mode keys", () => {
      expect(resolveModeRoute("locked_unit", "dev-001")).toBeNull();
      expect(resolveModeRoute("", "dev-001")).toBeNull();
    });

    it("url-encodes the device id", () => {
      expect(resolveModeRoute("free_chat", "dev 001")).toContain(
        "id=dev%20001",
      );
    });
  });
});
