/**
 * 小程序组件装配测试基座。
 *
 * 与 page-harness 类似：在 node 环境桩掉全局 Component、wx，
 * 捕获组件配置，创建可驱动实例，用于断言组件内部状态与事件触发。
 */

export interface ComponentHarness {
  wx: Record<string, jest.Mock>;
  getComponentConfig: () => any;
  createInstance: (props?: Record<string, any>) => any;
}

export function installComponentHarness(): ComponentHarness {
  const wxStub: Record<string, jest.Mock> = {
    navigateTo: jest.fn(),
    switchTab: jest.fn(),
    navigateBack: jest.fn(),
    setNavigationBarTitle: jest.fn(),
    showToast: jest.fn(),
    setStorageSync: jest.fn(),
    getStorageSync: jest.fn().mockReturnValue(""),
    removeStorageSync: jest.fn(),
  };
  (globalThis as any).wx = wxStub;

  let captured: any = null;
  (globalThis as any).Component = jest.fn((config: any) => {
    captured = config;
  });

  return {
    wx: wxStub,
    getComponentConfig: () => captured,
    createInstance: (props?: Record<string, any>) => {
      if (!captured) {
        throw new Error("未捕获到 Component 配置,请先 require 组件模块");
      }
      const instance: any = Object.create(null);
      Object.assign(instance, captured);
      // 将 methods 中的方法展平到实例上，与小程序运行时行为一致
      if (captured.methods) {
        Object.assign(instance, captured.methods);
      }
      for (const key of Object.keys(instance)) {
        if (typeof instance[key] === "function") {
          instance[key] = instance[key].bind(instance);
        }
      }
      if (captured.observers) {
        const boundObservers: Record<string, any> = {};
        for (const key of Object.keys(captured.observers)) {
          const observer = captured.observers[key];
          boundObservers[key] =
            typeof observer === "function" ? observer.bind(instance) : observer;
        }
        instance.observers = boundObservers;
      }
      if (captured.lifetimes) {
        const boundLifetimes: Record<string, any> = {};
        for (const key of Object.keys(captured.lifetimes)) {
          const lifetime = captured.lifetimes[key];
          boundLifetimes[key] =
            typeof lifetime === "function" ? lifetime.bind(instance) : lifetime;
        }
        instance.lifetimes = boundLifetimes;
      }
      if (captured.pageLifetimes) {
        const boundPageLifetimes: Record<string, any> = {};
        for (const key of Object.keys(captured.pageLifetimes)) {
          const lifetime = captured.pageLifetimes[key];
          boundPageLifetimes[key] =
            typeof lifetime === "function" ? lifetime.bind(instance) : lifetime;
        }
        instance.pageLifetimes = boundPageLifetimes;
      }
      const propertyDefaults: Record<string, any> = {};
      for (const [key, def] of Object.entries(captured.properties ?? {})) {
        propertyDefaults[key] = (def as any)?.value;
      }
      instance.data = JSON.parse(
        JSON.stringify({ ...propertyDefaults, ...(captured.data ?? {}) }),
      );
      instance.properties = {
        ...(captured.properties ?? {}),
        ...(props ?? {}),
      };
      // 将传入的 props 值同步到 data，模拟小程序 properties 绑定行为
      for (const [key, value] of Object.entries(props ?? {})) {
        instance.data[key] = value;
      }
      instance.triggerEvent = jest.fn();
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
