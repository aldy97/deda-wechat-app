import { installComponentHarness } from "../../tests/component-harness";

describe("kid-gradient-bg component", () => {
  const harness = installComponentHarness();

  beforeAll(() => {
    require("./kid-gradient-bg");
  });

  it("registers as a reusable component", () => {
    const config = harness.getComponentConfig();

    expect(config).toBeTruthy();
    expect(config.properties).toBeUndefined();
  });

  it("creates an instance without runtime state", () => {
    const instance = harness.createInstance();

    expect(instance.data).toEqual({});
  });
});
