import type { DeviceAboutInfo, DeviceStatus } from "../../api/api";

export interface DiagnosticRow {
  key: string;
  label: string;
  value: string;
  copyable: boolean;
}

export interface DiagnosticSection {
  key: string;
  title: string;
  rows: DiagnosticRow[];
}

export type StatusError = "failed" | "not-found" | null;

export interface RawLocalEnv {
  appBaseInfo?: { version?: string } | null;
  deviceInfo?: { brand?: string; model?: string; system?: string } | null;
}

export interface DeviceLocalEnv {
  wechatText: string;
  phoneText: string;
  systemText: string;
}

export interface BuildDiagnosticsInput {
  detail: DeviceAboutInfo;
  status: DeviceStatus | null;
  statusError: StatusError;
  env: DeviceLocalEnv;
}

const CHARACTER_LABELS: Record<string, string> = {
  elly: "Elly",
  polly: "Polly",
};

/** 12 位十六进制 MAC 统一成 AA:BB:CC:DD:EE:FF；其他形态原样返回 */
export function formatMacAddress(raw?: string | null): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const hex = value.replace(/[^0-9a-fA-F]/g, "");
  if (hex.length !== 12) return value;
  return (hex.toUpperCase().match(/.{2}/g) ?? []).join(":");
}

function normalizeMacLike(raw?: string | null): string {
  return (raw ?? "").replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

function formatCharacter(characterKey?: string | null): string {
  const raw = (characterKey ?? "").trim();
  if (!raw) return "";
  return CHARACTER_LABELS[raw.toLowerCase()] || raw;
}

export function formatWechatEnv(
  appBaseInfo?: { version?: string } | null,
): string {
  return (appBaseInfo?.version ?? "").trim() || "未获取";
}

export function formatPhoneEnv(
  deviceInfo?: { brand?: string; model?: string } | null,
): string {
  const text =
    (deviceInfo?.model ?? "").trim() || (deviceInfo?.brand ?? "").trim();
  return text || "未获取";
}

export function formatSystemEnv(
  deviceInfo?: { system?: string } | null,
): string {
  return (deviceInfo?.system ?? "").trim() || "未获取";
}

export function buildLocalEnv(raw: RawLocalEnv = {}): DeviceLocalEnv {
  return {
    wechatText: formatWechatEnv(raw.appBaseInfo),
    phoneText: formatPhoneEnv(raw.deviceInfo),
    systemText: formatSystemEnv(raw.deviceInfo),
  };
}

function makeRow(
  key: string,
  label: string,
  value: string,
  copyable = false,
): DiagnosticRow {
  return { key, label, value, copyable };
}

function buildIdentityRows(detail: DeviceAboutInfo): DiagnosticRow[] {
  const rows: DiagnosticRow[] = [];
  const push = (
    key: string,
    label: string,
    value: string | null | undefined,
    copyable = false,
  ) => {
    const text = (value ?? "").trim();
    if (!text) return;
    rows.push(makeRow(key, label, text, copyable));
  };

  push("deviceRole", "设备角色", formatCharacter(detail.characterKey));
  push("deviceCode", "设备编码", detail.deviceCode, true);
  push("deviceId", "设备 ID", detail.deviceId, true);

  const mac = formatMacAddress(detail.macAddress);
  if (
    mac &&
    normalizeMacLike(detail.macAddress) !== normalizeMacLike(detail.deviceId)
  ) {
    push("macAddress", "MAC 地址", mac, true);
  }

  return rows;
}

function formatOnlineStatus(status: DeviceStatus): string {
  return status.status === "online" ? "在线" : "离线";
}

function formatBattery(status: DeviceStatus): string {
  if (status.battery === null || status.battery === undefined) return "未上报";
  const charging = status.isCharging === true ? "（充电中）" : "";
  return `${status.battery}%${charging}`;
}

function formatVolume(status: DeviceStatus): string {
  if (status.volume === null || status.volume === undefined) return "未上报";
  return String(status.volume);
}

function formatNetwork(
  status: DeviceStatus,
  fallbackNetworkType?: string | null,
): string {
  const mode = status.networkMode;
  if (mode === "4g") return "4G";
  if (mode === "wifi") {
    const rssi = status.wifiRssi;
    if (typeof rssi === "number" && Number.isInteger(rssi) && rssi < 0) {
      return `WiFi · ${rssi} dBm`;
    }
    return "WiFi · 信号未上报";
  }
  return (fallbackNetworkType ?? "").trim() || "未知";
}

function buildStatusRows(input: BuildDiagnosticsInput): DiagnosticRow[] {
  const { status, statusError, detail } = input;
  const rows: DiagnosticRow[] = [];

  if (statusError === "not-found") {
    rows.push(makeRow("online", "在线状态", "设备不存在或已解绑"));
  } else if (statusError === "failed" || !status) {
    rows.push(makeRow("online", "在线状态", "未获取"));
    rows.push(makeRow("battery", "电量", "未获取"));
    rows.push(makeRow("volume", "音量", "未获取"));
    rows.push(makeRow("network", "网络", "未获取"));
  } else {
    rows.push(makeRow("online", "在线状态", formatOnlineStatus(status)));
    rows.push(makeRow("battery", "电量", formatBattery(status)));
    rows.push(makeRow("volume", "音量", formatVolume(status)));
    rows.push(
      makeRow("network", "网络", formatNetwork(status, detail.networkType)),
    );
  }

  return rows;
}

function buildVersionRows(
  detail: DeviceAboutInfo,
  env: DeviceLocalEnv,
): DiagnosticRow[] {
  return [
    makeRow(
      "firmwareVersion",
      "固件版本",
      (detail.firmwareVersion ?? "").trim() || "未上报",
    ),
    makeRow("wechat", "微信版本", env.wechatText),
    makeRow("phone", "手机", env.phoneText),
    makeRow("system", "系统", env.systemText),
  ];
}

export function buildDiagnosticSections(
  input: BuildDiagnosticsInput,
): DiagnosticSection[] {
  return [
    {
      key: "identity",
      title: "设备身份",
      rows: buildIdentityRows(input.detail),
    },
    {
      key: "status",
      title: "运行状态",
      rows: buildStatusRows(input),
    },
    {
      key: "version",
      title: "版本与环境",
      rows: buildVersionRows(input.detail, input.env),
    },
  ];
}

/** 拼接客服可直接粘贴的纯文本；不含孩子姓名、账号等隐私信息 */
export function buildDiagnosticsText(sections: DiagnosticSection[]): string {
  if (sections.length === 0) return "";

  const lines = ["【DEDA 设备诊断信息】"];
  for (const section of sections) {
    lines.push("", `【${section.title}】`);
    for (const row of section.rows) {
      lines.push(`${row.label}：${row.value}`);
    }
  }
  return lines.join("\n");
}

export type Settled<T> =
  { ok: true; value: T } | { ok: false; reason: unknown };

/** 不使用 Promise.allSettled（ES2015 lib 不包含），单请求失败不拖垮整页 */
export function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise
    .then((value) => ({ ok: true as const, value }))
    .catch((reason) => ({ ok: false as const, reason }));
}
