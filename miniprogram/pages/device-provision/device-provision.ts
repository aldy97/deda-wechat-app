import {
  bindDevice,
  getProvisionCandidates,
  ProvisionCandidate,
} from "../../api/api";
import { isDevEnv } from "../../config/api.config";
import { BleProvisionClient, ScannedDevice } from "../../utils/ble-client";
import {
  CMD_STATUS,
  CMD_WIFI_LIST,
  createReceiver,
  describeStatus,
  isFinalStatus,
  makeConfigFrame,
  ProvisionMessage,
} from "../../utils/ble-protocol";
import { getCurrentWifi } from "../../utils/wifi-info";

/** 一次配网总超时（协议 5.4 建议值，客户端自定，非协议字段） */
const PROVISION_TIMEOUT_MS = 90000;
/** 扫描窗口 */
const SCAN_DURATION_MS = 10000;
/** 等待设备推送 WiFi 列表的上限（协议建议值 10 秒，客户端自定） */
const WIFI_LIST_TIMEOUT_MS = 10000;
/** 认领轮询间隔与次数上限：2s × 30 = 60s（覆盖设备连网→loginMac 时延） */
const CLAIM_POLL_INTERVAL_MS = 2000;
const CLAIM_POLL_MAX_ATTEMPTS = 30;

/** 设备 20 01 推送的周边 AP */
interface ScannedWifi {
  ssid: string;
  rssi: number | null;
}

interface VantFieldChangeEvent {
  detail: string;
}

/**
 * 设备配网页（BLE + 手机当前 WiFi + 认领绑定一体流程）。
 *
 * 步骤：1 准备 → 2 扫描选择设备 → 3 确认 WiFi 并输入密码 → 4 配网中 → 5 结果。
 * 成功判定（与机芯厂约定链路）：
 *   设备回 status=0 → 设备联网后自行调用服务端 loginMac 上线
 *   → 小程序轮询 GET /devices/provision-candidates 认领
 *   → 恰 1 台自动 POST /devices/bind；多台由用户选择；0 台超时明确失败。
 * BLE 阶段不获取 MAC（iOS 广播无 MAC）；设备身份以服务端上线登记为准。
 */
