import {
  Device,
  LearningStatsDailyPoint,
  ParentReport,
  ParentReportModeUsage,
  ParentReportSummary,
  ensureAuthToken,
  getDeviceList,
  getLearningStatsDaily,
  getLearningStatsModeUsage,
  getParentReport,
  submitParentReportFeedback,
} from "../../api/api";
import { formatDate } from "../../utils/date";
import { CANVAS_MODE_COLORS, CANVAS_UI_COLORS } from "../../styles/palette";
import { allocateIntegerPercentages } from "./learning-data.utils";
import {
  buildPieTarget,
  interpolatePieSegments,
  PieSegment,
  visiblePieSegments,
} from "./learning-data.pie";

interface TrendBar {
  label: string;
  value: number;
  height: number;
}

interface ModeUsageView {
  mode: string;
  label: string;
  count: number;
  percent: number;
  color: string;
  paintColor: string;
}

const MODE_LABELS: Record<string, string> = {
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
  textbook_learning: "英语互动",
  locked_unit: "英语互动",
  free_textbook: "英语互动",
  device_control: "设备控制",
  unknown: "其他",
};

const MODE_COLORS = [
  "var(--color-mode-1)",
  "var(--color-mode-2)",
  "var(--color-mode-3)",
  "var(--color-mode-4)",
  "var(--color-mode-5)",
  "var(--color-mode-6)",
];

/** 设备列表缓存键（与 device-list / device-setting 保持一致） */
const DEVICE_LIST_CACHE_KEY = "device_list_cache";
/** 报告数据缓存前缀，key 形如 learning_report_cache_<deviceId>_<YYYY-MM-DD> */
const REPORT_CACHE_PREFIX = "learning_report_cache";
/** 报告缓存保留时长：7 天 */
const REPORT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/** 报告页本地缓存内容（用于冷启动首帧直出） */
interface ReportCache {
  cachedAt: number;
  trendBars: TrendBar[];
  modeUsage: ModeUsageView[];
  usageActualDays: number;
  durationMinutes: number;
  summary: ParentReportSummary | null;
  hasSummaryContent: boolean;
  hasReportActivity: boolean;
  feedback: ParentReport["feedback"];
  reportGeneratedAt: string;
}

/**
 * “更懂TA”家长日报页：只保留使用时长、功能使用和当日总结。
 * 不展示学习评分、主题分布、单元进度、学习动态或健康度。
 */
