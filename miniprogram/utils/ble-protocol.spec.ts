/**
 * ble-protocol 单元测试。
 * 黄金报文取自《BLE配网协议_百度公版.docx》第 9 节，逐字节对齐。
 */
import {
  BLE_CHUNK_SIZE,
  CMD_SET_WIFI,
  createReceiver,
  crc16,
  describeStatus,
  fromUtf8,
  isFinalStatus,
  makeConfigFrame,
  ProvisionMessage,
  toUtf8,
} from "./ble-protocol";

function hex(hexString: string): number[] {
  return hexString
    .trim()
    .split(/\s+/)
    .map((s: string) => parseInt(s, 16));
}

describe("toUtf8 / fromUtf8", () => {
  it("ASCII 与中文往返一致", () => {
    expect(Array.from(toUtf8("IT"))).toEqual([0x49, 0x54]);
    const text = "测试WiFi";
    expect(fromUtf8(toUtf8(text))).toBe(text);
    // "测试WiFi" = 2*3 + 4 = 10 字节
    expect(toUtf8(text).length).toBe(10);
  });

  it("非法代理字符抛异常（半个 emoji）", () => {
    expect(() => toUtf8("😀")).not.toThrow();
    expect(() => toUtf8("😀".slice(0, 1))).toThrow();
  });
});

describe("crc16", () => {
  it("检验字符串 123456789 → 0x31C3（协议 3.2）", () => {
    expect(crc16(toUtf8("123456789"))).toBe(0x31c3);
  });
});

describe("makeConfigFrame", () => {
  it("黄金帧：ssid=IT pass=12345678 → 40 字节，CRC 0x64CF（协议 9.1）", () => {
    const frame = makeConfigFrame("IT", "12345678");
    const expected = hex(
      "4A 4C 00 21 10 01 7B 22 73 73 69 64 22 3A 22 49 54 22 2C 22 " +
        "70 61 73 73 22 3A 22 31 32 33 34 35 36 37 38 22 7D 64 CF FF",
    );
    expect(Array.from(frame)).toEqual(expected);
    expect(frame.length).toBe(40);
    expect(BLE_CHUNK_SIZE).toBe(20); // 分片后两包各 20 字节
  });

  it("CRC 覆盖范围含长度字段：frame[2 : L+4]（协议 3.2）", () => {
    const frame = makeConfigFrame("IT", "12345678");
    const length = frame[2] * 256 + frame[3];
    const crc = frame[length + 4] * 256 + frame[length + 5];
    expect(crc).toBe(crc16(Array.from(frame).slice(2, length + 4)));
    expect(frame[length + 6]).toBe(0xff);
  });

  it("中文 SSID 按 UTF-8 字节计数与组帧", () => {
    const frame = makeConfigFrame("测试WiFi", "12345678");
    const length = frame[2] * 256 + frame[3];
    const json = fromUtf8(Array.from(frame).slice(6, length + 4));
    expect(JSON.parse(json)).toEqual({ ssid: "测试WiFi", pass: "12345678" });
    expect(frame[4]).toBe(CMD_SET_WIFI[0]);
    expect(frame[5]).toBe(CMD_SET_WIFI[1]);
  });

  it("开放网络：pass 允许为空字符串", () => {
    const frame = makeConfigFrame("Guest", "");
    const length = frame[2] * 256 + frame[3];
    const json = fromUtf8(Array.from(frame).slice(6, length + 4));
    expect(JSON.parse(json)).toEqual({ ssid: "Guest", pass: "" });
  });

  it("空 SSID / 非字符串直接拒绝", () => {
    expect(() => makeConfigFrame("", "12345678")).toThrow();
    expect(() => makeConfigFrame("  ", "12345678")).not.toThrow(); // 不 trim，原样编码
  });

  it("SSID 超 32 字节（11 个汉字 = 33 字节）拒绝", () => {
    expect(() => makeConfigFrame("一二三四五六七八九十一", "12345678")).toThrow(
      "SSID 或密码字节数超限",
    );
  });

  it("密码超 64 字节拒绝", () => {
    expect(() => makeConfigFrame("IT", "x".repeat(65))).toThrow(
      "SSID 或密码字节数超限",
    );
  });

  it("字段双上限恰好顶格（32+64 → JSON 117 字节）仍允许", () => {
    const frame = makeConfigFrame("s".repeat(32), "p".repeat(64));
    const length = frame[2] * 256 + frame[3];
    expect(length).toBe(117 + 2);
    expect(frame.length).toBe(length + 7);
  });
});