Page({
  data: {
    step: 1 as number,
    isDev: false,

    // 步骤 2：扫描
    scanning: false,
    devices: [] as Array<ScannedDevice & { rssiText: string }>,
    scanHint: "",

    // 步骤 3：WiFi 列表（设备 20 01 推送的周边 AP）
    connecting: false,
    connectError: "",
    /** 当前选中的（或手动输入的）SSID */
    ssid: "",
    wifiSecure: true,
    password: "",
    /** 手动输入模式（列表超时/空列表/用户主动选择手动时开启） */
    ssidEditable: false,
    /** 设备扫描到的周边 AP（按信号降序） */
    wifiList: [] as ScannedWifi[],
    /** 正在等待设备推送列表 */
    wifiListLoading: false,
    /** 手机当前连接的 WiFi（用于高亮/默认选中；读取失败为空串） */
    phoneSsid: "",
    phoneWifiSecure: true,

    // 步骤 4：配网中 / 认领中
    provisioning: false,
    provisionStatusText: "",

    // 步骤 5：结果（互斥：success / claimChoice / bindFailed / claimTimeout / 普通失败）
    success: false,
    alreadyBound: false,
    resultText: "",
    /** 多台候选设备时的选择列表 */
    claimChoice: false,
    claimCandidates: [] as ProvisionCandidate[],
    /** 绑定接口调用失败（已知 deviceId，可重试） */
    bindFailed: false,
    /** 认领超时：窗口内未检测到设备上线 */
    claimTimeout: false,
  },

  /** 非渲染态：BLE 客户端、接收器与计时器 */
  client: null as BleProvisionClient | null,
  receiver: null as ((chunk: ArrayLike<number>) => void) | null,
  /** 认领阶段锁定的设备 ID（单台自动或用户多选后），供绑定重试 */
  claimDeviceId: "",
  claimTimer: 0 as any,
  claimAttempts: 0,
  pollInFlight: false,
  scanStopper: null as (() => void) | null,
  scanTimer: 0 as any,
  wifiListTimer: 0 as any,
  provisionTimer: 0 as any,
  finished: false,

  onLoad() {
    this.setData({ isDev: isDevEnv() });
  },

  onUnload() {
    this.cleanupSession();
  },

  // ---------- 步骤 1 → 2：权限预检 + 扫描 ----------

  /** 位置权限：Android 扫 BLE 与双端读取当前 WiFi 的前置条件 */
  async ensureLocationPermission(): Promise<boolean> {
    try {
      const setting = await new Promise<any>((resolve, reject) => {
        wx.getSetting({ success: resolve, fail: reject });
      });
      if (setting.authSetting["scope.userLocation"]) return true;

      await new Promise<void>((resolve, reject) => {
        wx.authorize({
          scope: "scope.userLocation",
          success: () => resolve(),
          fail: reject,
        });
      });
      return true;
    } catch (e) {
      const modal = await new Promise<any>((resolve) => {
        wx.showModal({
          title: "需要位置权限",
          content: "搜索蓝牙设备和读取当前 WiFi 需要位置权限，请在设置中允许",
          confirmText: "去设置",
          success: resolve,
        });
      });
      if (modal.confirm) {
        await new Promise((resolve) => {
          wx.openSetting({ complete: resolve });
        });
        const after = await new Promise<any>((resolve, reject) => {
          wx.getSetting({ success: resolve, fail: reject });
        });
        return !!after.authSetting["scope.userLocation"];
      }
      return false;
    }
  },

  async onStartScan() {
    if (this.data.scanning) return;

    const permitted = await this.ensureLocationPermission();
    if (!permitted) {
      wx.showToast({ title: "未获得位置权限，无法配网", icon: "none" });
      return;
    }

    this.client = new BleProvisionClient();
    try {
      await this.client.init();
    } catch (e) {
      wx.showToast({
        title: e instanceof Error ? e.message : "蓝牙初始化失败",
        icon: "none",
      });
      return;
    }

    this.setData({
      step: 2,
      scanning: true,
      devices: [],
      scanHint: "正在搜索附近的设备…",
    });

    this.scanStopper = this.client.startScan((device) => {
      if (this.data.isDev) {
        console.log(
          `[provision] found ${device.localName || device.name} ` +
            `id=${device.deviceId} rssi=${device.rssi} adv=${device.advertisDataHex || "(空)"}`,
        );
      }
      const display = {
        ...device,
        rssiText: device.rssi === null ? "未知" : `${device.rssi} dBm`,
      };
      const devices = this.data.devices
        .concat([display])
        .sort((a, b) => (b.rssi ?? -100) - (a.rssi ?? -100));
      this.setData({ devices, scanHint: "" });
    });

    try {
      await this.client.startDiscovery();
    } catch (e) {
      this.setData({
        scanning: false,
        scanHint: e instanceof Error ? e.message : "扫描启动失败",
      });
      return;
    }

    this.scanTimer = setTimeout(() => {
      this.stopScan();
      if (this.data.devices.length === 0) {
        this.setData({
          scanHint: "未发现设备，请确认机芯已开机并靠近手机后重试",
        });
      }
    }, SCAN_DURATION_MS);
  },

  stopScan() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = 0;
    }
    if (this.scanStopper) {
      this.scanStopper();
      this.scanStopper = null;
    }
    if (this.data.scanning) this.setData({ scanning: false });
  },

  onRescan() {
    this.stopScan();
    this.onStartScan();
  },

  // ---------- 步骤 2 → 3：连接设备 + 读当前 WiFi ----------

  async onSelectDevice(event: WechatMiniprogram.TouchEvent) {
    if (this.data.connecting) return;
    const index = event.currentTarget.dataset.index as number;
    const device = this.data.devices[index];
    if (!device || !this.client) return;

    this.stopScan();
    this.setData({ connecting: true, connectError: "" });

    try {
      await this.client.connect(device.deviceId);
      if (this.data.isDev) console.log("[provision] BLE connected");

      // 订阅通知：先注册回调再开 Notify；此后才允许下发配网帧
      this.receiver = createReceiver(
        (msg) => this.handleMessage(msg),
        (err) => console.warn("[provision] receiver:", err),
      );
      const receiver = this.receiver;
      await this.client.enableNotify(
        (chunk) => receiver(chunk),
        () => this.handleUnexpectedDisconnect(),
      );
      if (this.data.isDev) console.log("[provision] notify enabled");

      // 进入 WiFi 步骤：设备在 CCC 写入后推送 20 01 列表（协议建议等 10 秒）
      this.setData({
        step: 3,
        ssid: "",
        ssidEditable: false,
        wifiList: [],
        wifiListLoading: true,
        phoneSsid: "",
      });
      this.wifiListTimer = setTimeout(() => {
        this.wifiListTimer = 0;
        // 列表超时：结束等待，用户可改手动输入（协议：超时后允许手动输入 SSID）
        if (this.data.step === 3 && this.data.wifiListLoading) {
          this.setData({ wifiListLoading: false });
        }
      }, WIFI_LIST_TIMEOUT_MS);

      // 并行读手机当前 WiFi：仅用于高亮/默认选中/提醒；失败不阻断（列表仍可手选）
      try {
        const wifi = await getCurrentWifi();
        if (this.data.isDev) {
          console.log(
            `[provision] current wifi: ${wifi.ssid} secure=${wifi.secure}`,
          );
        }
        this.setData({
          phoneSsid: wifi.ssid,
          phoneWifiSecure: wifi.secure,
        });
        this.maybeAutoSelect();
      } catch (wifiErr) {
        console.warn("[provision] getCurrentWifi failed:", wifiErr);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "连接设备失败";
      this.setData({ connectError: message });
      await this.cleanupSession();
      this.client = new BleProvisionClient();
    } finally {
      this.setData({ connecting: false });
    }
  },

  // ---------- 步骤 3 → 4：下发配网 ----------

  onSsidChange(event: VantFieldChangeEvent) {
    this.setData({ ssid: event.detail });
  },

  /**
   * 手机当前 WiFi 出现在设备列表中时默认选中。
   * 列表帧与 getCurrentWifi 是两条异步来源，谁后到一起触发。
   */
  maybeAutoSelect() {
    const { step, ssid, phoneSsid, wifiList } = this.data;
    if (step !== 3 || ssid || !phoneSsid) return;
    if (!wifiList.some((it) => it.ssid === phoneSsid)) return;
    this.setData({ ssid: phoneSsid, wifiSecure: this.data.phoneWifiSecure });
  },

  /** 用户从设备列表中选择一个 WiFi */
  onSelectWifi(event: WechatMiniprogram.TouchEvent) {
    const ssid = event.currentTarget.dataset.ssid as string;
    if (!ssid) return;
    // 设备列表不带加密标记：选中手机当前网络时沿用手机上报的 secure，
    // 其余一律按加密网络处理（密码必填）
    const secure =
      ssid === this.data.phoneSsid ? this.data.phoneWifiSecure : true;
    this.setData({ ssid, wifiSecure: secure, ssidEditable: false });
  },

  /** 手动输入入口（列表超时/空列表/目标不在列表中） */
  onEnableManualInput() {
    this.setData({ ssidEditable: true, ssid: "", wifiSecure: true });
  },

  onPasswordChange(event: VantFieldChangeEvent) {
    this.setData({ password: event.detail });
  },

  async onSubmitProvision() {
    if (this.data.provisioning || this.data.connecting) return;
    if (!this.client || !this.receiver) {
      wx.showToast({ title: "连接已失效，请重新扫描", icon: "none" });
      this.setData({ step: 1 });
      return;
    }
    if (!this.data.ssid) {
      wx.showToast({
        title: this.data.ssidEditable
          ? "请输入手机当前连接的 WiFi 名称"
          : "请先选择 WiFi",
        icon: "none",
      });
      return;
    }
    if (this.data.wifiSecure && !this.data.password) {
      wx.showToast({ title: "请输入 WiFi 密码", icon: "none" });
      return;
    }

    let frame: Uint8Array;
    try {
      frame = makeConfigFrame(this.data.ssid, this.data.password);
    } catch (e) {
      wx.showToast({
        title: e instanceof Error ? e.message : "WiFi 信息不合法",
        icon: "none",
      });
      return;
    }

    this.finished = false;
    this.setData({
      step: 4,
      provisioning: true,
      provisionStatusText: "正在下发配网信息…",
    });

    try {
      await this.client.sendFrame(frame);
    } catch (e) {
      // 无逐片 ACK：任何一包失败都按整体失败处理，提示重试（协议 5.1）
      this.finishWithError("配网信息发送失败，请返回重新扫描并重试");
      return;
    }

    this.setData({ provisionStatusText: "等待设备联网…" });
    this.provisionTimer = setTimeout(() => {
      // 超时只判「未获得最终结果」，绝不误报成功（协议 5.4）
      this.finishWithError("配网超时，请检查路由器后重试");
    }, PROVISION_TIMEOUT_MS);
  },

  // ---------- 协议消息与终态 ----------

  handleMessage(msg: ProvisionMessage) {
    if (msg.t1 === CMD_WIFI_LIST[0] && msg.t2 === CMD_WIFI_LIST[1]) {
      // 设备推送的周边 AP 列表（协议 4.1：{"wifiList":[{ssid,rssi}]}；
      // 设备端已过滤 rssi<-70；可能重复推送，收到即更新）
      const raw = Array.isArray(msg.data?.wifiList) ? msg.data.wifiList : [];
      const wifiList: ScannedWifi[] = raw
        .filter((it: any) => typeof it?.ssid === "string" && it.ssid.length > 0)
        .map((it: any) => ({
          ssid: it.ssid as string,
          rssi: typeof it?.rssi === "number" ? it.rssi : null,
        }))
        .sort(
          (a: ScannedWifi, b: ScannedWifi) =>
            (b.rssi ?? -100) - (a.rssi ?? -100),
        );
      if (this.data.isDev) {
        console.log(`[provision] wifiList: ${wifiList.length} 个 AP`);
      }
      if (this.wifiListTimer) {
        clearTimeout(this.wifiListTimer);
        this.wifiListTimer = 0;
      }
      this.setData({ wifiList, wifiListLoading: false });
      this.maybeAutoSelect();
      return;
    }
    if (msg.t1 !== CMD_STATUS[0] || msg.t2 !== CMD_STATUS[1]) return;

    // dev：打印状态帧原文，确认真机行为
    if (this.data.isDev) {
      console.log("[provision] status frame raw:", JSON.stringify(msg.data));
    }

    const status = msg.data?.status;
    if (typeof status !== "number") {
      console.warn("[provision] status 非数值：", JSON.stringify(msg.data));
      return;
    }
    if (status === 1) {
      this.setData({ provisionStatusText: describeStatus(1) });
      return;
    }
    if (isFinalStatus(status)) {
      return this.finishConfig(status);
    }
    return undefined;
  },

  async finishConfig(status: number) {
    if (this.finished) return;
    this.finished = true;
    if (this.provisionTimer) {
      clearTimeout(this.provisionTimer);
      this.provisionTimer = 0;
    }

    if (status !== 0) {
      this.setData({
        step: 5,
        provisioning: false,
        success: false,
        resultText: describeStatus(status),
      });
      return;
    }

    // status=0 仅代表设备连上路由器；设备随后自行 loginMac 上线，
    // 小程序轮询认领接口完成绑定（成功判定 = status=0 + 绑定成功）。
    // 认领是流程延续而非终态：重置 finished，由认领各终态自行置位。
    this.finished = false;
    this.startClaimPolling();
  },

  // ---------- 认领轮询与绑定 ----------

  startClaimPolling() {
    this.claimAttempts = 0;
    this.pollInFlight = false;
    this.setData({ provisionStatusText: "设备已联网，正在完成绑定…" });
    void this.pollClaim();
    this.claimTimer = setInterval(
      () => void this.pollClaim(),
      CLAIM_POLL_INTERVAL_MS,
    );
  },

  stopClaimPolling() {
    if (this.claimTimer) {
      clearInterval(this.claimTimer);
      this.claimTimer = 0;
    }
  },

  async pollClaim() {
    if (this.finished) return;
    if (this.pollInFlight) return;
    this.pollInFlight = true;
    this.claimAttempts += 1;
    try {
      const res = await getProvisionCandidates();
      if (this.finished) return;
      const list = res.data.devices;
      if (list.length === 1) {
        await this.claimBind(list[0].deviceId);
      } else if (list.length > 1) {
        // 多设备同时配网：必须用户选择，禁止自动绑定
        this.stopClaimPolling();
        this.finished = true;
        this.setData({
          step: 5,
          provisioning: false,
          claimChoice: true,
          claimCandidates: list,
        });
      } else if (this.claimAttempts >= CLAIM_POLL_MAX_ATTEMPTS) {
        this.finishClaimTimeout();
      }
    } catch (e) {
      // 网络抖动不计失败，持续至总超时
      if (this.claimAttempts >= CLAIM_POLL_MAX_ATTEMPTS) {
        this.finishClaimTimeout();
      }
    } finally {
      this.pollInFlight = false;
    }
  },

  /** 认领超时：明确失败，绝不误报成功；可重试检测或返回 */
  finishClaimTimeout() {
    this.stopClaimPolling();
    this.finished = true;
    this.setData({
      step: 5,
      provisioning: false,
      claimTimeout: true,
      resultText: "未检测到设备上线，请重启机芯后重新配网",
    });
  },

  /** 用户在多台候选中选择一台 */
  async onSelectCandidate(event: WechatMiniprogram.TouchEvent) {
    if (this.data.provisioning) return;
    const deviceId = event.currentTarget.dataset.deviceId as string;
    if (!deviceId) return;
    this.finished = false;
    this.setData({
      step: 4,
      provisioning: true,
      claimChoice: false,
      provisionStatusText: "正在绑定设备…",
    });
    await this.claimBind(deviceId);
  },

  async claimBind(deviceId: string): Promise<boolean> {
    this.claimDeviceId = deviceId;
    this.stopClaimPolling();
    try {
      const res = await bindDevice({ deviceId });
      try {
        wx.removeStorageSync("device_list_cache");
      } catch (e) {
        // ignore
      }
      // 首次与再次绑定统一停在成功页；由「下一步」进入
      // 孩子信息 → 哄睡设置 的引导流程，流程结束回我的设备列表。
      this.finished = true;
      this.setData({
        step: 5,
        provisioning: false,
        success: true,
        alreadyBound: !!res.data.alreadyBound,
        bindFailed: false,
        claimTimeout: false,
        resultText: res.data.alreadyBound
          ? "该设备此前已绑定过，历史数据已恢复"
          : "配网成功，设备已绑定",
      });
      return true;
    } catch (e) {
      this.finished = true;
      this.setData({
        step: 5,
        provisioning: false,
        bindFailed: true,
        resultText: "设备已联网，但绑定失败，请重试",
      });
      return false;
    }
  },

  /** 成功页「下一步」：进入孩子信息 → 哄睡设置的绑定引导流程 */
  onContinueSetup() {
    const deviceId = this.claimDeviceId;
    if (!deviceId) return;
    wx.redirectTo({
      url: `/pages/owner-info/owner-info?id=${encodeURIComponent(deviceId)}&from=bind`,
    });
  },

  /** 绑定失败重试（deviceId 已知，无需重新配网/轮询） */
  async onRetryBind() {
    if (this.data.provisioning || !this.claimDeviceId) return;
    this.finished = false;
    this.setData({
      provisioning: true,
      bindFailed: false,
      resultText: "正在重新绑定…",
    });
    await this.claimBind(this.claimDeviceId);
  },

  /** 认领超时后重试检测：设备可能仍在窗口期，也可能需要重新配网触发上线 */
  onRetryClaim() {
    this.finished = false;
    this.setData({
      step: 4,
      provisioning: true,
      claimTimeout: false,
      resultText: "",
    });
    this.startClaimPolling();
  },

  // ---------- 收尾 ----------

  handleUnexpectedDisconnect() {
    console.warn("[provision] BLE disconnected unexpectedly");
    if (this.finished || !this.data.provisioning || this.claimTimer) return;
    // 真机实测：固件连上 WiFi 后立即断开 BLE 退出配网态，不回 status=0 帧。
    // 配网帧已下发后的断开不判失败，直接转认领轮询——
    // 设备是否真上线以 loginMac + provision-candidates 为准（60s 轮询兜底）。
    if (this.provisionTimer) {
      clearTimeout(this.provisionTimer);
      this.provisionTimer = 0;
    }
    this.setData({ provisionStatusText: "设备已断开蓝牙，正在确认联网结果…" });
    this.startClaimPolling();
  },

  finishWithError(message: string) {
    if (this.finished) return;
    this.finished = true;
    this.stopClaimPolling();
    if (this.provisionTimer) {
      clearTimeout(this.provisionTimer);
      this.provisionTimer = 0;
    }
    this.setData({
      step: 5,
      provisioning: false,
      success: false,
      resultText: message,
    });
  },

  /** 失败后回到步骤 1 重新来过（重连需全新会话：新 client / 新 receiver） */
  async onRestart() {
    await this.cleanupSession();
    this.setData({
      step: 1,
      devices: [],
      scanHint: "",
      connectError: "",
      ssid: "",
      ssidEditable: false,
      wifiList: [],
      wifiListLoading: false,
      phoneSsid: "",
      password: "",
      success: false,
      alreadyBound: false,
      claimChoice: false,
      claimCandidates: [],
      bindFailed: false,
      claimTimeout: false,
      resultText: "",
    });
  },

  async cleanupSession() {
    this.stopScan();
    this.stopClaimPolling();
    if (this.provisionTimer) {
      clearTimeout(this.provisionTimer);
      this.provisionTimer = 0;
    }
    if (this.wifiListTimer) {
      clearTimeout(this.wifiListTimer);
      this.wifiListTimer = 0;
    }
    this.receiver = null;
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  },
});
