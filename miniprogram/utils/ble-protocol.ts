/**
 * 百度公版 BLE 配网协议（《BLE配网协议_百度公版.docx》）纯函数实现。
 * 不依赖 wx，可完整单测。
 *
 * 帧结构（偏移从 0 开始）：
 *   0~1   帧头 4A 4C（ASCII "JL"）
 *   2~3   长度 L（大端，仅含命令 2 字节 + JSON N 字节，L = N + 2）
 *   4~5   命令 T1 T2
 *   6~L+3 JSON（UTF-8，无 NUL 结束符）
 *   L+4~L+5 CRC16（大端，CRC-16/XMODEM：poly 0x1021、init 0x0000、不反射、xorout 0）
 *   L+6   帧尾 FF
 * 完整帧长 = L + 7 = N + 9。
 *
 * CRC 范围存在命令差异（协议 3.2，最易踩坑）：
 *   - 10 01 / 10 02：frame[2 : L+4]（含长度字段）
 *   - 20 01 Wi-Fi 列表：frame[4 : L+4]（不含长度字段）
 */

/** 帧头 / 帧尾 */
export const FRAME_HEADER: readonly number[] = [0x4a, 0x4c];
export const FRAME_TAIL = 0xff;

/** 命令字 */
export const CMD_SET_WIFI: readonly [number, number] = [0x10, 0x01];
export const CMD_STATUS: readonly [number, number] = [0x10, 0x02];
export const CMD_WIFI_LIST: readonly [number, number] = [0x20, 0x01];

/** 字段字节上限（UTF-8 编码后） */
export const MAX_SSID_BYTES = 32;
export const MAX_PASS_BYTES = 64;
/** 配网下发 JSON 总字节上限（L < 120） */
export const MAX_JSON_BYTES = 117;

/** 接收缓存与单帧上限（协议 7 节示例客户端取值） */
const MAX_CACHE_BYTES = 8192;
const MAX_FRAME_BYTES = 4096;

/** BLE 单包写入上限（分片大小） */
export const BLE_CHUNK_SIZE = 20;

/**
 * 字符串 → UTF-8 字节。非法代理字符会抛异常（encodeURIComponent），
 * 调用方应提示用户修正输入。
 */
export function toUtf8(text: string): Uint8Array {
  const raw = unescape(encodeURIComponent(text));
  return Uint8Array.from(raw, (value) => value.charCodeAt(0));
}

/** UTF-8 字节 → 字符串 */
export function fromUtf8(bytes: ArrayLike<number>): string {
  const raw = Array.from(bytes as ArrayLike<number>, (value) =>
    String.fromCharCode(value),
  ).join("");
  return decodeURIComponent(escape(raw));
}

/** CRC-16/XMODEM。检验值：crc16(toUtf8("123456789")) === 0x31c3 */
export function crc16(bytes: ArrayLike<number>): number {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
    }
  }
  return crc;
}

/**
 * 校验字段并生成完整配网帧（10 01）。
 * 校验失败抛 Error，调用方负责前端拦截提示；不 trim / 不改写用户输入。
 */
export function makeConfigFrame(ssid: string, pass: string): Uint8Array {
  if (
    typeof ssid !== "string" ||
    ssid.length === 0 ||
    typeof pass !== "string"
  ) {
    throw new Error("字段类型或 SSID 错误");
  }
  if (
    toUtf8(ssid).length > MAX_SSID_BYTES ||
    toUtf8(pass).length > MAX_PASS_BYTES
  ) {
    throw new Error("SSID 或密码字节数超限");
  }
  const payload = Array.from(toUtf8(JSON.stringify({ ssid, pass })));
  const length = payload.length + 2;
  if (payload.length > MAX_JSON_BYTES) {
    throw new Error("WiFi 名称和密码总长度超限");
  }
  const body = [
    length >> 8,
    length & 255,
    CMD_SET_WIFI[0],
    CMD_SET_WIFI[1],
  ].concat(payload);
  const crc = crc16(body);
  return Uint8Array.from(
    [FRAME_HEADER[0], FRAME_HEADER[1]].concat(body, [
      crc >> 8,
      crc & 255,
      FRAME_TAIL,
    ]),
  );
}

