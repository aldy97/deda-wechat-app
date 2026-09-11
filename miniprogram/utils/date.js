"use strict";
/**
 * 日期格式化工具函数
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = formatDate;
exports.getRelativeTime = getRelativeTime;
/**
 * 将 Date 对象或时间戳格式化为指定字符串
 * @param date Date 对象、时间戳（毫秒）或 ISO 字符串
 * @param format 目标格式，默认 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的字符串
 *
 * 示例：
 * formatDate(new Date(), 'YYYY-MM-DD') // '2026-09-10'
 * formatDate(1725964800000, 'HH:mm')   // '12:00'
 */
function formatDate(date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') {
    const d = typeof date === 'object' ? date : new Date(date);
    if (isNaN(d.getTime())) {
        console.warn('[formatDate] 无效的日期输入:', date);
        return '';
    }
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const seconds = d.getSeconds();
    const pad = (n) => String(n).padStart(2, '0');
    return format
        .replace('YYYY', String(year))
        .replace('MM', pad(month))
        .replace('DD', pad(day))
        .replace('HH', pad(hours))
        .replace('mm', pad(minutes))
        .replace('ss', pad(seconds));
}
/**
 * 获取相对时间描述（简化版）
 * @param date 目标时间
 */
function getRelativeTime(date) {
    const target = typeof date === 'object' ? date.getTime() : new Date(date).getTime();
    const now = Date.now();
    const diff = now - target;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute)
        return '刚刚';
    if (diff < hour)
        return `${Math.floor(diff / minute)}分钟前`;
    if (diff < day)
        return `${Math.floor(diff / hour)}小时前`;
    return `${Math.floor(diff / day)}天前`;
}
