import { getChatRecords, getDeviceCurrentConfig, ChatRecord, DeviceConfig } from '../../api/api';
import { formatChatTime, shouldShowTime } from '../../utils/date';

interface DisplayRecord extends ChatRecord {
  displayTime?: string;
}

interface ChatHistoryData {
  deviceId: string;
  loading: boolean;
  records: DisplayRecord[];
  hasMore: boolean;
  page: number;
  pageSize: number;
  initialLoaded: boolean;
  scrollIntoView: string;
  contextHint: string;
}

/**
 * 对话记录页
 * 进入页面展示最新消息并定位到底部，向上滚动加载更早消息。
 * 后端按 spokeAt 倒序返回（最新在前），前端渲染时按数组顺序展示，
 * 通过 CSS 控制消息从底部向上排列。
 */
Page<ChatHistoryData, Record<string, any>>({
  data: {
    deviceId: '',
    loading: false,
    records: [],
    hasMore: true,
    page: 1,
    pageSize: 20,
    initialLoaded: false,
    scrollIntoView: '',
    contextHint: '',
  },

  onLoad(options) {
    const deviceId = options?.id || '';
    this.setData({ deviceId });
    this.loadContext(deviceId);
    this.loadInitialRecords();
  },

  /**
   * 加载设备当前配置，设置导航栏标题与顶部提示
   */
  async loadContext(deviceId: string) {
    if (!deviceId) return;

    try {
      const res = await getDeviceCurrentConfig(deviceId);
      const config = res.data;
      this.applyContext(config);
    } catch (error) {
      console.warn('[chat-history] 加载设备配置失败', error);
    }
  },

  applyContext(config: DeviceConfig) {
    let title = '';
    let hint = '';

    if (config.mode === 'free_chat' && config.conversationModeName) {
      title = config.conversationModeName;
      hint = config.conversationModeDescription || '';
    } else if ((config.mode === 'locked_unit' || config.mode === 'textbook_learning') && config.textbookName) {
      title = config.unitName ? `${config.textbookName} · ${config.unitName}` : config.textbookName;
      hint = config.unitDescription || config.textbookName || '';
    } else {
      title = config.textbookName || config.conversationModeName || '对话记录';
      hint = config.unitDescription || config.conversationModeDescription || '';
    }

    wx.setNavigationBarTitle({ title });
    this.setData({ contextHint: hint });
  },

  /**
   * 初始加载：拉取第一页（最新 N 条）并滚动到底部
   */
  async loadInitialRecords() {
    this.setData({ loading: true, page: 1 });
    try {
      const res = await getChatRecords(1, this.data.pageSize);
      const items = res.data.items || [];
      const total = res.data.total || 0;
      const records = this.buildDisplayRecords(items);

      this.setData({
        records,
        hasMore: records.length < total,
        page: 2,
        initialLoaded: true,
        scrollIntoView: 'msg-last',
      });
    } catch (error) {
      wx.showToast({ title: '记录加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 向上滚动到顶部时加载更早消息（下一页）
   */
  async onScrollToUpper() {
    if (!this.data.hasMore || this.data.loading) return;

    const anchorMessageId = this.data.records[0]?.id || '';
    this.setData({ loading: true, scrollIntoView: '' });

    try {
      const res = await getChatRecords(this.data.page, this.data.pageSize);
      const items = res.data.items || [];
      const total = res.data.total || 0;
      const olderRecords = this.buildDisplayRecords(items);
      const merged = olderRecords.concat(this.data.records);

      this.setData({
        records: merged,
        hasMore: merged.length < total,
        page: this.data.page + 1,
        scrollIntoView: anchorMessageId ? `msg-${anchorMessageId}` : '',
      });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 为记录列表计算显示时间
   * 后端返回倒序（最新在前），这里从旧到新遍历以判断相邻消息间隔。
   */
  buildDisplayRecords(items: ChatRecord[]): DisplayRecord[] {
    const result: DisplayRecord[] = [];
    let previousIso: string | undefined;

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const showTime = shouldShowTime(item.createdAt, previousIso);
      result.unshift({
        ...item,
        displayTime: showTime ? formatChatTime(item.createdAt) : undefined,
      });
      if (showTime) {
        previousIso = item.createdAt;
      }
    }

    return result;
  },
});
