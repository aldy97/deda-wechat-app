import { request } from "../utils/request";
import type { ApiResponse } from "../utils/request";

/** 家长手机品牌上报参数；只传品牌，服务端按厂商级归并 */
export interface ReportClientInfoParams {
  brand: string;
}

export interface ReportClientInfoResult {
  success: boolean;
  skipped: boolean;
}

/**
 * 上报家长手机品牌（契约 POST /users/client-info）
 * 空品牌由调用方拦掉；服务端空值/用户不存在返回 skipped=true。
 */
export async function reportClientInfo(
  params: ReportClientInfoParams,
): Promise<ApiResponse<ReportClientInfoResult>> {
  return request<ReportClientInfoResult>({
    method: "POST",
    url: "/users/client-info",
    data: { brand: params.brand },
  });
}
