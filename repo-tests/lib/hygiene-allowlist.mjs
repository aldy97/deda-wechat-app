// 仓库卫生白名单。每条必须写明原因；条目失效（文件被删/不再违规）会让
// hygiene.test.mjs 的 staleAllowlistEntries 用例变红，强制同步清理。
//
// 目标状态：四个白名单全部为空。任何新增都必须先想清楚「为什么必须留在仓库」。

/** 垃圾命名白名单：相对仓库根目录 */
export const JUNK_ALLOWLIST = {};

/** 0 字节文件白名单：相对仓库根目录 */
export const ZERO_BYTE_ALLOWLIST = {};

/** 空目录白名单：相对仓库根目录 */
export const EMPTY_DIR_ALLOWLIST = {};

/** 超大文件白名单（> 1MB）：相对仓库根目录 */
export const OVERSIZE_ALLOWLIST = {};

/** 重复内容白名单：键为内容 sha256（前 16 位可），值为原因 */
export const DUPLICATE_ALLOWLIST = {};
