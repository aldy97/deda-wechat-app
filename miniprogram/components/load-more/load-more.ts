const MIN_LOADING_MS = 400;

Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    loading: {
      type: Boolean,
      value: false,
    },
    hasMore: {
      type: Boolean,
      value: true,
    },
    loadingText: {
      type: String,
      value: "加载中...",
    },
    loadMoreText: {
      type: String,
      value: "加载更多",
    },
    noMoreText: {
      type: String,
      value: "没有更多了",
    },
  },
  data: {
    internalLoading: false,
  },
  observers: {
    loading: function (loading: boolean) {
      if (loading) {
        this.enterLoading();
      } else {
        this.tryExitLoading();
      }
    },
  },
  lifetimes: {
    detached() {
      this.clearLoadingTimer();
    },
  },
  methods: {
    onTap() {
      if (this.data.internalLoading || !this.data.hasMore) {
        return;
      }
      this.triggerEvent("loadmore");
    },

    enterLoading() {
      const self = this as any;
      self.clearLoadingTimer();
      self.setData({ internalLoading: true });
      self.loadingStartAt = Date.now();
      self.loadingTimer = setTimeout(() => {
        self.loadingTimer = null;
        if (!self.data.loading) {
          self.setData({ internalLoading: false });
        }
      }, MIN_LOADING_MS);
    },

    tryExitLoading() {
      const self = this as any;
      if (!self.data.internalLoading) return;

      const elapsed = Date.now() - (self.loadingStartAt || 0);
      if (elapsed >= MIN_LOADING_MS) {
        self.clearLoadingTimer();
        self.setData({ internalLoading: false });
      }
      // 否则等待定时器到期后自动退出
    },

    clearLoadingTimer() {
      const self = this as any;
      if (self.loadingTimer) {
        clearTimeout(self.loadingTimer);
        self.loadingTimer = null;
      }
    },
  },
});
