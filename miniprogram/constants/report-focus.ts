/**
 * 设备卡片「查看成长报告」的跨页交接 key。
 *
 * 「更懂TA」是 tabBar 页面，只能 `wx.switchTab` 进入，而 switchTab 不支持 query 参数，
 * 因此设备 id 先写入 storage，报告页落地后消费一次并立即清除。
 */
export const REPORT_FOCUS_DEVICE_KEY = "report_focus_device_id";
