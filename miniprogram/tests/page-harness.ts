/**
 * 页面装配测试基座。
 *
 * 小程序 Page({...}) 在模块加载时调用全局 Page,wx 是全局对象;
 * 在 node 环境桩掉它们,即可捕获页面配置、直接驱动 onLoad/onXxx 生命周期,
 * 断言「调了哪个 API、带什么参、导航到哪个 URL」——覆盖 utils 单测
 * 与后端契约测试都照不到的「导航参数 + 页面装配」层。
 *
 * 用法（每个 spec 文件）：
 *   const mockApi = { getXxx: jest.fn(), ... };
 *   jest.mock("../../api/api", () => mockApi);
 *   const harness = installPageHarness();
 *   require("../some-page/some-page"); // 触发 Page() 捕获
 *   const page = harness.createInstance();
 */

export interface PageHarness {
  wx: Record<string, jest.Mock>;
  /** import 页面模块后,最近一个 Page({...}) 的配置对象 */
  getPageConfig: () => any;
  /** 基于捕获配置创建可驱动实例（含可断言的 setData） */
  createInstance: () => any;
}

export function installPageHarness(): PageHarness {
  const wxStub: Record<string, jest.Mock> = {
    navigateTo: jest.fn(),
    switchTab: jest.fn(),
    navigateBack: jest.fn(),
    setNavigationBarTitle: jest.fn(),
    showToast: jest.fn(),
    setStorageSync: jest.fn(),
    getStorageSync: jest.fn().mockReturnValue(""),
    stopPullDownRefresh: jest.fn(),
  };
  (globalThis as any).wx = wxStub;

  let captured: any = null;
  (globalThis as any).Page = jest.fn((config: any) => {
    captured = config;
  });

  return {
    wx: wxStub,
    getPageConfig: () => captured,
    createInstance: () => {
      if (!captured) {
        throw new Error("未捕获到 Page 配置,请先 require 页面模块");
      }
      const instance: any = Object.create(null);
      Object.assign(instance, captured);
      instance.data = JSON.parse(JSON.stringify(captured.data ?? {}));
      instance.setData = jest.fn((patch: Record<string, any>, cb?: any) => {
        for (const [key, value] of Object.entries(patch)) {
          if (key.includes(".")) {
            const [top, ...rest] = key.split(".");
            const leaf = rest.pop() as string;
            let node = instance.data[top] ?? {};
            for (const part of rest) node = node[part] ?? {};
            node[leaf] = value;
            instance.data[top] = instance.data[top] ?? node;
          } else {
            instance.data[key] = value;
          }
        }
        if (typeof cb === "function") cb();
      });
      return instance;
    },
  };
}
