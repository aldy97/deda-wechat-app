/**
 * 日期格式化工具函数
 */

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
export function formatDate(
  date: Date | number | string = new Date(),
  format = 'YYYY-MM-DD HH:mm:ss',
): string {
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

  const pad = (n: number) => String(n).padStart(2, '0');

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
export function getRelativeTime(date: Date | number | string): string {
  const target = typeof date === 'object' ? date.getTime() : new Date(date).getTime();
  const now = Date.now();
  const diff = now - target;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  return `${Math.floor(diff / day)}天前`;
}

/**
 * 判断两条消息之间是否需要显示时间戳（仿微信）
 * 规则：
 * 1. 第一条消息始终显示
 * 2. 间隔 >= thresholdMinutes 显示
 * 3. 跨天显示
 */
export function shouldShowTime(
  currentIso: string,
  previousIso?: string,
  thresholdMinutes = 5,
): boolean {
  if (!previousIso) return true;

  const current = new Date(currentIso);
  const previous = new Date(previousIso);

  if (isNaN(current.getTime()) || isNaN(previous.getTime())) {
    return false;
  }

  const diffMs = current.getTime() - previous.getTime();
  if (diffMs >= thresholdMinutes * 60 * 1000) return true;

  const currentDay = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const previousDay = new Date(previous.getFullYear(), previous.getMonth(), previous.getDate());
  return currentDay.getTime() !== previousDay.getTime();
}

/**
 * 格式化聊天消息时间（仿微信）
 * - 今天 → "09:45"
 * - 昨天 → "昨天 09:45"
 * - 今年其他天 → "8月14日 09:45"
 * - 往年 → "2025年8月14日 09:45"
 */
export function formatChatTime(isoString: string, now = new Date()): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return timePart;
  if (diffDays === -1) return `昨天 ${timePart}`;
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${timePart}`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timePart}`;
}
