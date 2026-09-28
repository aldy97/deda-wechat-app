"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("./utils/request");
/**
 * 连通性检查：调用 /health 确认服务端可达
 */
function checkServerHealth() {
  return __awaiter(this, void 0, void 0, function* () {
    try {
      const res = yield (0, request_1.request)({
        method: "GET",
        url: "/health",
      });
      console.log("[App] server health:", res.data);
    } catch (error) {
      console.error("[App] server health check failed:", error);
    }
  });
}
/**
 * 小程序全局入口
 * 已登录用户直接进入设备列表；未登录用户留在登录页走 wx.login 流程。
 */
App({
  globalData: {
    // 全局用户信息占位，登录成功后可在各页面读取
    userInfo: null,
  },
  onLaunch() {
    console.log("[App] onLaunch");
    checkServerHealth();
    const token = wx.getStorageSync("token");
    if (token) {
      console.log("[App] token exists, redirect to device list");
      wx.switchTab({ url: "/pages/device-list/device-list" });
    } else {
      console.log("[App] no token, stay on login page");
    }
  },
  onShow() {
    console.log("[App] onShow");
  },
  onHide() {
    console.log("[App] onHide");
  },
});
