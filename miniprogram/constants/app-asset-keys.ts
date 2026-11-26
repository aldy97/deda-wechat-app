/**
 * 展示型 Elly 素材的展示位 key 注册表。
 *
 * 远端 manifest 只下发这里登记过的 key；小程序侧按 key 渲染，
 * 拉取失败 / key 缺失 / 图片失败时统一回退包内 fallback。
 */
export const APP_ASSET_KEYS = {
  /** 远程素材探针：用于验证 manifest 拉取与远程图片渲染链路 */
  DIAGNOSTICS_REMOTE_PROBE: "diagnostics/remote-probe",
  /** 设备列表页「听风原野信箱」来信反馈 banner */
  DEVICE_LIST_FEEDBACK_HERO: "device-list/feedback-hero",
  /** 孩子信息页页头吉祥物 */
  OWNER_INFO_MASCOT: "owner-info/mascot",
  /** 哄睡管理页页头吉祥物 */
  SLEEP_MANAGE_MASCOT: "sleep-manage/mascot",
} as const;

export type AppAssetKey = (typeof APP_ASSET_KEYS)[keyof typeof APP_ASSET_KEYS];

/** 展示位中文标签，供自检页等开发者视图使用 */
export const APP_ASSET_LABELS: Record<AppAssetKey, string> = {
  [APP_ASSET_KEYS.DIAGNOSTICS_REMOTE_PROBE]: "远程素材探针",
  [APP_ASSET_KEYS.DEVICE_LIST_FEEDBACK_HERO]: "设备列表来信反馈 banner",
  [APP_ASSET_KEYS.OWNER_INFO_MASCOT]: "孩子信息页吉祥物",
  [APP_ASSET_KEYS.SLEEP_MANAGE_MASCOT]: "哄睡管理页吉祥物",
};
