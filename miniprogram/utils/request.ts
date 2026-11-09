import { API_BASE_URL } from "../config/api.config";
import { reportApi } from "./monitor";

/**
 * 小程序统一请求封装
 * - baseURL 指向本地 deda-server
 * - 自动从 storage 读取 token 并注入 Authorization
 * - 统一处理 { code, message, data } 响应格式
 */

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  data?: any;
}

/** 401 全局重定向守卫：并发请求同时 401 时只 reLaunch 一次 */
let isRedirectingToLogin = false;

/**
 * 401 统一处理：清除失效 token 并回到登录页。
 * 开发/生产环境行为一致，不允许页面停留在白屏或只弹 toast。
 */
function handleUnauthorized(): void {
  if (isRedirectingToLogin) return;
  isRedirectingToLogin = true;

  wx.removeStorageSync("token");
  wx.reLaunch({
    url: "/pages/login/login",
    complete: () => {
      isRedirectingToLogin = false;
    },
  });
}

export function request<T>(options: RequestOptions): Promise<ApiResponse<T>> {
  const token = wx.getStorageSync("token") || "";

  const url = `${API_BASE_URL}${options.url}`;
  const begin = Date.now();

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: options.method as any,
      data: options.data,
      header: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      success: (res) => {
        const statusCode = res.statusCode || 0;
        const body = res.data as any;

        // 401 无论以 HTTP 状态码还是业务 code 返回，都统一走全局重登录
        if (statusCode === 401 || body?.code === 401) {
          console.warn(`[request] unauthorized: ${url}`);
          handleUnauthorized();
          reject(new Error("登录已过期，请重新登录"));
          return;
        }

        if (statusCode >= 200 && statusCode < 300) {
          if (body && typeof body.code === "number" && body.code !== 0) {
            console.warn(`[request] business error: ${url}`, body);
            reject(new Error(body.message || "Request failed"));
          } else {
            resolve(body as ApiResponse<T>);
          }
        } else {
          console.error(`[request] HTTP error: ${url}`, statusCode, body);
          const message = body?.message || `HTTP ${statusCode}`;
          // 4xx/5xx 上报 ARMS（401 已在上方单独处理，属登录态流转不上报）
          if (statusCode >= 400) {
            reportApi(options.url, Date.now() - begin, statusCode, message);
          }
          // 携带 HTTP 状态码，页面层可据此区分 404（资源不存在）与网络/服务异常
          const error = new Error(message) as Error & { statusCode?: number };
          error.statusCode = statusCode;
          reject(error);
        }
      },
      fail: (err) => {
        console.error(`[request] network error: ${url}`, err);
        // 网络层失败（断网/超时/DNS），上报 ARMS
        reportApi(
          options.url,
          Date.now() - begin,
          0,
          err.errMsg || "Network error",
        );
        reject(new Error(err.errMsg || "Network error"));
      },
    });
  });
}