describe("createReceiver 组帧解析", () => {
  /** 设备五条固定回复（协议 9.2，各 21 字节） */
  const STATUS_FRAMES: Record<number, number[]> = {
    0: hex("4A 4C 00 0E 10 02 7B 22 73 74 61 74 75 73 22 3A 30 7D 7C C3 FF"),
    1: hex("4A 4C 00 0E 10 02 7B 22 73 74 61 74 75 73 22 3A 31 7D 4F F2 FF"),
    2: hex("4A 4C 00 0E 10 02 7B 22 73 74 61 74 75 73 22 3A 32 7D 1A A1 FF"),
    3: hex("4A 4C 00 0E 10 02 7B 22 73 74 61 74 75 73 22 3A 33 7D 29 90 FF"),
    4: hex("4A 4C 00 0E 10 02 7B 22 73 74 61 74 75 73 22 3A 34 7D B0 07 FF"),
  };
  /** 空 Wi-Fi 列表（协议 9.3，CRC 不含长度字段） */
  const EMPTY_LIST_FRAME = hex(
    "4A 4C 00 11 20 01 7B 22 77 69 66 69 4C 69 73 74 22 3A 5B 5D 7D E3 92 FF",
  );

  interface ParsedMessage extends ProvisionMessage {
    data: { status?: number; wifiList?: unknown };
  }

  let messages: ParsedMessage[];
  let errors: string[];
  let receive: (chunk: ArrayLike<number>) => void;

  beforeEach(() => {
    messages = [];
    errors = [];
    receive = createReceiver(
      (msg) => messages.push(msg as ParsedMessage),
      (err) => errors.push(err),
    );
  });

  it("五条黄金状态帧全部解析成功", () => {
    for (const status of [0, 1, 2, 3, 4]) {
      receive(STATUS_FRAMES[status]);
    }
    expect(messages.map((m) => m.data.status)).toEqual([0, 1, 2, 3, 4]);
    expect(messages.every((m) => m.t1 === 0x10 && m.t2 === 0x02)).toBe(true);
    expect(errors).toEqual([]);
  });

  it("Wi-Fi 列表帧（CRC 不含长度字节）解析成功", () => {
    receive(EMPTY_LIST_FRAME);
    expect(messages).toEqual([{ t1: 0x20, t2: 0x01, data: { wifiList: [] } }]);
    expect(errors).toEqual([]);
  });

  it("列表帧若误用含长度的 CRC 范围验算则必然报错（锁定 CRC 差异）", () => {
    // 用"含长度"的错误范围重算 CRC 造一帧，正确实现应判 CRC 错误
    const payload = hex("7B 22 77 69 66 69 4C 69 73 74 22 3A 5B 5D 7D");
    const length = payload.length + 2;
    const wrongBody = [length >> 8, length & 255, 0x20, 0x01].concat(payload);
    const wrongCrc = crc16(wrongBody); // 错误：列表帧 CRC 不应含长度
    const badFrame = [0x4a, 0x4c]
      .concat(wrongBody)
      .concat([wrongCrc >> 8, wrongCrc & 255, 0xff]);
    receive(badFrame);
    expect(messages).toEqual([]);
    expect(errors).toContain("帧尾或 CRC 错误");
  });

  it("逐字节喂入（极限拆包）也能组出完整帧", () => {
    for (const byte of STATUS_FRAMES[0]) {
      receive([byte]);
    }
    expect(messages).toHaveLength(1);
    expect(messages[0].data.status).toBe(0);
  });

  it("一次通知含多帧时循环取出", () => {
    receive(STATUS_FRAMES[1].concat(STATUS_FRAMES[0]));
    expect(messages.map((m) => m.data.status)).toEqual([1, 0]);
  });

  it("帧头前的噪声字节被跳过", () => {
    receive([0x00, 0x11, 0x22].concat(STATUS_FRAMES[0]));
    expect(messages).toHaveLength(1);
  });

  it("帧尾非 FF：报错并逐字节滑动重新对齐", () => {
    const bad = STATUS_FRAMES[0].slice(0, -1).concat([0x00]);
    receive(bad.concat(STATUS_FRAMES[1]));
    expect(errors).toContain("帧尾或 CRC 错误");
    expect(messages.map((m) => m.data.status)).toEqual([1]);
  });

  it("未知命令：整帧跳过并报错，不影响后续帧", () => {
    const payload = Array.from(toUtf8('{"x":1}'));
    const length = payload.length + 2;
    const body = [length >> 8, length & 255, 0x30, 0x01].concat(payload);
    const crc = crc16(body);
    const unknownFrame = [0x4a, 0x4c]
      .concat(body)
      .concat([crc >> 8, crc & 255, 0xff]);
    receive(unknownFrame.concat(STATUS_FRAMES[0]));
    expect(errors).toContain("未支持的命令");
    expect(messages.map((m) => m.data.status)).toEqual([0]);
  });

  it("长度字段异常（<2）：滑动一个字节继续找帧头", () => {
    receive([0x4a, 0x4c, 0x00, 0x01].concat(STATUS_FRAMES[0]));
    expect(errors).toContain("长度异常");
    expect(messages.map((m) => m.data.status)).toEqual([0]);
  });
});

describe("describeStatus / isFinalStatus", () => {
  it("状态文案映射", () => {
    expect(describeStatus(0)).toBe("联网成功");
    expect(describeStatus(1)).toContain("联网中");
    expect(describeStatus(4)).toContain("2.4GHz");
    expect(describeStatus(99)).toContain("未知状态");
  });

  it("仅 status=1 为中间态", () => {
    expect(isFinalStatus(1)).toBe(false);
    for (const s of [0, 2, 3, 4]) expect(isFinalStatus(s)).toBe(true);
  });
});
