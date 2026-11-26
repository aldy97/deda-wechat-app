/**
 * 页头「Elly + 对话气泡」展示组件。
 *
 * 孩子信息页与哄睡设置页共用这一份实现：调用方只传文案。
 * 吉祥物的展示位 key 与兜底图写成字面量（仓库级闸口
 * repo-tests/asset-fallbacks.mjs 要求 <elly-image> 的 asset-key 必须已登记、
 * fallback 必须是静态包内路径，禁止动态绑定）。
 */
Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    /** 气泡文案，每项一行 */
    lines: {
      type: Array,
      value: [] as string[],
    },
  },
});
