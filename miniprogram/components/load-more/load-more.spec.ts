import { installComponentHarness } from "../../tests/component-harness";

describe("load-more component", () => {
  const harness = installComponentHarness();
  let instance: any;

  beforeAll(() => {
    require("./load-more");
  });

  beforeEach(() => {
    jest.useFakeTimers();
    instance = harness.createInstance();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("triggers loadmore event when tapped while not loading and has more", () => {
    instance.setData({ internalLoading: false, hasMore: true });

    instance.onTap();

    expect(instance.triggerEvent).toHaveBeenCalledWith("loadmore");
  });

  it("does not trigger loadmore while internalLoading is true", () => {
    instance.setData({ internalLoading: true, hasMore: true });

    instance.onTap();

    expect(instance.triggerEvent).not.toHaveBeenCalled();
  });

  it("does not trigger loadmore when hasMore is false", () => {
    instance.setData({ internalLoading: false, hasMore: false });

    instance.onTap();

    expect(instance.triggerEvent).not.toHaveBeenCalled();
  });

  it("enters internal loading when loading prop becomes true", () => {
    instance.observers.loading(true);

    expect(instance.data.internalLoading).toBe(true);
  });

  it("keeps internal loading for at least 400ms even if loading prop resets early", () => {
    instance.observers.loading(true);
    expect(instance.data.internalLoading).toBe(true);

    instance.observers.loading(false);
    expect(instance.data.internalLoading).toBe(true);

    jest.advanceTimersByTime(399);
    expect(instance.data.internalLoading).toBe(true);

    jest.advanceTimersByTime(2);
    expect(instance.data.internalLoading).toBe(false);
  });

  it("exits internal loading immediately when loading prop is false after 400ms", () => {
    instance.observers.loading(true);
    jest.advanceTimersByTime(400);

    instance.observers.loading(false);

    expect(instance.data.internalLoading).toBe(false);
  });

  it("clears pending timer when detached", () => {
    instance.observers.loading(true);
    instance.lifetimes.detached();

    jest.advanceTimersByTime(500);
    expect(instance.data.internalLoading).toBe(true);
  });
});
