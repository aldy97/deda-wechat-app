# 设备端 MQTT 对接文档

版本：1.1，2026-11-10。面向客户后端与设备端对接，与同目录[《设备端接口文档.md》](设备端接口文档.md)配套使用。设备上线和每轮对话登记使用 HTTP，本文件定义状态、心跳与常规控制使用的 MQTT 协议。

## 1. 连接配置

| 参数         | 说明                              |
| ------------ | --------------------------------- |
| Broker       | MQTT Broker 地址（由服务端提供）  |
| ClientID     | 设备唯一标识，建议使用设备Mac地址 |
| Username     | 认证用户名（可选）                |
| Password     | 认证密码（可选）                  |
| KeepAlive    | 30秒                              |
| CleanSession | false（持久会话）                 |
| QoS          | 1（至少一次）                     |

## 2. HTTP 与 MQTT 的接入顺序

### 2.1 与旧版 MQTT 文档的差异

旧版公共绑定主题 `loginMac` 已取消，设备不再通过该主题发布或订阅消息。设备联网后改为调用 HTTP `POST /client/user/user/loginMac`，由后端校验设备身份，并在响应头 `Authorization` 中返回三方 LLM API KEY。

公共主题可以通过消息体区分设备，但若要逐设备返回 API KEY 和处理结果，还需额外设计响应主题及请求关联。HTTP 请求自带对应响应，因此本版将上线登记和密钥返回改用 HTTP。详细参数见同目录《设备端接口文档.md》。

| 通道 | 职责                                        | 接口或主题                             |
| ---- | ------------------------------------------- | -------------------------------------- |
| HTTP | 联网上线登记，获取三方 LLM API KEY          | `POST /client/user/user/loginMac`      |
| HTTP | 每轮实例创建且 RTC 连接成功后，登记当前实例 | `POST /client/bot/bot/start`           |
| HTTP | 每轮对话结束时，结束对应实例登记            | `POST /client/bot/bot/stop`            |
| MQTT | 持续上报状态、心跳，接收设备控制指令        | `device/up/{mac}`、`device/down/{mac}` |

三个 HTTP 接口分别让后端知道“哪台设备上线、当前使用哪个实例、哪个实例已结束”。MQTT 心跳用于判断设备是否在线，不代替上述三个接口。

### 2.2 接入顺序

| 步骤 | 设备操作                 | 说明                                                         |
| ---- | ------------------------ | ------------------------------------------------------------ |
| 1    | 联网后调用 HTTP 上线接口 | 上报 MAC 和密码，读取响应头中的三方 LLM API KEY              |
| 2    | 建立 MQTT 连接           | 使用第1节连接参数连接 Broker                                 |
| 3    | 订阅设备下行主题         | 订阅 `device/down/{mac}`，用于接收服务端业务指令             |
| 4    | 上报设备初始状态         | 向 `device/up/{mac}` 发布 `query` 消息，上报电量、音量和版本 |
| 5    | 进入正常交互             | 每5秒上报 `query` 心跳，并处理服务端下发指令                 |
| 6    | 按每轮对话调用 HTTP 通知 | 实例创建且 RTC 连接成功后调用 `start`，本轮结束时调用 `stop` |

仅 MQTT 断线且 HTTP API KEY 仍有效时，重连后恢复步骤3至5，无需重复上线。设备重新启动或 API KEY 无效时，按 HTTP 文档重新上线；每轮对话仍按实际状态调用 `start`、`stop`。

### 2.3 主题定义

| 方向          | 主题                | 消息用途                                         | 说明位置     |
| ------------- | ------------------- | ------------------------------------------------ | ------------ |
| 设备 → 服务端 | `device/up/{mac}`   | 上报设备状态和心跳                               | 第4节、第7节 |
| 服务端 → 设备 | `device/down/{mac}` | 接收查询、音量设置、重启、升级及恢复出厂设置指令 | 第5节        |

`{mac}` 为设备Mac地址，统一使用无分隔符的十二位小写十六进制，与 HTTP 上线请求的 `mac` 一致。本文示例统一使用 `aabbccddeeff`。

所有 MQTT 消息均使用 UTF-8 编码的 JSON 字符串，结构见第3节。

---

## 3. 后续业务消息格式

设备通过按 MAC 区分的上下行主题进行业务交互。

### 3.1 通用消息结构

以下结构适用于 `device/up/{mac}` 和 `device/down/{mac}`。

```json
{
  "cmd": "query",
  "flag": "success",
  "data": null
}
```

| 字段 | 类型        | 必填 | 说明                             |
| ---- | ----------- | ---- | -------------------------------- |
| cmd  | string      | 是   | 命令类型，见下方命令列表         |
| flag | string      | 是   | 状态标志：`"success"` / `"fail"` |
| data | object/null | 否   | 命令相关数据，无数据时为 `null`  |

### 3.2 命令列表

| cmd       | 说明               | 方向        | data   |
| --------- | ------------------ | ----------- | ------ |
| `query`   | 电量/音量/版本查询 | 双向        | 见下方 |
| `volume`  | 音量设置           | 双向        | 见下方 |
| `restart` | 重启设备           | 服务端→设备 | null   |
| `upgrade` | 固件升级           | 双向        | null   |
| `recover` | 恢复出厂设置       | 服务端→设备 | null   |

---

## 4. 设备状态上报

