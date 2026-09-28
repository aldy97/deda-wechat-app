"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const switch_mode_utils_1 = require("./switch-mode.utils");
describe("switch-mode utils", () => {
  describe("resolveModeRoute", () => {
    it("routes free_chat to the sub-mode picker with device id", () => {
      expect(
        (0, switch_mode_utils_1.resolveModeRoute)("free_chat", "dev-001"),
      ).toBe("/pages/choose-free-chat-mode/choose-free-chat-mode?id=dev-001");
    });
    it("routes textbook_learning to the textbook learning page", () => {
      expect(
        (0, switch_mode_utils_1.resolveModeRoute)(
          "textbook_learning",
          "dev-001",
        ),
      ).toBe("/pages/textbook-learning/textbook-learning?id=dev-001");
    });
    it("returns null for unknown mode keys", () => {
      expect(
        (0, switch_mode_utils_1.resolveModeRoute)("locked_unit", "dev-001"),
      ).toBeNull();
      expect(
        (0, switch_mode_utils_1.resolveModeRoute)("", "dev-001"),
      ).toBeNull();
    });
    it("url-encodes the device id", () => {
      expect(
        (0, switch_mode_utils_1.resolveModeRoute)("free_chat", "dev 001"),
      ).toContain("id=dev%20001");
    });
  });
});
