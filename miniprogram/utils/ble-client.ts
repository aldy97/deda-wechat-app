/**
 * 微信 BLE 配网封装（百度公版协议接入层）。
 *
 * 职责：蓝牙初始化 → 扫描 → 连接 → 大写 UUID 服务/特征值发现 →
 * 先注册通知回调再开 Notify → 20 字节分包写入 → 断开清理。
 *
 * 关键约定（协议 2/5 节与微信平台差异）：
 * - AE81 是 writeNoResponse，写入必须带 writeType: "writeNoResponse"；
 * - iOS 只认大写 UUID，且服务/特征值发现两步不可省略（Android 同样需要以兼容）；
 * - 无逐片 ACK：一包的成功回调仅代表写入链路成功，不代表设备已解析；
 * - 中途失败/断开 → 上层负责重连并整帧重发，不做断点续传。
 */

import { BLE_CHUNK_SIZE } from "./ble-protocol";

/** 广播包字节转十六进制串（扫描日志用） */
function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}

/** 配网服务与特征值（协议 2.1，比较时统一大写） */
export const PROVISION_SERVICE_UUID = "0000AE80-0000-1000-8000-00805F9B34FB";
export const PROVISION_WRITE_UUID = "0000AE81-0000-1000-8000-00805F9B34FB";
export const PROVISION_NOTIFY_UUID = "0000AE82-0000-1000-8000-00805F9B34FB";

/** 广播名筛选前缀（协议 2.2：公版按名称包含 JL 筛选，最终以 AE80 服务核对为准） */
const BROADCAST_NAME_KEYWORD = "JL";

/** 扫描结果（advertisDataHex 用于真机诊断 MAC 位置） */
export interface ScannedDevice {
  deviceId: string;
  name: string;
  localName: string;
  /** dBm；iOS 以 127 表示「无信号值」，归一为 null */
  rssi: number | null;
  advertisDataHex: string;
}

/** 从 unknown 错误对象上读一个字段 */
function readErrorField(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? (source as Record<string, unknown>)[key]
    : undefined;
}

interface WxCallback<T> {
  success: (res: T) => void;
  fail: (err: unknown) => void;
}

/**
 * wx 回调风格 API → Promise。
 *
 * 调用方把「带字段的参数 + 回调」一起传给 wx API：
 *   callWx<Result>((cb) => wx.getBLEDeviceServices({ deviceId, ...cb }))
 * 这样字段类型仍由微信 typings 校验，不需要把 option 声明成 any。
 */
function callWx<T = unknown>(
  run: (callback: WxCallback<T>) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    run({ success: resolve, fail: reject });
  });
}

/** wx BLE 错误码 → 用户可读文案 */
export function describeBleError(err: unknown): string {
  const rawCode = readErrorField(err, "errCode");
  const code = typeof rawCode === "number" ? rawCode : undefined;
  const rawMsg = readErrorField(err, "errMsg");
  switch (code) {
    case 10000:
      return "蓝牙未初始化，请重试";
    case 10001:
      return "手机蓝牙未开启，请开启后重试";
    case 10002:
      return "没有找到指定设备，请靠近设备后重试";
    case 10003:
      return "连接设备失败，请重试";
    case 10004:
      return "设备缺少配网服务，请确认设备处于配网状态";
    case 10005:
      return "设备缺少配网通道，请确认设备处于配网状态";
    case 10006:
      return "蓝牙连接已断开，请重试";
    case 10008:
      return "系统蓝牙异常，请重启蓝牙后重试";
    case 10012:
      return "蓝牙操作超时，请重试";
    default:
      return typeof rawMsg === "string" && rawMsg
        ? rawMsg
        : "蓝牙操作失败，请重试";
  }
}

