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
    reLaunch: jest.fn(),
    setNavigationBarTitle: jest.fn(),
    showToast: jest.fn(),
    showModal: jest.fn(),
    createSelectorQuery: jest.fn(),
    setStorageSync: jest.fn(),
    getStorageSync: jest.fn().mockReturnValue(""),
    removeStorageSync: jest.fn(),
    stopPullDownRefresh: jest.fn(),
    // 默认开发版环境（dev 门控的联调行为默认开启，单测可按需覆盖返回值）
    getAccountInfoSync: jest
      .fn()
      .mockReturnValue({ miniProgram: { envVersion: "develop" } }),
  };
  wxStub.createSelectorQuery.mockImplementation(() => {
    const query: any = {
      in: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      boundingClientRect: jest.fn().mockReturnThis(),
      fields: jest.fn().mockReturnThis(),
      exec: jest.fn().mockReturnThis(),
    };
    return query;
  });
  (globalThis as any).wx = wxStub;

  let captured: any = null;
  (globalThis as any).Page = jest.fn((config: any) => {
    captured = config;
  });
  // 页面栈桩：默认栈内有一层以上（navigateBack 可用），用例可覆盖
  (globalThis as any).getCurrentPages = jest.fn(() => [{}]);

  return {
    wx: wxStub,
    getPageConfig: () => captured,
    createInstance: () => {
      if (!captured) {
        throw new Error("未捕获到 Page 配置,请先 require 页面模块");
      }
      const instance: any = Object.create(null);
      Object.assign(instance, captured);
      // 绑定所有方法到实例，确保异步/嵌套调用中 this 始终指向 instance
      for (const key of Object.keys(instance)) {
        if (typeof instance[key] === "function") {
          instance[key] = instance[key].bind(instance);
        }
      }
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
