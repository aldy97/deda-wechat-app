import { ChatRecord, DeviceConfig } from "../../api/api";
import { formatChatTime, shouldShowTime } from "../../utils/date";

export interface DisplayRecord extends ChatRecord {
  displayTime?: string;
}

export interface HistoryFilters {
  conversationModeKey?: string | null;
}

/**
 * 聊天记录过滤参数决策：
 * - URL 显式参数优先（直通「查看指定语境」）；
 *   textbookId / unitId 为已废弃的教材参数，一律静默忽略
 * - 无参时按设备当前配置推导：free_chat → 子模式
 * - 无配置 → 不过滤（全部记录）
 * 后端 /conversations 只认显式传参、不读设备配置（契约见 integration.md）。
 */
export function resolveHistoryFilters(
  params: HistoryFilters,
  config: DeviceConfig | null,
): HistoryFilters {
  // URL 显式参数优先
  if (params.conversationModeKey) {
    return { conversationModeKey: params.conversationModeKey };
  }

  if (!config) return {};

  if (config.mode === "free_chat" && config.conversationModeKey) {
    return { conversationModeKey: config.conversationModeKey };
  }
  return {};
}

/** 加载指示的最短展示时长：本地快返回也能被用户看见，避免一闪而过 */
export const MIN_LOADING_MS = 400;

/**
 * 让任务至少耗时 minMs（成功与失败路径都持满）,
 * 用于保证加载指示的可感知时长。
 */
export async function withMinDelay<T>(
  task: Promise<T>,
  minMs = MIN_LOADING_MS,
): Promise<T> {
  const delay = new Promise<void>((resolve) => setTimeout(resolve, minMs));
  try {
    const result = await task;
    await delay;
    return result;
  } catch (error) {
    await delay;
    throw error;
  }
}

/**
 * 是否还有更早的对话页。
 * 后端 total / pageSize 都按 conversation 行计（一行 = 一轮问答）,
 * 而 records 是拆条后的消息数（每行最多 2 条）,两者不能直接比较。
 */
export function computeHasMore(
  fetchedPages: number,
  pageSize: number,
  total: number,
): boolean {
  return fetchedPages * pageSize < total;
}

/**
 * 为记录列表计算显示时间。
 * 后端分页锚定最新（page=1 为最新一页）,页内已按时间正序返回（最旧在前）,
 * 这里正向遍历即可,不要再反转。
 */
export function buildDisplayRecords(items: ChatRecord[]): DisplayRecord[] {
  const result: DisplayRecord[] = [];
  let previousIso: string | undefined;

  for (const item of items) {
    const showTime = shouldShowTime(item.createdAt, previousIso);
    result.push({
      ...item,
      displayTime: showTime ? formatChatTime(item.createdAt) : undefined,
    });
    if (showTime) {
      previousIso = item.createdAt;
    }
  }

  return result;
}
