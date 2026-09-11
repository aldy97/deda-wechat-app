"use strict";
/**
 * 分页工具函数
 * 用于对话记录等列表的分页加载。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginate = paginate;
exports.canLoadMore = canLoadMore;
exports.nextPage = nextPage;
exports.paginateFromEnd = paginateFromEnd;
/**
 * 对完整数组进行本地分页
 * @param list 原始数组
 * @param page 当前页码，从 1 开始
 * @param pageSize 每页条数
 * @returns 分页结果
 */
function paginate(list, page = 1, pageSize = 10) {
    const total = list.length;
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    return {
        list: list.slice(start, end),
        page,
        pageSize,
        total,
        hasMore: end < total,
    };
}
/**
 * 根据当前分页结果判断是否可以加载更多
 * @param result 分页结果
 */
function canLoadMore(result) {
    return result.hasMore;
}
/**
 * 计算下一页页码
 * @param result 分页结果
 * @returns 下一页页码，若已到底则返回当前页
 */
function nextPage(result) {
    return result.hasMore ? result.page + 1 : result.page;
}
/**
 * 从数组末尾向前加载数据
 * 适用于「先展示最新内容，向上滚动加载更早内容」的场景。
 * @param list 按时间正序排列的原始数组（旧 → 新）
 * @param loadedCount 已从末尾加载的条数
 * @param pageSize 本次要加载的条数
 * @returns 反向分页结果，list 为更早的一批数据（仍按旧 → 新排列）
 */
function paginateFromEnd(list, loadedCount = 0, pageSize = 10) {
    const total = list.length;
    const endIndex = total - loadedCount;
    const startIndex = Math.max(0, endIndex - pageSize);
    return {
        list: list.slice(startIndex, endIndex),
        loadedCount: loadedCount + (endIndex - startIndex),
        pageSize,
        total,
        hasMore: startIndex > 0,
    };
}
