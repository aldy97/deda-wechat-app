"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_LOADING_MS = void 0;
exports.resolveHistoryFilters = resolveHistoryFilters;
exports.withMinDelay = withMinDelay;
exports.computeHasMore = computeHasMore;
exports.buildDisplayRecords = buildDisplayRecords;
const date_1 = require("../../utils/date");
/**
 * 聊天记录过滤参数决策：
 * - URL 显式参数优先（直通「查看指定语境」）
 * - 无参时按设备当前配置推导，保证页面语境与设备学习状态一致：
 *   locked_unit / textbook_learning → 教材+单元
 *   free_textbook → 教材
 *   free_chat → 子模式
 * - 无配置 → 不过滤（全部记录）
 * 后端 /conversations 只认显式传参、不读设备配置（契约见 integration.md）。
 */
function resolveHistoryFilters(params, config) {
  const clean = (f) => {
    const out = {};
    if (f.textbookId) out.textbookId = f.textbookId;
    if (f.unitId) out.unitId = f.unitId;
    if (f.conversationModeKey) out.conversationModeKey = f.conversationModeKey;
    return out;
  };
  // URL 显式参数优先
  if (params.textbookId || params.unitId || params.conversationModeKey) {
    return clean(params);
  }
  if (!config) return {};
  switch (config.mode) {
    case "locked_unit":
    case "textbook_learning":
      return clean({
        textbookId: config.textbookId,
        unitId: config.unitId,
      });
    case "free_textbook":
      return clean({ textbookId: config.textbookId });
    case "free_chat":
      return clean({ conversationModeKey: config.conversationModeKey });
    default:
      return {};
  }
}
/** 加载指示的最短展示时长：本地快返回也能被用户看见，避免一闪而过 */
exports.MIN_LOADING_MS = 400;
/**
 * 让任务至少耗时 minMs（成功与失败路径都持满）,
 * 用于保证加载指示的可感知时长。
 */
function withMinDelay(task_1) {
  return __awaiter(
    this,
    arguments,
    void 0,
    function* (task, minMs = exports.MIN_LOADING_MS) {
      const delay = new Promise((resolve) => setTimeout(resolve, minMs));
      try {
        const result = yield task;
        yield delay;
        return result;
      } catch (error) {
        yield delay;
        throw error;
      }
    },
  );
}
/**
 * 是否还有更早的对话页。
 * 后端 total / pageSize 都按 conversation 行计（一行 = 一轮问答）,
 * 而 records 是拆条后的消息数（每行最多 2 条）,两者不能直接比较。
 */
function computeHasMore(fetchedPages, pageSize, total) {
  return fetchedPages * pageSize < total;
}
/**
 * 为记录列表计算显示时间。
 * 后端分页锚定最新（page=1 为最新一页）,页内已按时间正序返回（最旧在前）,
 * 这里正向遍历即可,不要再反转。
 */
function buildDisplayRecords(items) {
  const result = [];
  let previousIso;
  for (const item of items) {
    const showTime = (0, date_1.shouldShowTime)(item.createdAt, previousIso);
    result.push(
      Object.assign(Object.assign({}, item), {
        displayTime: showTime
          ? (0, date_1.formatChatTime)(item.createdAt)
          : undefined,
      }),
    );
    if (showTime) {
      previousIso = item.createdAt;
    }
  }
  return result;
}