Page({
  reportRequestId: 0,
  pieCanvas: null as any,
  pieContext: null as any,
  pieSize: 0,
  pieSegments: [] as PieSegment[],
  pieHasRendered: false,
  pieAnimationId: 0,
  pendingPieItems: null as ModeUsageView[] | null,
  modeColorIndexes: {} as Record<string, number>,
  nextModeColorIndex: 0,
  /** 缓存预热命中的设备 id（空表示无缓存冷启动） */
  warmedDeviceId: "",
  /** 首轮网络加载是否已由 onReady 启动（onShow 刷新守卫） */
  networkStarted: false,

  data: {
    initialized: false,
    loadingDevices: true,
    loadingDaily: true,
    loadingReport: true,
    loadingUsage: true,
    deviceError: false,
    dailyError: false,
    reportError: false,
    usageError: false,
    feedbackSubmitting: false,
    deviceDropdownVisible: false,
    devices: [] as Device[],
    selectedDeviceId: "",
    selectedDeviceName: "",
    reportDate: "",
    reportGeneratedAt: "",
    trendBars: [] as TrendBar[],
    modeUsage: [] as ModeUsageView[],
    usageActualDays: 0,
    usagePieVisible: false,
    activeModeUsage: null as ModeUsageView | null,
    durationMinutes: 0,
    summary: null as ParentReportSummary | null,
    hasSummaryContent: false,
    hasReportActivity: false,
    feedback: null as ParentReport["feedback"],
  },

  onLoad() {
    this.modeColorIndexes = {};
    this.nextModeColorIndex = 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.setData({
      reportDate: formatDate(yesterday, "YYYY-MM-DD"),
    });
    // 冷启动首帧：同步读缓存直出；网络请求统一在 onReady（首帧渲染完成后）启动，
    // 保证骨架屏/缓存内容先可见，不依赖“网络比渲染慢”的偶然时序。
    this.warmupFromCache();
  },

  onReady() {
    return this.initialize();
  },

  onUnload() {
    this.pieAnimationId += 1;
  },

  async onShow() {
    // 首轮网络加载由 onReady 触发，这里只负责后续回到本页时的静默刷新
    if (this.networkStarted && !this.data.loadingDevices) {
      await this.loadReportData();
    }
  },

  async onPullDownRefresh() {
    if (this.data.deviceError) {
      await this.initialize();
    } else {
      await this.loadReportData();
    }
    wx.stopPullDownRefresh();
  },

  /**
   * 冷启动缓存预热（同步）：首帧直接渲染上次的设备与报告数据。
   */
  warmupFromCache() {
    this.cleanExpiredReportCache();
    const cachedDevices = this.readDeviceListCache();
    const cachedSelected = cachedDevices[0];
    if (!cachedSelected) return;
    this.warmedDeviceId = cachedSelected.id;
    this.setData({
      devices: cachedDevices,
      selectedDeviceId: cachedSelected.id,
      selectedDeviceName: this.getDeviceName(cachedSelected),
      initialized: true,
      loadingDevices: false,
      deviceError: false,
    });
    this.restoreReportCache(cachedSelected.id);
  },

  async initialize() {
    this.networkStarted = true;
    const warmed = !!this.warmedDeviceId;
    // 无缓存冷启动才展示整页骨架；有缓存时静默后台刷新
    if (!warmed) {
      this.setData({ loadingDevices: true, deviceError: false });
    }
    try {
      await ensureAuthToken();
      const res = await getDeviceList();
      const devices = res.data || [];
      const selected =
        devices.find((item) => item.id === this.data.selectedDeviceId) ||
        devices[0];
      this.writeDeviceListCache(devices);
      this.setData({
        devices,
        selectedDeviceId: selected?.id || "",
        selectedDeviceName: this.getDeviceName(selected),
        initialized: true,
      });
      if (selected) {
        if (selected.id !== this.warmedDeviceId) {
          // 首次加载，或缓存中的首选设备已失效
          this.restoreReportCache(selected.id);
        }
        await this.loadReportData();
      } else {
        this.setData({
          loadingDaily: false,
          loadingReport: false,
          loadingUsage: false,
        });
      }
    } catch (error) {
      if (!warmed) {
        this.setData({
          initialized: true,
          deviceError: true,
          devices: [],
          loadingDaily: false,
          loadingReport: false,
          loadingUsage: false,
        });
      }
      wx.showToast({
        title: warmed ? "设备列表刷新失败" : "设备加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ loadingDevices: false });
    }
  },

  /**
   * 读取设备列表缓存（device-list / device-setting 共用同一键）
   */
  readDeviceListCache(): Device[] {
    try {
      return (
        (wx.getStorageSync(DEVICE_LIST_CACHE_KEY) as Device[] | undefined) || []
      );
    } catch (error) {
      return [];
    }
  },

  /**
   * 写入设备列表缓存
   */
  writeDeviceListCache(devices: Device[]) {
    try {
      wx.setStorageSync(DEVICE_LIST_CACHE_KEY, devices);
    } catch (error) {
      console.warn("[learning-data] 写入设备列表缓存失败", error);
    }
  },

  /**
   * 恢复报告数据缓存用于首帧直出；返回是否有可用缓存
   */
  restoreReportCache(deviceId: string): boolean {
    try {
      const cache = wx.getStorageSync(this.reportCacheKey(deviceId)) as
        ReportCache | undefined;
      if (!cache || Date.now() - cache.cachedAt > REPORT_CACHE_TTL) {
        return false;
      }
      const modeUsage = cache.modeUsage || [];
      this.setData(
        {
          trendBars: cache.trendBars || [],
          modeUsage,
          usageActualDays: cache.usageActualDays || 0,
          usagePieVisible: modeUsage.length > 0,
          durationMinutes: cache.durationMinutes || 0,
          summary: cache.summary || null,
          hasSummaryContent: !!cache.hasSummaryContent,
          hasReportActivity: !!cache.hasReportActivity,
          feedback: cache.feedback || null,
          reportGeneratedAt: cache.reportGeneratedAt || "",
        },
        () => {
          if (modeUsage.length > 0) {
            this.requestUsagePieAnimation(modeUsage);
          }
        },
      );
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * 将当前展示数据写入缓存（按设备 + 报告日期隔离）
   */
  persistReportCache() {
    const deviceId = this.data.selectedDeviceId;
    if (!deviceId) return;
    try {
      wx.setStorageSync(this.reportCacheKey(deviceId), {
        cachedAt: Date.now(),
        trendBars: this.data.trendBars,
        modeUsage: this.data.modeUsage,
        usageActualDays: this.data.usageActualDays,
        durationMinutes: this.data.durationMinutes,
        summary: this.data.summary,
        hasSummaryContent: this.data.hasSummaryContent,
        hasReportActivity: this.data.hasReportActivity,
        feedback: this.data.feedback,
        reportGeneratedAt: this.data.reportGeneratedAt,
      } as ReportCache);
    } catch (error) {
      console.warn("[learning-data] 写入报告缓存失败", error);
    }
  },

  /**
   * 清理过期的报告缓存
   */
  cleanExpiredReportCache() {
    try {
      const info = wx.getStorageInfoSync();
      for (const key of info.keys) {
        if (!key.startsWith(REPORT_CACHE_PREFIX)) continue;
        const cache = wx.getStorageSync(key) as ReportCache | undefined;
        if (
          !cache?.cachedAt ||
          Date.now() - cache.cachedAt > REPORT_CACHE_TTL
        ) {
          wx.removeStorageSync(key);
        }
      }
    } catch (error) {
      // 忽略缓存清理失败
    }
  },

  reportCacheKey(deviceId: string): string {
    return `${REPORT_CACHE_PREFIX}_${deviceId}_${this.data.reportDate}`;
  },

  getDeviceName(device?: Device): string {
    if (!device) return "暂无设备";
    return (
      device.childProfile?.name ||
      device.childProfile?.englishName ||
      device.name
    );
  },

  async loadReportData() {
    const deviceId = this.data.selectedDeviceId;
    if (!deviceId) {
      this.setData({
        loadingDaily: false,
        loadingReport: false,
        loadingUsage: false,
      });
      return;
    }
    const requestId = ++this.reportRequestId;
    await Promise.all([
      this.loadDailyTrend(deviceId, requestId),
      this.loadParentReport(deviceId, requestId),
      this.loadUsageStats(deviceId, requestId),
    ]);
  },

  async loadDailyTrend(deviceId = "", requestId = 0) {
    deviceId = deviceId || this.data.selectedDeviceId;
    requestId = requestId || this.reportRequestId;
    if (!deviceId) return;
    this.setData({ loadingDaily: true, dailyError: false });
    try {
      const res = await getLearningStatsDaily(deviceId, 7, { scope: "all" });
      if (!this.isCurrentReportRequest(deviceId, requestId)) return;
      this.setData({ trendBars: this.buildTrendBars(res.data || []) });
      this.persistReportCache();
    } catch (error) {
      if (!this.isCurrentReportRequest(deviceId, requestId)) return;
      this.setData({ dailyError: true });
      wx.showToast({ title: "使用时长加载失败", icon: "none" });
    } finally {
      if (this.isCurrentReportRequest(deviceId, requestId)) {
        this.setData({ loadingDaily: false }, () => {
          // 饼图只依赖上方时长卡的布局稳定，见 requestUsagePieAnimation
          this.maybeFlushPendingPie();
        });
      }
    }
  },

  /**
   * 饼图上方布局稳定（时长卡加载结束）后，补画待渲染的饼图
   */
  maybeFlushPendingPie() {
    if (!this.data.loadingDaily && this.pendingPieItems) {
      this.requestUsagePieAnimation(this.pendingPieItems);
    }
  },

  isCurrentReportRequest(deviceId: string, requestId: number): boolean {
    return (
      deviceId === this.data.selectedDeviceId &&
      requestId === this.reportRequestId
    );
  },

  buildTrendBars(points: LearningStatsDailyPoint[]): TrendBar[] {
    const max = Math.max(
      0,
      ...points.map((point) => point.durationMinutes || 0),
    );
    return points.map((point) => {
      const value = point.durationMinutes || 0;
      return {
        label: point.date.slice(5).replace("-", "/"),
        value,
        height:
          value > 0 && max > 0
            ? Math.max(12, Math.round((value / max) * 180))
            : 4,
      };
    });
  },

  async loadParentReport(deviceId = "", requestId = 0) {
    deviceId = deviceId || this.data.selectedDeviceId;
    requestId = requestId || this.reportRequestId;
    if (!deviceId) return;
    this.setData({ loadingReport: true, reportError: false });
    try {
      const res = await getParentReport(deviceId, this.data.reportDate);
      if (!this.isCurrentReportRequest(deviceId, requestId)) return;

      const report = res.data;
      const summary = report.summary || null;
      const dailyModeCount = (report.modeUsage || []).reduce(
        (sum, item) => sum + item.count,
        0,
      );
      const durationMinutes = report.durationMinutes || 0;
      this.setData({
        durationMinutes,
        reportGeneratedAt: report.generatedAt
          ? formatDate(report.generatedAt, "YYYY-MM-DD HH:mm")
          : "",
        summary,
        hasSummaryContent: !!(
          summary?.expressionObservation ||
          summary?.emotionObservation ||
          summary?.thinkingObservation ||
          summary?.suggestion
        ),
        hasReportActivity: durationMinutes > 0 || dailyModeCount > 0,
        feedback: report.feedback,
      });
      this.persistReportCache();
    } catch (error) {
      if (!this.isCurrentReportRequest(deviceId, requestId)) return;
      this.setData({ reportError: true });
      wx.showToast({ title: "家长报告加载失败", icon: "none" });
    } finally {
      if (this.isCurrentReportRequest(deviceId, requestId)) {
        this.setData({ loadingReport: false });
      }
    }
  },

  async loadUsageStats(deviceId = "", requestId = 0) {
    deviceId = deviceId || this.data.selectedDeviceId;
    requestId = requestId || this.reportRequestId;
    if (!deviceId) return;
    this.setData({ loadingUsage: true, usageError: false });
    try {
      const res = await getLearningStatsModeUsage(deviceId, 7);
      if (!this.isCurrentReportRequest(deviceId, requestId)) return;

      const usage = res.data;
      const modeUsage = this.buildModeUsage(usage.modeUsage || []);
      this.setData(
        {
          modeUsage,
          usageActualDays: usage.actualDays || 0,
          usagePieVisible: modeUsage.length > 0 || this.pieSegments.length > 0,
          activeModeUsage: null,
        },
        () => this.requestUsagePieAnimation(modeUsage),
      );
      this.persistReportCache();
    } catch (error) {
      if (!this.isCurrentReportRequest(deviceId, requestId)) return;
      this.setData({ activeModeUsage: null, usageError: true });
      wx.showToast({ title: "功能使用数据加载失败", icon: "none" });
    } finally {
      if (this.isCurrentReportRequest(deviceId, requestId)) {
        this.setData({ loadingUsage: false });
      }
    }
  },

  getModeColorIndex(mode: string): number {
    if (this.modeColorIndexes[mode] !== undefined) {
      return this.modeColorIndexes[mode];
    }
    const colorIndex = this.nextModeColorIndex % MODE_COLORS.length;
    this.modeColorIndexes[mode] = colorIndex;
    this.nextModeColorIndex += 1;
    return colorIndex;
  },

  buildModeUsage(items: ParentReportModeUsage[]): ModeUsageView[] {
    const total = items.reduce((sum, item) => sum + item.count, 0);
    if (total <= 0) return [];
    const percentages = allocateIntegerPercentages(
      items.map((item) => item.count),
    );
    return items.map((item, index) => {
      const colorIndex = this.getModeColorIndex(item.mode);
      return {
        mode: item.mode,
        label: MODE_LABELS[item.mode] || item.mode,
        count: item.count,
        percent: percentages[index],
        color: MODE_COLORS[colorIndex],
        paintColor: CANVAS_MODE_COLORS[colorIndex],
      };
    });
  },

  prepareUsagePieCanvas(attempt = 0) {
    if (this.pieContext || typeof wx.createSelectorQuery !== "function") return;
    wx.createSelectorQuery()
      .in(this)
      .select("#usagePieCanvas")
      .fields({ node: true, size: true })
      .exec((result: any[]) => {
        const canvasInfo = result?.[0];
        if (!canvasInfo?.node) {
          // wx:if 刚展示原生 Canvas 时，节点可能晚于 setData 回调就绪。
          if (this.pendingPieItems && attempt < 3) {
            const animationId = this.pieAnimationId;
            setTimeout(() => {
              if (animationId === this.pieAnimationId && this.pendingPieItems) {
                this.prepareUsagePieCanvas(attempt + 1);
              }
            }, 50);
          }
          return;
        }
        const canvas = canvasInfo.node;
        const context = canvas.getContext("2d");
        const pixelRatio = wx.getWindowInfo().pixelRatio || 1;
        canvas.width = canvasInfo.width * pixelRatio;
        canvas.height = canvasInfo.height * pixelRatio;
        context.scale(pixelRatio, pixelRatio);
        this.pieCanvas = canvas;
        this.pieContext = context;
        this.pieSize = Math.min(canvasInfo.width, canvasInfo.height);

        if (this.pendingPieItems) {
          const items = this.pendingPieItems;
          const animationId = this.pieAnimationId;
          this.pendingPieItems = null;
          const drawFirstFrame = () => {
            if (animationId === this.pieAnimationId) {
              this.startUsagePieAnimation(items);
            }
          };
          if (typeof canvas.requestAnimationFrame === "function") {
            canvas.requestAnimationFrame(drawFirstFrame);
          } else {
            setTimeout(drawFirstFrame, 50);
          }
        }
      });
  },

  requestUsagePieAnimation(items: ModeUsageView[]) {
    this.pendingPieItems = items;
    // 只需等饼图上方的「每日使用时长」卡完成布局，避免原生 Canvas 图层错位；
    // 报告与总结卡位于饼图下方，不再阻塞渲染。
    if (this.data.loadingDaily) {
      return;
    }
    if (!this.pieContext) {
      this.prepareUsagePieCanvas();
      return;
    }
    this.pendingPieItems = null;
    this.startUsagePieAnimation(items);
  },

  startUsagePieAnimation(items: ModeUsageView[]) {
    const target = buildPieTarget(items, this.pieSegments);
    const from = this.pieSegments;
    const animationId = ++this.pieAnimationId;

    if (!this.pieHasRendered) {
      this.pieHasRendered = true;
      this.pieSegments = visiblePieSegments(target);
      this.drawUsagePie(this.pieSegments);
      return;
    }

    const startedAt = Date.now();
    const drawFrame = () => {
      if (animationId !== this.pieAnimationId) return;
      const progress = Math.min((Date.now() - startedAt) / 480, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      this.pieSegments = interpolatePieSegments(from, target, easedProgress);
      this.drawUsagePie(this.pieSegments);

      if (progress < 1) {
        if (this.pieCanvas?.requestAnimationFrame) {
          this.pieCanvas.requestAnimationFrame(drawFrame);
        } else {
          setTimeout(drawFrame, 16);
        }
        return;
      }

      this.pieSegments = visiblePieSegments(target);
      this.drawUsagePie(this.pieSegments);
      if (this.pieSegments.length === 0) {
        this.setData({ usagePieVisible: false });
        this.pieCanvas = null;
        this.pieContext = null;
      }
    };
    drawFrame();
  },

  drawUsagePie(segments: PieSegment[]) {
    const context = this.pieContext;
    const size = this.pieSize;
    if (!context || size <= 0) return;

    const center = size / 2;
    const toRadian = (angle: number) => ((angle - 90) * Math.PI) / 180;
    context.clearRect(0, 0, size, size);
    for (const segment of visiblePieSegments(segments)) {
      context.beginPath();
      context.moveTo(center, center);
      context.arc(
        center,
        center,
        center,
        toRadian(segment.startAngle),
        toRadian(segment.endAngle),
        false,
      );
      context.closePath();
      context.fillStyle = segment.color;
      context.fill();
    }

    if (this.data.activeModeUsage) {
      this.drawUsagePieTooltip(this.data.activeModeUsage);
    }
  },

  drawUsagePieTooltip(item: ModeUsageView) {
    const context = this.pieContext;
    const size = this.pieSize;
    if (!context || size <= 0) return;

    const fontSize = 10;
    const height = 26;
    const paddingX = 5;
    const gap = 3;
    const percent = `${item.percent}%`;
    context.font = `${fontSize}px sans-serif`;
    const percentWidth = context.measureText(percent).width;
    const maxLabelWidth = Math.max(
      0,
      size - 8 - paddingX * 2 - gap - percentWidth,
    );
    let label = item.label;
    while (
      label.length > 1 &&
      context.measureText(label).width > maxLabelWidth
    ) {
      label = label.slice(0, -1);
    }
    if (label !== item.label) {
      label = `${label.slice(0, -1)}…`;
    }

    const labelWidth = context.measureText(label).width;
    const width = Math.ceil(labelWidth + percentWidth + gap + paddingX * 2);
    const x = (size - width) / 2;
    const y = 4;
    const right = x + width;
    const bottom = y + height;
    const radius = 7;

    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(right - radius, y);
    context.quadraticCurveTo(right, y, right, y + radius);
    context.lineTo(right, bottom - radius);
    context.quadraticCurveTo(right, bottom, right - radius, bottom);
    context.lineTo(x + radius, bottom);
    context.quadraticCurveTo(x, bottom, x, bottom - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fillStyle = CANVAS_UI_COLORS.surface;
    context.fill();
    context.strokeStyle = CANVAS_UI_COLORS.primary;
    context.lineWidth = 1;
    context.stroke();

    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = CANVAS_UI_COLORS.text;
    context.fillText(label, x + paddingX, y + height / 2);
    context.font = `600 ${fontSize}px sans-serif`;
    context.fillStyle = CANVAS_UI_COLORS.primary;
    context.fillText(percent, x + paddingX + labelWidth + gap, y + height / 2);
  },

  findModeUsageAt(
    x: number,
    y: number,
    width: number,
    height: number,
  ): ModeUsageView | null {
    const items = this.data.modeUsage as ModeUsageView[];
    const total = items.reduce((sum, item) => sum + item.count, 0);
    const radius = Math.min(width, height) / 2;
    if (total <= 0 || radius <= 0) return null;

    const dx = x - width / 2;
    const dy = y - height / 2;
    if (Math.sqrt(dx * dx + dy * dy) > radius) return null;

    const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    const clockwiseAngle = (angle + 360) % 360;
    const segments = visiblePieSegments(this.pieSegments);
    if (segments.length > 0) {
      for (const segment of segments) {
        if (
          clockwiseAngle >= segment.startAngle &&
          clockwiseAngle < segment.endAngle
        ) {
          return items.find((item) => item.mode === segment.mode) || null;
        }
      }
      return null;
    }

    let endAngle = 0;
    for (const item of items) {
      if (item.count <= 0) continue;
      endAngle += (item.count / total) * 360;
      if (clockwiseAngle < endAngle) return item;
    }
    return items[items.length - 1] || null;
  },

  onUsagePieTap(event: WechatMiniprogram.TouchEvent) {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    wx.createSelectorQuery()
      .in(this)
      .select(".usage-pie")
      .boundingClientRect((rect: any) => {
        if (!rect) return;
        this.setData(
          {
            activeModeUsage: this.findModeUsageAt(
              touch.clientX - rect.left,
              touch.clientY - rect.top,
              rect.width,
              rect.height,
            ),
          },
          () => this.drawUsagePie(this.pieSegments),
        );
      })
      .exec();
  },

  onDismissUsageTooltip(event?: WechatMiniprogram.TouchEvent) {
    if (event?.target?.id === "usagePieCanvas") return;
    if (!this.data.activeModeUsage) return;
    this.setData({ activeModeUsage: null }, () =>
      this.drawUsagePie(this.pieSegments),
    );
  },

  onDeviceSwitch() {
    if (this.data.devices.length <= 1) return;
    this.setData({
      deviceDropdownVisible: !this.data.deviceDropdownVisible,
    });
  },

  onCloseDeviceDropdown() {
    this.setData({ deviceDropdownVisible: false });
  },

  async onSelectDeviceOption(event: WechatMiniprogram.TouchEvent) {
    const deviceId = String(event.currentTarget.dataset.id || "");
    this.setData({ deviceDropdownVisible: false });
    await this.selectDevice(deviceId);
  },

  async selectDevice(deviceId: string) {
    if (!deviceId || deviceId === this.data.selectedDeviceId) return;
    const device = this.data.devices.find((item) => item.id === deviceId);
    this.setData({
      selectedDeviceId: deviceId,
      selectedDeviceName: this.getDeviceName(device),
      activeModeUsage: null,
      summary: null,
      hasSummaryContent: false,
      hasReportActivity: false,
      feedback: null,
      dailyError: false,
      reportError: false,
      usageError: false,
      loadingDaily: true,
      loadingReport: true,
      loadingUsage: true,
    });
    // 切换设备时优先展示该设备的缓存数据
    this.restoreReportCache(deviceId);
    await this.loadReportData();
  },

  async onRetryDevices() {
    await this.initialize();
  },

  async onRetryDaily() {
    await this.loadDailyTrend();
  },

  async onRetryReport() {
    await this.loadParentReport();
  },

  async onRetryUsage() {
    await this.loadUsageStats();
  },

  onUsageHelp() {
    const reportGeneratedAt = this.data.reportGeneratedAt;
    wx.showModal({
      title: "功能使用情况",
      content: reportGeneratedAt
        ? `统计结果取自近 7 天内的数据。\n报告生成时间：${reportGeneratedAt}`
        : "统计结果取自近 7 天内的数据。\n暂未取得本次报告的生成时间，请稍后重试。",
      showCancel: false,
      confirmText: "确定",
    });
  },

  async onFeedback(event: WechatMiniprogram.TouchEvent) {
    if (
      this.data.feedbackSubmitting ||
      this.data.feedback ||
      !this.data.selectedDeviceId ||
      !this.data.hasSummaryContent
    ) {
      return;
    }
    const rawValue = event.currentTarget.dataset.useful;
    const useful = rawValue === true || rawValue === "true";
    this.setData({ feedbackSubmitting: true });
    try {
      const res = await submitParentReportFeedback({
        deviceId: this.data.selectedDeviceId,
        reportDate: this.data.reportDate,
        useful,
      });
      this.setData({ feedback: res.data.feedback });
      wx.showToast({ title: "感谢你的反馈", icon: "none" });
    } catch (error) {
      wx.showToast({ title: "反馈提交失败，请重试", icon: "none" });
    } finally {
      this.setData({ feedbackSubmitting: false });
    }
  },
});
