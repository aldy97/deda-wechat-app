import path from "node:path";

// elly-image fallback 闸口的纯判定逻辑。
// 与文件系统解耦：exists / sizeOf 由调用方注入，便于 fixture 测试。

export const FALLBACK_MAX_BYTES = 200 * 1024;
export const FALLBACK_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

/**
 * 校验 <elly-image> 的 fallback 属性。
 * 规则：必填、禁止动态绑定、必须 /static/ 前缀、扩展名限 png/jpg/jpeg、文件存在、≤200KB。
 */
export function validateFallbacks(usages, fileSystem) {
  const errors = [];
  for (const usage of usages) {
    const where = usage.file;
    const fallback = usage.fallback;
    if (!fallback) {
      errors.push(`${where}: <elly-image> 缺少 fallback`);
      continue;
    }
    if (fallback.includes("{{")) {
      errors.push(`${where}: fallback 必须为静态路径，禁止动态绑定`);
      continue;
    }
    if (!fallback.startsWith("/static/")) {
      errors.push(`${where}: fallback 必须以 /static/ 开头，实际为 ${fallback}`);
      continue;
    }
    const relative = fallback.replace(/^\/+/, "");
    const ext = path.extname(relative).toLowerCase();
    if (!FALLBACK_EXTENSIONS.has(ext)) {
      errors.push(
        `${where}: fallback 必须是 png/jpg/jpeg（iOS 不解码包内 webp），实际为 ${
          ext || "(无扩展名)"
        }`,
      );
      continue;
    }
    if (!fileSystem.exists(relative)) {
      errors.push(`${where}: fallback 文件不存在 /${relative}`);
      continue;
    }
    const size = fileSystem.sizeOf(relative);
    if (size > FALLBACK_MAX_BYTES) {
      errors.push(
        `${where}: fallback 体积 ${size} 字节，超过 ${FALLBACK_MAX_BYTES} 上限`,
      );
    }
  }
  return errors;
}

/** 校验 <elly-image> 的 asset-key 已登记在 app-asset-keys.ts。 */
export function validateAssetKeys(usages, knownKeys) {
  const errors = [];
  for (const usage of usages) {
    const where = usage.file;
    if (!usage.assetKey) {
      errors.push(`${where}: <elly-image> 缺少 asset-key`);
      continue;
    }
    if (!knownKeys.has(usage.assetKey)) {
      errors.push(
        `${where}: asset-key "${usage.assetKey}" 未在 app-asset-keys.ts 登记`,
      );
    }
  }
  return errors;
}
