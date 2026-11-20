/**
 * 当前会新写入的 7 个平级 mode（primary）：
 *   free_chat / english_chat / english_story / idiom_story /
 *   sleep_story / adventure_story / free_story
 *
 * Legacy 兜底（仅翻译历史数据，永不新写入）：
 *   free_chat_casual / free_chat_roleplay / free_chat_qa
 *   daily_adventure / adventure / story / sleep / bedtime / music
 *   device_control / unknown
 */
export const MODE_LABELS: Record<string, string> = {
  free_chat: "自由对话",
  free_chat_casual: "自由闲聊",
  free_chat_roleplay: "角色扮演",
  free_chat_qa: "百科问答",
  english_chat: "英语对话",
  english_story: "英语故事",
  idiom_story: "成语故事",
  adventure_story: "冒险故事",
  free_story: "自由故事",
  daily_adventure: "每日冒险",
  adventure: "每日冒险",
  story: "故事",
  sleep: "哄睡故事",
  sleep_story: "哄睡故事",
  bedtime: "哄睡故事",
  music: "音乐",
  device_control: "设备控制",
  unknown: "其他",
};