export class BleProvisionClient {
  private deviceId = "";
  private serviceId = "";
  private writeCharId = "";
  private notifyCharId = "";
  private notifyListener:
    | ((
        res: WechatMiniprogram.OnBLECharacteristicValueChangeListenerResult,
      ) => void)
    | null = null;
  private disconnectListener:
    | ((
        res: WechatMiniprogram.OnBLEConnectionStateChangeListenerResult,
      ) => void)
    | null = null;
  private scanListener:
    | ((res: WechatMiniprogram.OnBluetoothDeviceFoundListenerResult) => void)
    | null = null;

  /** 初始化蓝牙适配器 */
  async init(): Promise<void> {
    try {
      await callWx((cb) => wx.openBluetoothAdapter(cb));
    } catch (err) {
      throw new Error(describeBleError(err));
    }
  }

  /**
   * 扫描附近处于配网态的设备（名称包含 JL）。
   * @param onDevice 每发现一台（按 deviceId 去重）回调一次
   * @returns 停止扫描的函数（同时注销监听）
   */
  startScan(onDevice: (device: ScannedDevice) => void): () => void {
    const seen = new Set<string>();
    this.scanListener = (res) => {
      for (const d of res.devices || []) {
        const label = `${d.localName || ""}${d.name || ""}`;
        if (!label.toUpperCase().includes(BROADCAST_NAME_KEYWORD)) continue;
        if (seen.has(d.deviceId)) continue;
        seen.add(d.deviceId);
        onDevice({
          deviceId: d.deviceId,
          name: d.name || "",
          localName: d.localName || "",
          // iOS 无信号值时上报 127，归一为 null 避免误导
          rssi: typeof d.RSSI === "number" && d.RSSI !== 127 ? d.RSSI : null,
          advertisDataHex: d.advertisData ? bytesToHex(d.advertisData) : "",
        });
      }
    };
    wx.onBluetoothDeviceFound(this.scanListener);

    return () => this.stopScan();
  }

  async startDiscovery(): Promise<void> {
    try {
      await callWx((cb) =>
        wx.startBluetoothDevicesDiscovery({ allowDuplicatesKey: false, ...cb }),
      );
    } catch (err) {
      throw new Error(describeBleError(err));
    }
  }

  stopScan(): void {
    if (this.scanListener) {
      // 该 API 不支持定向移除（签名无参），本类只注册一个监听，等价
      wx.offBluetoothDeviceFound();
      this.scanListener = null;
    }
    wx.stopBluetoothDevicesDiscovery({ complete: () => {} });
  }

  /**
   * 连接设备并完成服务/特征值发现。
   * 校验 AE80 服务、AE81 writeNoResponse、AE82 notify 属性（协议 2.1）。
   */
  async connect(deviceId: string): Promise<void> {
    this.stopScan();
    this.deviceId = deviceId;
    try {
      await callWx((cb) =>
        wx.createBLEConnection({ deviceId, timeout: 10000, ...cb }),
      );
    } catch (err) {
      throw new Error(describeBleError(err));
    }

    try {
      const servicesRes =
        await callWx<WechatMiniprogram.GetBLEDeviceServicesSuccessCallbackResult>(
          (cb) => wx.getBLEDeviceServices({ deviceId, ...cb }),
        );
      const service = (servicesRes.services || []).find(
        (s) => s.uuid.toUpperCase() === PROVISION_SERVICE_UUID,
      );
      if (!service) {
        throw new Error("未找到配网服务（AE80），该设备可能不是配网状态");
      }
      this.serviceId = service.uuid;

      const charsRes =
        await callWx<WechatMiniprogram.GetBLEDeviceCharacteristicsSuccessCallbackResult>(
          (cb) =>
            wx.getBLEDeviceCharacteristics({
              deviceId,
              serviceId: this.serviceId,
              ...cb,
            }),
        );
      const chars = charsRes.characteristics || [];
      const writeChar = chars.find(
        (c) => c.uuid.toUpperCase() === PROVISION_WRITE_UUID,
      );
      const notifyChar = chars.find(
        (c) => c.uuid.toUpperCase() === PROVISION_NOTIFY_UUID,
      );
      // 协议要求 writeNoResponse；只检查 properties.write 会在真机上写不进
      if (!writeChar || !writeChar.properties?.writeNoResponse) {
        throw new Error("设备配网写入通道不可用（需要 writeNoResponse）");
      }
      if (!notifyChar || !notifyChar.properties?.notify) {
        throw new Error("设备配网通知通道不可用（需要 notify）");
      }
      this.writeCharId = writeChar.uuid;
      this.notifyCharId = notifyChar.uuid;
    } catch (err) {
      await this.disconnect();
      throw err instanceof Error ? err : new Error(describeBleError(err));
    }
  }

