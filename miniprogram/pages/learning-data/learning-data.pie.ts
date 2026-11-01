export interface PieUsageItem {
  mode: string;
  count: number;
  paintColor: string;
}

export interface PieSegment {
  mode: string;
  color: string;
  startAngle: number;
  endAngle: number;
}

/** 按上一帧的功能顺序生成目标扇区；消失项保留为零角度，新增项追加。 */
export function buildPieTarget(
  items: PieUsageItem[],
  previous: PieSegment[],
): PieSegment[] {
  const itemMap = new Map(items.map((item) => [item.mode, item]));
  const previousMap = new Map(previous.map((item) => [item.mode, item]));
  const modes = previous.map((item) => item.mode);
  for (const item of items) {
    if (!previousMap.has(item.mode)) modes.push(item.mode);
  }

  const total = items.reduce((sum, item) => sum + item.count, 0);
  let cursor = 0;
  const segments = modes.map((mode) => {
    const item = itemMap.get(mode);
    const previousSegment = previousMap.get(mode);
    const sweep = item && total > 0 ? (item.count / total) * 360 : 0;
    const segment = {
      mode,
      color: item?.paintColor || previousSegment?.color || "",
      startAngle: cursor,
      endAngle: cursor + sweep,
    };
    cursor += sweep;
    return segment;
  });

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (segments[index].endAngle > segments[index].startAngle) {
      segments[index].endAngle = 360;
      break;
    }
  }
  return segments;
}

/** 在相同功能序列上插值，新增项从零角度展开，消失项收缩后移除。 */
export function interpolatePieSegments(
  from: PieSegment[],
  to: PieSegment[],
  progress: number,
): PieSegment[] {
  const fromMap = new Map(from.map((item) => [item.mode, item]));
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return to.map((target) => {
    const origin = fromMap.get(target.mode);
    const startAngle = origin?.startAngle ?? target.startAngle;
    const endAngle = origin?.endAngle ?? target.startAngle;
    return {
      mode: target.mode,
      color: target.color,
      startAngle:
        startAngle + (target.startAngle - startAngle) * clampedProgress,
      endAngle: endAngle + (target.endAngle - endAngle) * clampedProgress,
    };
  });
}

export function visiblePieSegments(segments: PieSegment[]): PieSegment[] {
  return segments.filter((item) => item.endAngle - item.startAngle > 0.0001);
}
