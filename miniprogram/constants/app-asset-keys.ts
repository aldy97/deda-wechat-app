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
  /** 设备列表页「哄睡管理」入口右侧插画 */
  DEVICE_LIST_SLEEPY_ELLY: "device-list/sleepy-elly",
  /** 设备列表页「冒险故事」入口与介绍页插画 */
  DEVICE_LIST_ADVENTURE_STORY: "device-list/adventure-story",
  /** 哄睡配置页顶部背景图 */
  SLEEP_CONFIG_HERO_BG: "sleep-config/hero-bg",
  /** 晚安故事模式介绍页顶部背景图 */
  NIGHT_STORY_INTRO_HERO_BG: "night-story-intro/hero-bg",
  /** 孩子信息页与哄睡页共用的页头吉祥物 */
  OWNER_INFO_MASCOT: "owner-info/mascot",
} as const;

export type AppAssetKey = (typeof APP_ASSET_KEYS)[keyof typeof APP_ASSET_KEYS];

/** 展示位中文标签，供自检页等开发者视图使用 */
export const APP_ASSET_LABELS: Record<AppAssetKey, string> = {
  [APP_ASSET_KEYS.DIAGNOSTICS_REMOTE_PROBE]: "远程素材探针",
  [APP_ASSET_KEYS.DEVICE_LIST_FEEDBACK_HERO]: "设备列表来信反馈 banner",
  [APP_ASSET_KEYS.DEVICE_LIST_SLEEPY_ELLY]: "设备列表哄睡管理入口插画",
  [APP_ASSET_KEYS.DEVICE_LIST_ADVENTURE_STORY]:
    "设备列表冒险故事入口与介绍页插画",
  [APP_ASSET_KEYS.SLEEP_CONFIG_HERO_BG]: "哄睡配置页顶部背景图",
  [APP_ASSET_KEYS.NIGHT_STORY_INTRO_HERO_BG]: "晚安故事模式介绍页顶部背景图",
  [APP_ASSET_KEYS.OWNER_INFO_MASCOT]: "孩子信息页与哄睡页吉祥物",
};