  /**
   * 订阅设备通知。必须先调用本方法注册回调并开启 Notify，
   * 成功后才允许下发配网帧（协议 2.2 第 5/6 步）。
   * @param onChunk 每次通知的原始字节回调（交给 createReceiver 组帧）
   * @param onDisconnect 意外断开回调
   */
  async enableNotify(
    onChunk: (chunk: Uint8Array) => void,
    onDisconnect: () => void,
  ): Promise<void> {
    const { deviceId, serviceId, notifyCharId } = this;
    this.notifyListener = (res) => {
      if (
        res.deviceId !== deviceId ||
        res.serviceId?.toUpperCase() !== serviceId.toUpperCase() ||
        res.characteristicId?.toUpperCase() !== notifyCharId.toUpperCase()
      ) {
        return;
      }
      onChunk(new Uint8Array(res.value));
    };
    this.disconnectListener = (res) => {
      if (res.deviceId === deviceId && !res.connected) onDisconnect();
    };
    // 顺序固定：先注册回调，再开启 Notify
    wx.onBLECharacteristicValueChange(this.notifyListener);
    wx.onBLEConnectionStateChange(this.disconnectListener);

    try {
      await callWx((cb) =>
        wx.notifyBLECharacteristicValueChange({
          deviceId,
          serviceId,
          characteristicId: notifyCharId,
          state: true,
          ...cb,
        }),
      );
    } catch (err) {
      throw new Error(describeBleError(err));
    }
  }

  /**
   * 整帧分包下发：按 20 字节顺序写入，上一包成功回调后再写下一包（协议 5.1）。
   * 任何一包失败即抛错，由上层断连重发整帧。
   */
  async sendFrame(frame: Uint8Array): Promise<void> {
    for (let offset = 0; offset < frame.length; offset += BLE_CHUNK_SIZE) {
      const chunk = frame.slice(offset, offset + BLE_CHUNK_SIZE);
      try {
        await callWx((cb) =>
          wx.writeBLECharacteristicValue({
            deviceId: this.deviceId,
            serviceId: this.serviceId,
            characteristicId: this.writeCharId,
            writeType: "writeNoResponse",
            // slice 会分配独立 ArrayBuffer；Uint8Array.buffer 的静态类型是
            // ArrayBufferLike，这里收窄到 wx 接口要求的 ArrayBuffer
            value: chunk.buffer as ArrayBuffer,
            ...cb,
          }),
        );
      } catch (err) {
        throw new Error(describeBleError(err));
      }
    }
  }

  /** 断开连接并注销全部监听（页面退出 / 重试前必须调用） */
  async disconnect(): Promise<void> {
    this.stopScan();
    if (this.notifyListener) {
      // 该 API 签名无参（移除全部监听）；本类只注册一个
      wx.offBLECharacteristicValueChange();
      this.notifyListener = null;
    }
    if (this.disconnectListener) {
      wx.offBLEConnectionStateChange(this.disconnectListener);
      this.disconnectListener = null;
    }
    if (this.deviceId) {
      try {
        await callWx((cb) =>
          wx.closeBLEConnection({ deviceId: this.deviceId, ...cb }),
        );
      } catch (err) {
        // 已断开时忽略
      }
    }
  }
}
