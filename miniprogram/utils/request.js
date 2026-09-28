"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.request = request;
const api_config_1 = require("../config/api.config");
function request(options) {
  const token = wx.getStorageSync("token") || "";
  const url = `${api_config_1.API_BASE_URL}${options.url}`;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: options.method,
      data: options.data,
      header: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      success: (res) => {
        const statusCode = res.statusCode || 0;
        const body = res.data;
        if (statusCode >= 200 && statusCode < 300) {
          if (body && typeof body.code === "number" && body.code !== 0) {
            console.warn(`[request] business error: ${url}`, body);
            reject(new Error(body.message || "Request failed"));
          } else {
            resolve(body);
          }
        } else {
          console.error(`[request] HTTP error: ${url}`, statusCode, body);
          const message =
            (body === null || body === void 0 ? void 0 : body.message) ||
            `HTTP ${statusCode}`;
          reject(new Error(message));
        }
      },
      fail: (err) => {
        console.error(`[request] network error: ${url}`, err);
        reject(new Error(err.errMsg || "Network error"));
      },
    });
  });
}
