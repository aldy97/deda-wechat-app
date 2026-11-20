import { MODE_LABELS } from "./modes";

describe("MODE_LABELS（mode → 展示文案映射）", () => {
  /** 当前会新写入的 7 个平级 mode（primary） */
  const PRIMARY_MODES = [
    ["free_chat", "自由对话"],
    ["english_chat", "英语对话"],
    ["english_story", "英语故事"],
    ["idiom_story", "成语故事"],
    ["sleep_story", "哄睡故事"],
    ["adventure_story", "冒险故事"],
    ["free_story", "自由故事"],
  ] as const;

  /** 11 条 legacy 兜底（仅翻译历史数据，永不新写入） */
  const LEGACY_MODES = [
    ["free_chat_casual", "自由闲聊"],
    ["free_chat_roleplay", "角色扮演"],
    ["free_chat_qa", "百科问答"],
    ["daily_adventure", "每日冒险"],
    ["adventure", "每日冒险"],
    ["story", "故事"],
    ["sleep", "哄睡故事"],
    ["bedtime", "哄睡故事"],
    ["music", "音乐"],
    ["device_control", "设备控制"],
    ["unknown", "其他"],
  ] as const;

  test("当前 7 个平级 mode 映射到正确文案", () => {
    for (const [mode, label] of PRIMARY_MODES) {
      expect(MODE_LABELS[mode]).toBe(label);
    }
  });

  test("11 条 legacy 兜底 mode 映射到正确文案", () => {
    for (const [mode, label] of LEGACY_MODES) {
      expect(MODE_LABELS[mode]).toBe(label);
    }
  });

  test("共 18 条映射，不多不少", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(18);
  });

  test("未知 mode 无映射，由调用方回退到 mode 原文", () => {
    expect(MODE_LABELS["__never__"]).toBeUndefined();
  });
});
