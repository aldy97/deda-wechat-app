import { request } from "./request";

/**
 * 展示型 Elly 素材：远端 manifest 下发 key → 图片 URL，小程序按 key 渲染。
 *
 * 本模块只做「拉取 + 缓存 + 按 key 解析」，不涉及上传/头像/chooseMedia。
 * - 内存缓存 + storage 持久缓存，TTL 5 分钟
 * - 并发调用共享同一个 in-flight Promise
 * - 缓存损坏 / storage 读写抛错 / 请求失败 / 业务失败 / 超时一律兜底
 * - 过期且请求失败时，回退可用的旧缓存
 */

export interface AppAssetEntry {
  url: string;
}

export interface AppAssetManifest {
  version: string;
  assets: Record<string, AppAssetEntry>;
}

export const APP_ASSETS_STORAGE_KEY = "app-assets-manifest-cache";
export const APP_ASSETS_TTL_MS = 5 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 5000;

interface PersistedManifest {
  manifest: AppAssetManifest;
  cachedAt: number;
}

let memoryManifest: AppAssetManifest | null = null;
let memoryCachedAt = 0;
let inFlight: Promise<AppAssetManifest> | null = null;
let forceInFlight: Promise<AppAssetManifest> | null = null;
/** 未命中展示位时的自愈额度：每个会话只允许强制刷新一次 */
let missHealUsed = false;

function now(): number {
  return Date.now();
}

/** 规范化 manifest；非法结构返回 null，缺失 url 的 entry 会被丢弃。 */
function normalizeManifest(raw: unknown): AppAssetManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { assets?: unknown; version?: unknown };
  if (Array.isArray(record.assets)) return null;
  if (!record.assets || typeof record.assets !== "object") return null;

  const assets: Record<string, AppAssetEntry> = {};
  const rawAssets = record.assets as Record<string, unknown>;
  for (const key of Object.keys(rawAssets)) {
    const entry = rawAssets[key];
    if (!entry || typeof entry !== "object") continue;
    const rawUrl = (entry as { url?: unknown }).url;
    if (typeof rawUrl !== "string") continue;
    const url = rawUrl.trim();
    if (!url) continue;
    assets[key] = { url };
  }

  return {
    version: typeof record.version === "string" ? record.version : "",
    assets,
  };
}

function readPersisted(): PersistedManifest | null {
  try {
    const raw = wx.getStorageSync(APP_ASSETS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    const manifest = normalizeManifest(parsed.manifest);
    if (!manifest) return null;
    const cachedAt = typeof parsed.cachedAt === "number" ? parsed.cachedAt : 0;
    return { manifest, cachedAt };
  } catch (error) {
    return null;
  }
}

function writePersisted(manifest: AppAssetManifest): void {
  try {
    wx.setStorageSync(
      APP_ASSETS_STORAGE_KEY,
      JSON.stringify({ manifest, cachedAt: now() }),
    );
  } catch (error) {
    // storage 写失败不影响内存缓存，忽略即可
  }
}

function withTimeout(
  promise: Promise<AppAssetManifest>,
  ms: number,
): Promise<AppAssetManifest> {
  return new Promise<AppAssetManifest>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("App assets manifest timeout"));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function fetchManifest(): Promise<AppAssetManifest> {
  return request<AppAssetManifest>({
    method: "GET",
    url: "/app-assets/manifest",
  }).then((res) => {
    const manifest = normalizeManifest(res.data);
    if (!manifest) {
      throw new Error("App assets manifest invalid");
    }
    return manifest;
  });
}

function fetchManifestWithTimeout(): Promise<AppAssetManifest> {
  return withTimeout(fetchManifest(), REQUEST_TIMEOUT_MS);
}

function cacheManifest(manifest: AppAssetManifest): void {
  memoryManifest = manifest;
  memoryCachedAt = now();
  writePersisted(manifest);
}

/**
 * 拉取并缓存 manifest；成功/失败都会解析成 Promise。
 * 过期且请求失败时，回退内存或 storage 中的旧缓存；完全没有可用缓存时才 reject。
 */
export function loadAppAssets(): Promise<AppAssetManifest> {
  if (inFlight) {
    return inFlight;
  }

  if (memoryManifest && now() - memoryCachedAt < APP_ASSETS_TTL_MS) {
    return Promise.resolve(memoryManifest);
  }

  const persisted = readPersisted();
  if (
    !memoryManifest &&
    persisted &&
    now() - persisted.cachedAt < APP_ASSETS_TTL_MS
  ) {
    memoryManifest = persisted.manifest;
    memoryCachedAt = persisted.cachedAt;
    return Promise.resolve(persisted.manifest);
  }

  let fallback: AppAssetManifest | null = memoryManifest;
  if (!fallback && persisted) {
    fallback = persisted.manifest;
  }

  const promise = fetchManifestWithTimeout()
    .then((manifest) => {
      cacheManifest(manifest);
      return manifest;
    })
    .catch((error) => {
      if (fallback) {
        // 请求失败但仍有旧缓存：放回内存供 resolveAppAsset 使用；
        // cachedAt 置 0 保证下次调用继续重试。
        memoryManifest = fallback;
        memoryCachedAt = 0;
        return fallback;
      }
      throw error;
    });

  inFlight = promise;
  const clearInFlight = () => {
    inFlight = null;
  };
  promise.then(clearInFlight, clearInFlight);

  return promise;
}

/** 忽略缓存强制刷新；失败时同样回退旧缓存，保证自检页不会因一次刷新而白屏。 */
export function forceRefreshAppAssets(): Promise<AppAssetManifest> {
  // 一屏里多个展示位同时未命中时共享同一次刷新，避免并发打接口
  if (forceInFlight) {
    return forceInFlight;
  }

  let fallback: AppAssetManifest | null = memoryManifest;
  if (!fallback) {
    const persisted = readPersisted();
    if (persisted) {
      fallback = persisted.manifest;
    }
  }

  const promise = fetchManifestWithTimeout()
    .then((manifest) => {
      cacheManifest(manifest);
      return manifest;
    })
    .catch((error) => {
      if (fallback) {
        memoryManifest = fallback;
        memoryCachedAt = 0;
        return fallback;
      }
      throw error;
    });

  forceInFlight = promise;
  const clearForceInFlight = () => {
    forceInFlight = null;
  };
  promise.then(clearForceInFlight, clearForceInFlight);

  return promise;
}

/**
 * 未命中展示位时申请一次强制刷新额度。
 *
 * 设备上可能长期持有旧 manifest（拉取失败时回退旧缓存，且页面不会重试），
 * 表现为「新上传的图在真机永远不出现」。第一次未命中就强制刷新一次，
 * 让页面自愈；同一会话不再重复请求。
 */
export function takeMissHealChance(): boolean {
  if (missHealUsed) return false;
  missHealUsed = true;
  return true;
}

/** 同步解析指定 key 的远程素材 entry；未命中或 entry 缺 url 时返回 null。 */
export function resolveAppAsset(key: string): AppAssetEntry | null {
  if (!memoryManifest) return null;
  const entry = memoryManifest.assets[key];
  if (!entry) return null;
  return entry;
}

/** 测试重置入口：清空内存缓存、in-flight Promise 与持久缓存。 */
export function resetAppAssetsForTest(): void {
  memoryManifest = null;
  memoryCachedAt = 0;
  inFlight = null;
  forceInFlight = null;
  missHealUsed = false;
  try {
    wx.removeStorageSync(APP_ASSETS_STORAGE_KEY);
  } catch (error) {
    // storage 清理失败不影响测试隔离
  }
}
