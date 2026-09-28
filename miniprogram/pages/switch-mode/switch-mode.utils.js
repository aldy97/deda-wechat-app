"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveModeRoute = resolveModeRoute;
/**
 * 切换模式页的导航决策（纯函数,便于单测）。
 *
 * 契约:点分类只做导航,不在此页保存配置;
 * 完整载荷由子选择页提交（后端对 mode-only 载荷返回 400）。
 */
function resolveModeRoute(modeKey, deviceId) {
  const id = encodeURIComponent(deviceId);
  switch (modeKey) {
    case "free_chat":
      return `/pages/choose-free-chat-mode/choose-free-chat-mode?id=${id}`;
    case "textbook_learning":
      return `/pages/textbook-learning/textbook-learning?id=${id}`;
    default:
      return null;
  }
}
