/**
 * 性别归一化口径：列表头像、信息页头像与文案共用同一实现。
 * 历史数据可能来自旧接口（男/女、M/F、大小写、带空格），必须全部兼容。
 */
import { normalizeChildGender } from "./child-gender";

describe("normalizeChildGender", () => {
  it("识别 male 及其历史写法", () => {
    for (const value of ["male", "Male", " m ", "M", "男"]) {
      expect(normalizeChildGender(value)).toBe("male");
    }
  });

  it("识别 female 及其历史写法", () => {
    for (const value of ["female", "Female", " f ", "F", "女"]) {
      expect(normalizeChildGender(value)).toBe("female");
    }
  });

  it("未设置或未知值一律回落 null", () => {
    for (const value of [undefined, null, "", "   ", "其他", "unknown"]) {
      expect(normalizeChildGender(value)).toBeNull();
    }
  });
});
