import {
  buildDiagnosticSections,
  buildDiagnosticsText,
  buildLocalEnv,
  formatMacAddress,
} from "./about-device.utils";

const DETAIL = {
  deviceId: "aabbccddeeff",
  deviceCode: "1608281053529797520",
  firmwareVersion: "CMS1W8bd_V1.01_828_brtc_version",
  networkType: "WiFi",
  macAddress: "112233445566",
  characterKey: "elly",
};

const STATUS = {
  deviceId: "aabbccddeeff",
  status: "online" as const,
  battery: 65,
  volume: 80,
  isCharging: true,
  networkMode: "wifi" as const,
  wifiRssi: -65,
  lastActiveAt: new Date(2026, 10, 25, 10, 32).toISOString(),
};

const ENV = buildLocalEnv({
  appBaseInfo: { version: "8.0.50" },
  deviceInfo: { brand: "Apple", model: "iPhone 15", system: "iOS 18.2" },
});

describe("formatMacAddress", () => {
  it("12 位十六进制统一为带冒号的大写格式", () => {
    expect(formatMacAddress("aabbccddeeff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(formatMacAddress("AA-BB-CC-DD-EE-FF")).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("空值返回空串，非 12 位原样返回", () => {
    expect(formatMacAddress("")).toBe("");
    expect(formatMacAddress(null)).toBe("");
    expect(formatMacAddress("abc")).toBe("abc");
  });
});

describe("buildLocalEnv", () => {
  it("完整环境信息：手机与系统分开", () => {
    expect(ENV).toEqual({
      wechatText: "8.0.50",
      phoneText: "Apple iPhone 15",
      phoneRawText: "Apple iPhone 15",
      systemText: "iOS 18.2",
    });
  });

  it("API 不可用/字段缺失时回退未获取", () => {
    expect(buildLocalEnv({})).toEqual({
      wechatText: "未获取",
      phoneText: "未获取",
      phoneRawText: "未获取",
      systemText: "未获取",
    });
  });

  it("微信版本缺失时展示未获取；手机字段缺失时展示占位", () => {
    expect(buildLocalEnv({ appBaseInfo: {} }).wechatText).toBe("未获取");
    expect(
      buildLocalEnv({ appBaseInfo: { version: "8.0.50" } }).wechatText,
    ).toBe("8.0.50");
    expect(buildLocalEnv({ deviceInfo: { brand: "Apple" } }).phoneText).toBe(
      "Apple",
    );
    expect(
      buildLocalEnv({ deviceInfo: { system: "iOS 18.2" } }).systemText,
    ).toBe("iOS 18.2");
  });

  it("iPhone 硬件标识只在复制文本里保留，展示串为 maker + 型号", () => {
    const env = buildLocalEnv({
      deviceInfo: { brand: "Apple", model: "iPhone 15 pro<iPhone16,1>" },
    });

    expect(env.phoneText).toBe("Apple iPhone 15 pro");
    expect(env.phoneRawText).toBe("Apple iPhone 15 pro<iPhone16,1>");
  });

  it("maker 与型号去重：model 已含 brand 前缀或 brand 缺失时不重复拼接", () => {
    expect(
      buildLocalEnv({
        deviceInfo: { brand: "iPhone", model: "iPhone 15<iPhone16,1>" },
      }).phoneText,
    ).toBe("iPhone 15");
    expect(
      buildLocalEnv({ deviceInfo: { model: "iPhone 15<iPhone16,1>" } })
        .phoneText,
    ).toBe("iPhone 15");
    expect(
      buildLocalEnv({ deviceInfo: { brand: "Apple", model: "  " } }).phoneText,
    ).toBe("Apple");
    expect(
      buildLocalEnv({ deviceInfo: { brand: "HUAWEI", model: "ALN-AL00" } })
        .phoneText,
    ).toBe("HUAWEI ALN-AL00");
  });
});

describe("buildDiagnosticSections", () => {
  it("完整数据：三个分组与关键文案", () => {
    const sections = buildDiagnosticSections({
      detail: DETAIL,
      status: STATUS,
      statusError: null,
      env: ENV,
    });

    expect(sections.map((section) => section.title)).toEqual([
      "设备身份",
      "运行状态",
      "版本与环境",
    ]);
    expect(sections[0].rows.map((row) => row.label)).toEqual([
      "设备角色",
      "设备编码",
      "设备 ID",
      "MAC 地址",
    ]);
    expect(sections[0].rows[0].value).toBe("Elly");
    expect(sections[0].rows[3].value).toBe("11:22:33:44:55:66");
    expect(sections[1].rows.map((row) => row.label)).toEqual([
      "在线状态",
      "电量",
      "音量",
      "网络",
    ]);
    expect(sections[1].rows.map((row) => row.value)).toEqual([
      "在线",
      "65%（充电中）",
      "80",
      "WiFi · -65 dBm",
    ]);
    expect(sections[2].rows.map((row) => row.value)).toEqual([
      "CMS1W8bd_V1.01_828_brtc_version",
      "8.0.50",
      "Apple iPhone 15",
      "iOS 18.2",
    ]);
  });

  it("手机行展示 maker + 型号，复制文本保留硬件标识", () => {
    const env = buildLocalEnv({
      appBaseInfo: { version: "8.0.80" },
      deviceInfo: { brand: "Apple", model: "iPhone 15 pro<iPhone16,1>" },
    });
    const sections = buildDiagnosticSections({
      detail: DETAIL,
      status: STATUS,
      statusError: null,
      env,
    });
    const phoneRow = sections[2].rows[2];

    expect(phoneRow.label).toBe("手机");
    expect(phoneRow.value).toBe("Apple iPhone 15 pro");
    expect(buildDiagnosticsText(sections)).toContain(
      "手机：Apple iPhone 15 pro<iPhone16,1>",
    );
  });

  it("展示串与复制串一致时不额外挂 copyValue", () => {
    const sections = buildDiagnosticSections({
      detail: DETAIL,
      status: STATUS,
      statusError: null,
      env: ENV,
    });

    expect(sections[2].rows[2].copyValue).toBeUndefined();
  });

  it("状态请求失败：状态字段显示未获取，身份/版本仍保留", () => {
    const sections = buildDiagnosticSections({
      detail: DETAIL,
      status: null,
      statusError: "failed",
      env: ENV,
    });

    expect(sections[0].rows.length).toBe(4);
    expect(sections[1].rows.map((row) => row.value)).toEqual([
      "未获取",
      "未获取",
      "未获取",
      "未获取",
    ]);
    expect(sections[2].rows.length).toBe(4);
  });

  it("状态 404：明确提示设备不存在或已解绑", () => {
    const sections = buildDiagnosticSections({
      detail: DETAIL,
      status: null,
      statusError: "not-found",
      env: ENV,
    });

    expect(sections[1].rows.map((row) => row.value)).toEqual([
      "设备不存在或已解绑",
    ]);
  });

  it("离线且未上报：只显示离线，其余字段明确兜底", () => {
    const sections = buildDiagnosticSections({
      detail: DETAIL,
      status: {
        deviceId: "aabbccddeeff",
        status: "offline",
        battery: null,
        volume: null,
        isCharging: null,
        networkMode: null,
        wifiRssi: null,
        lastActiveAt: null,
      },
      statusError: null,
      env: ENV,
    });

    expect(sections[1].rows.map((row) => row.value)).toEqual([
      "离线",
      "未上报",
      "未上报",
      "WiFi",
    ]);
  });

  it("4G 不展示信号；WiFi 信号未上报单独兜底", () => {
    const fourG = buildDiagnosticSections({
      detail: DETAIL,
      status: { ...STATUS, networkMode: "4g", wifiRssi: null },
      statusError: null,
      env: ENV,
    });
    expect(fourG[1].rows[3].value).toBe("4G");

    const unknownRssi = buildDiagnosticSections({
      detail: DETAIL,
      status: { ...STATUS, wifiRssi: null },
      statusError: null,
      env: ENV,
    });
    expect(unknownRssi[1].rows[3].value).toBe("WiFi · 信号未上报");
  });

  it("角色映射与缺失字段：polly 正常映射，空值不占行", () => {
    const sections = buildDiagnosticSections({
      detail: {
        deviceId: "aabbccddeeff",
        deviceCode: null,
        firmwareVersion: null,
        networkType: null,
        macAddress: "aabbccddeeff",
        characterKey: "polly",
      },
      status: STATUS,
      statusError: null,
      env: ENV,
    });

    expect(sections[0].rows.map((row) => row.label)).toEqual([
      "设备角色",
      "设备 ID",
    ]);
    expect(sections[0].rows[0].value).toBe("Polly");
    expect(sections[2].rows[0].value).toBe("未上报");
  });

  it("未知角色保留原始 key", () => {
    const sections = buildDiagnosticSections({
      detail: { ...DETAIL, characterKey: "custom_role" },
      status: STATUS,
      statusError: null,
      env: ENV,
    });

    expect(sections[0].rows[0].value).toBe("custom_role");
  });
});

describe("buildDiagnosticsText", () => {
  it("包含分组标题与字段行，不含采集时间", () => {
    const sections = buildDiagnosticSections({
      detail: DETAIL,
      status: STATUS,
      statusError: null,
      env: ENV,
    });

    const text = buildDiagnosticsText(sections);

    expect(text).toContain("【DEDA 设备诊断信息】");
    expect(text).not.toContain("采集时间");
    expect(text).toContain("【设备身份】");
    expect(text).toContain("设备 ID：aabbccddeeff");
    expect(text).toContain("【运行状态】");
    expect(text).toContain("在线状态：在线");
    expect(text).not.toContain("最后上报");
    expect(text).not.toContain("当前对话模式");
    expect(text).toContain("【版本与环境】");
    expect(text).toContain("微信版本：8.0.50");
    expect(text).not.toContain("小程序版本");
    expect(text).not.toContain("基础库");
    expect(text).toContain("手机：Apple iPhone 15");
    expect(text).toContain("系统：iOS 18.2");
  });

  it("空分组返回空串", () => {
    expect(buildDiagnosticsText([])).toBe("");
  });
});
