/**
 * 切换模式页的导航决策（纯函数,便于单测）。
 *
 * 契约:点分类只做导航,不在此页保存配置;
 * 完整载荷由子选择页提交（后端对 mode-only 载荷返回 400）。
 */
export function resolveModeRoute(
  modeKey: string,
  deviceId: string,
): string | null {
  const id = encodeURIComponent(deviceId);
  switch (modeKey) {
    case "free_chat":
      return `/pages/choose-free-chat-mode/choose-free-chat-mode?id=${id}`;
    default:
      return null;
  }
}
