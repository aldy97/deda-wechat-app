import {
  buildPieTarget,
  interpolatePieSegments,
  PieSegment,
  visiblePieSegments,
} from "./learning-data.pie";

const colors = {
  a: "color-a",
  b: "color-b",
  c: "color-c",
};

function segment(
  mode: string,
  color: string,
  startAngle: number,
  endAngle: number,
): PieSegment {
  return { mode, color, startAngle, endAngle };
}

describe("learning-data pie animation", () => {
  it("builds a complete 360-degree target from raw counts", () => {
    const target = visiblePieSegments(
      buildPieTarget(
        [
          { mode: "a", count: 17, paintColor: colors.a },
          { mode: "b", count: 4, paintColor: colors.b },
        ],
        [],
      ),
    );

    expect(target).toHaveLength(2);
    expect(target[0].startAngle).toBe(0);
    expect(target[0].endAngle).toBeCloseTo((17 / 21) * 360);
    expect(target[1].endAngle).toBe(360);
  });

  it("grows new modes and interpolates existing modes without gaps", () => {
    const previous = [segment("a", colors.a, 0, 360)];
    const target = buildPieTarget(
      [
        { mode: "a", count: 1, paintColor: colors.a },
        { mode: "b", count: 1, paintColor: colors.b },
      ],
      previous,
    );

    const middle = interpolatePieSegments(previous, target, 0.5);

    expect(middle[0].endAngle).toBe(270);
    expect(middle[1].startAngle).toBe(180);
    expect(middle[1].endAngle).toBe(270);
    expect(middle[0].endAngle).toBe(middle[1].startAngle + 90);
  });

  it("keeps removed modes as zero-width targets and shrinks them smoothly", () => {
    const previous = [
      segment("a", colors.a, 0, 180),
      segment("b", colors.b, 180, 360),
    ];
    const target = buildPieTarget(
      [{ mode: "b", count: 1, paintColor: colors.b }],
      previous,
    );
    const middle = interpolatePieSegments(previous, target, 0.5);

    expect(target.map((item) => item.mode)).toEqual(["a", "b"]);
    expect(target[0].startAngle).toBe(target[0].endAngle);
    expect(middle[0].endAngle - middle[0].startAngle).toBe(90);
    expect(visiblePieSegments(target).map((item) => item.mode)).toEqual(["b"]);
  });

  it("preserves the current order when the next child has different modes", () => {
    const previous = [
      segment("a", colors.a, 0, 180),
      segment("b", colors.b, 180, 360),
    ];
    const target = buildPieTarget(
      [
        { mode: "b", count: 2, paintColor: colors.b },
        { mode: "c", count: 1, paintColor: colors.c },
      ],
      previous,
    );

    expect(target.map((item) => item.mode)).toEqual(["a", "b", "c"]);
    expect(visiblePieSegments(target)[1].endAngle).toBe(360);
  });
});
