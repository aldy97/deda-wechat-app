import { API_BASE_URL } from '../config/api.config';

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
  method: 'GET' | 'POST' | 'DELETE';
  url: string;
  data?: any;
}

export function request<T>(options: RequestOptions): Promise<ApiResponse<T>> {
  const token = wx.getStorageSync('token') || '';

  const url = `${API_BASE_URL}${options.url}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: options.method,
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      success: (res) => {
        const statusCode = res.statusCode || 0;
        const body = res.data as any;

        if (statusCode >= 200 && statusCode < 300) {
          if (body && typeof body.code === 'number' && body.code !== 0) {
            console.warn(`[request] business error: ${url}`, body);
            reject(new Error(body.message || 'Request failed'));
          } else {
            resolve(body as ApiResponse<T>);
          }
        } else {
          console.error(`[request] HTTP error: ${url}`, statusCode, body);
          const message = body?.message || `HTTP ${statusCode}`;
          reject(new Error(message));
        }
      },
      fail: (err) => {
        console.error(`[request] network error: ${url}`, err);
        reject(new Error(err.errMsg || 'Network error'));
      },
    });
  });
}