/** 解析出的上行消息 */
export interface ProvisionMessage {
  t1: number;
  t2: number;
  /** JSON 负载，由消费方按 t1/t2 窄化 */
  data: unknown;
}

/**
 * 为一条 BLE 连接建立独立的通知解析器（字节流组帧）。
 *
 * 规则（协议 5.2）：
 *   追加数据 → 对齐 4A 4C → 读长度 → 等满 L+7 → 校验帧尾与 CRC → 解析 JSON。
 *   一次通知可能含多帧，循环取出；重连时必须新建实例（不复用旧缓存）。
 *
 * @param onMessage 仅回调 20 01 / 10 02；其他命令报 onError
 * @param onError   本地校验/解码失败（与设备 status=2 无关，不要当成设备状态）
 * @returns receive(chunk)，chunk 为一次 Notify 的原始字节
 */
export function createReceiver(
  onMessage: (msg: ProvisionMessage) => void,
  onError: (message: string) => void,
): (chunk: ArrayLike<number>) => void {
  let cache: number[] = [];

  return function receive(chunk: ArrayLike<number>): void {
    for (let i = 0; i < chunk.length; i++) cache.push(chunk[i]);

    if (cache.length > MAX_CACHE_BYTES) {
      cache = [];
      onError("接收缓存超限");
      return;
    }

    while (cache.length >= 2) {
      if (cache[0] !== FRAME_HEADER[0] || cache[1] !== FRAME_HEADER[1]) {
        cache.shift();
        continue;
      }
      if (cache.length < 6) return;

      const length = cache[2] * 256 + cache[3];
      if (length < 2 || length + 7 > MAX_FRAME_BYTES) {
        cache.shift();
        onError("长度异常");
        continue;
      }

      const total = length + 7;
      if (cache.length < total) return;

      const packet = cache.slice(0, total);
      const t1 = packet[4];
      const t2 = packet[5];
      const isList = t1 === CMD_WIFI_LIST[0] && t2 === CMD_WIFI_LIST[1];
      const isStatus = t1 === CMD_STATUS[0] && t2 === CMD_STATUS[1];
      if (!isList && !isStatus) {
        cache.splice(0, total);
        onError("未支持的命令");
        continue;
      }

      const crcOffset = length + 4;
      const actualCrc = packet[crcOffset] * 256 + packet[crcOffset + 1];
      // CRC 范围按命令区分：Wi-Fi 列表从命令字开始，其余从长度字段开始
      const expectedCrc = crc16(packet.slice(isList ? 4 : 2, crcOffset));

      if (packet[total - 1] !== FRAME_TAIL || actualCrc !== expectedCrc) {
        cache.shift();
        onError("帧尾或 CRC 错误");
        continue;
      }

      cache.splice(0, total);
      try {
        const payload = packet.slice(6, crcOffset);
        onMessage({ t1, t2, data: JSON.parse(fromUtf8(payload)) });
      } catch (error) {
        onError("JSON 解码或消息处理失败");
      }
    }
  };
}

/** 配网状态码 → 用户文案（协议 4.2；status 为 Number） */
export function describeStatus(status: number): string {
  switch (status) {
    case 0:
      return "联网成功";
    case 1:
      return "设备联网中，请稍候…";
    case 2:
      return "配网报文处理失败，请重试";
    case 3:
      return "未找到目标 WiFi，请确认手机与设备在同一网络附近";
    case 4:
      return "WiFi 连接失败，请检查密码，并确认手机连接的是 2.4GHz 网络";
    default:
      return "设备返回了未知状态，请重试";
  }
}

/** 是否为终态（结束等待） */
export function isFinalStatus(status: number): boolean {
  return status !== 1;
}