### 4.1 电量、音量和版本上报 (query)

设备定时或触发上报电量、音量、固件版本信息。

**发布主题**: `device/up/{mac}`

```json
{
  "cmd": "query",
  "flag": "success",
  "data": {
    "battery": 80,
    "volume": 50,
    "version": "1.2.3"
  }
}
```

| 字段    | 类型   | 范围  | 说明                   |
| ------- | ------ | ----- | ---------------------- |
| battery | int    | 0-100 | 电量百分比             |
| volume  | int    | 0-100 | 音量百分比             |
| version | string | -     | 固件版本号，格式 x.y.z |

**服务端行为**: 更新设备电量、音量、版本信息，推送状态到App端，如有新固件则自动下发升级指令。

---

## 5. 服务端下发指令详解

设备需订阅 `device/down/{mac}` 主题接收以下指令。

### 5.1 查询指令 (query)

服务端请求设备上报电量、音量、版本信息。

```json
{
  "cmd": "query",
  "flag": "success",
  "data": null
}
```

**设备行为**: 收到后应立即上报一条 `query` 消息（见第4.1节）。

---

### 5.2 设置音量 (volume)

```json
{
  "cmd": "volume",
  "flag": "success",
  "data": {
    "volume": 50
  }
}
```

| 字段   | 类型 | 范围  | 说明       |
| ------ | ---- | ----- | ---------- |
| volume | int  | 0-100 | 目标音量值 |

**设备行为**: 设置音量到指定值。

---

### 5.3 重启设备 (restart)

```json
{
  "cmd": "restart",
  "flag": "success",
  "data": null
}
```

**设备行为**: 重启设备。

---

### 5.4 固件升级 (upgrade)

```json
{
  "cmd": "upgrade",
  "flag": "success",
  "data": null
}
```

**设备行为**: 触发OTA固件升级流程。

---

### 5.5 恢复出厂设置 (recover)

```json
{
  "cmd": "recover",
  "flag": "success",
  "data": null
}
```

**设备行为**: 恢复出厂设置，清除所有用户数据。

---

## 6. 完整交互流程示例

### 6.1 HTTP 上线、MQTT 连接与每轮对话

```text
1. 设备联网，通过 HTTP POST /client/user/user/loginMac 上报 MAC 和密码。
   后端在响应头 Authorization 返回三方 LLM API KEY。
   请求与响应详情见《设备端接口文档.md》第三节。

2. 设备建立 MQTT 连接。

3. 设备订阅下行主题：device/down/aabbccddeeff

4. 设备 → 服务端  topic: device/up/aabbccddeeff
{
  "cmd": "query",
  "flag": "success",
  "data": { "battery": 85, "volume": 60, "version": "1.0.0" }
}

5. 服务端 → 设备  topic: device/down/aabbccddeeff  (如有新固件)
{
  "cmd": "upgrade",
  "flag": "success",
  "data": null
}

6. 设备每5秒通过 device/up/aabbccddeeff 上报 query 心跳。

7. 用户开始对话：设备创建百度实例，配置三方 LLM 接入并连接 RTC。
   成功后通过 HTTP POST /client/bot/bot/start 登记本轮实例。
   后端返回 {"code":200}。

8. 本轮对话结束：设备通过 HTTP POST /client/bot/bot/stop 通知退下，
   并自行断开 RTC、释放云端实例；后端返回 {"code":200}。

9. 下一轮对话重复步骤7至8；设备仍在线时，MQTT 心跳持续上报。
```

### 6.2 App端调整音量

```
服务端 → 设备  topic: device/down/aabbccddeeff
{
  "cmd": "volume",
  "flag": "success",
  "data": { "volume": 30 }
}
```

---

## 7. 心跳保活与在线判定

### 7.1 心跳机制

设备建立 MQTT 连接后，需**每 5 秒**向服务端上报一条 `query` 消息作为心跳，服务端据此判定设备在线状态。

```json
{
  "cmd": "query",
  "flag": "success",
  "data": {
    "battery": 80,
    "volume": 50,
    "version": "1.2.3"
  }
}
```

### 7.2 在线判定规则

| 条件                               | 判定结果 |
| ---------------------------------- | -------- |
| 服务端在 15 秒内收到设备上报消息   | 设备在线 |
| 服务端超过 15 秒未收到设备上报消息 | 设备离线 |

- 服务端每 5 秒扫描一次在线的 MQTT 设备，检查最后活跃时间
- 超过 15 秒（3倍心跳间隔）未上报的设备将被标记为离线
- 设备重新上报消息后自动恢复为在线

### 7.3 注意事项

- 设备**必须**定时上报 `query` 消息，即使电量/音量/版本未变化
- 建议上报间隔 5 秒，不要超过 10 秒，否则可能被误判为离线
- MQTT Broker 的 KeepAlive 仅保证 TCP 连接存活，服务端在线判定依赖应用层心跳

---

## 8. 注意事项

1. **QoS 级别**: 建议使用 QoS 1，确保消息至少送达一次
2. **Retained 消息**: 不使用 retained 标志，避免设备上线后收到过期指令
3. **心跳保活**: 设备需每 5 秒上报 `query` 消息作为心跳（见第7节）
4. **断线重连**: 建议实现自动重连机制，重连成功后重新订阅 `device/down/{mac}`，恢复状态上报和心跳；HTTP 上线与重登规则见第2.2节
