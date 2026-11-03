import {
  Device,
  ensureAuthToken,
  getDeviceList,
  updateDeviceOrder,
} from "../../api/api";

interface ChildListItem {
  deviceId: string;
  name: string;
  dragOffset?: number;
}

interface DragState {
  startY: number;
  index: number;
  targetIndex: number;
  slotHeight: number;
  originalChildren: ChildListItem[];
}

const CARD_SLOT_RPX = 176;

Page({
  data: {
    loading: true,
    loadError: false,
    saving: false,
    draggingIndex: -1,
    children: [] as ChildListItem[],
  },

  dragState: null as DragState | null,

  /** 首屏加载 promise（onReady 不能 return Promise，会破坏 Page 类型推断；测试用它 await） */
  initialLoad: null as Promise<void> | null,

  onLoad() {
    // 网络请求统一放到 onReady（首帧渲染完成后）启动
  },

  onReady() {
    this.initialLoad = this.loadChildren();
  },

  async loadChildren() {
    this.setData({ loading: true, loadError: false });
    try {
      await ensureAuthToken();
      const res = await getDeviceList();
      const children = (res.data || [])
        .filter((device: Device) => Boolean(device.id))
        .map((device: Device) => ({
          deviceId: device.id,
          name:
            device.childProfile?.name ||
            device.childProfile?.englishName ||
            device.name ||
            "未命名孩子",
          dragOffset: 0,
        }));
      this.setData({ children });
    } catch (error) {
      this.setData({ children: [], loadError: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  onChildTap(event: WechatMiniprogram.TouchEvent) {
    const deviceId = event.currentTarget.dataset.deviceId;
    if (!deviceId) return;
    wx.navigateTo({
      url: `/pages/child-info/child-info?deviceId=${encodeURIComponent(deviceId)}`,
    });
  },

  onDragStart(event: WechatMiniprogram.TouchEvent) {
    if (this.data.saving || this.data.children.length < 2) return;
    const index = Number(event.currentTarget.dataset.index);
    const touch = event.touches[0];
    if (!touch || !Number.isInteger(index)) return;
    const { windowWidth } = wx.getWindowInfo();
    const slotHeight = (CARD_SLOT_RPX * windowWidth) / 750;
    const originalChildren = this.data.children.map((item) => ({
      ...item,
      dragOffset: 0,
    }));
    this.dragState = {
      startY: touch.clientY,
      index,
      targetIndex: index,
      slotHeight,
      originalChildren,
    };
    this.setData({ draggingIndex: index, children: originalChildren });
  },

  onDragMove(event: WechatMiniprogram.TouchEvent) {
    const state = this.dragState;
    const touch = event.touches[0];
    if (!state || !touch) return;
    const lastIndex = state.originalChildren.length - 1;
    const rawOffset = touch.clientY - state.startY;
    const offset = Math.max(
      -state.index * state.slotHeight,
      Math.min((lastIndex - state.index) * state.slotHeight, rawOffset),
    );
    const targetIndex = Math.max(
      0,
      Math.min(lastIndex, state.index + Math.round(offset / state.slotHeight)),
    );
    state.targetIndex = targetIndex;
    const children = state.originalChildren.map((item, itemIndex) => {
      let dragOffset = 0;
      if (itemIndex === state.index) {
        dragOffset = offset;
      } else if (
        targetIndex > state.index &&
        itemIndex > state.index &&
        itemIndex <= targetIndex
      ) {
        dragOffset = -state.slotHeight;
      } else if (
        targetIndex < state.index &&
        itemIndex >= targetIndex &&
        itemIndex < state.index
      ) {
        dragOffset = state.slotHeight;
      }
      return { ...item, dragOffset };
    });
    this.setData({ children });
  },

  async onDragEnd() {
    const state = this.dragState;
    if (!state) return;
    this.dragState = null;
    this.setData({ draggingIndex: -1 });
    const previousChildren = state.originalChildren;
    if (state.targetIndex === state.index) {
      this.setData({ children: previousChildren });
      return;
    }

    const reordered = previousChildren.slice();
    const [moved] = reordered.splice(state.index, 1);
    reordered.splice(state.targetIndex, 0, moved);
    const optimisticChildren = reordered.map((item) => ({
      ...item,
      dragOffset: 0,
    }));
    this.setData({ children: optimisticChildren, saving: true });
    try {
      const res = await updateDeviceOrder(
        optimisticChildren.map((item) => item.deviceId),
      );
      const savedIds = res.data?.orderedDeviceIds || [];
      const byId = new Map(
        optimisticChildren.map((item) => [item.deviceId, item]),
      );
      const serverOrdered = savedIds.reduce<ChildListItem[]>(
        (items, deviceId) => {
          const item = byId.get(deviceId);
          if (item) items.push(item);
          return items;
        },
        [],
      );
      if (serverOrdered.length === optimisticChildren.length) {
        this.setData({ children: serverOrdered });
      }
    } catch (error) {
      this.setData({ children: previousChildren });
      wx.showToast({ title: "排序保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  onDragCancel() {
    if (!this.dragState) return;
    const originalChildren = this.dragState.originalChildren;
    this.dragState = null;
    this.setData({ draggingIndex: -1, children: originalChildren });
  },

  // 阻止排序手柄的 tap 冒泡成“进入孩子信息”。
  onDragHandleTap() {},
});
