import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

const PAD = { left: 40, right: 8, top: 8, bottom: 24 };

// Splits the series into runs of consecutive readings. A null is a gap in the
// record - the node was offline, or that channel reported nothing - and the
// line is broken there instead of being drawn straight through it.
function segmentsOf(values) {
  const out = [];
  let run = null;
  values.forEach((v, i) => {
    if (typeof v === 'number' && isFinite(v)) {
      if (!run) {
        run = { from: i, points: [] };
        out.push(run);
      }
      run.points.push({ i, v });
    } else {
      run = null;
    }
  });
  return out.filter((s) => s.points.length > 0);
}

export default function LineChart({ id, values, color, yMin, yMax, yStep, xLabels, height = 150 }) {
  const [width, setWidth] = useState(0);
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;

  const segments = segmentsOf(values);
  const present = segments.flatMap((s) => s.points.map((p) => p.v));

  // Grow the axis to fit the data in both directions; a reading outside the
  // configured range must still land inside the plot.
  const top = present.length
    ? Math.max(yMax, Math.ceil(Math.max(...present) / yStep) * yStep)
    : yMax;
  const bottom = present.length
    ? Math.min(yMin, Math.floor(Math.min(...present) / yStep) * yStep)
    : yMin;

  const span = Math.max(1, values.length - 1);
  const x = (i) => PAD.left + (i / span) * innerW;
  const y = (v) => PAD.top + (1 - (v - bottom) / (top - bottom || 1)) * innerH;

  const ticks = [];
  for (let t = bottom; t <= top; t += yStep) ticks.push(t);

  const baseY = PAD.top + innerH;
  const paths = segments.map((s) => {
    const line = s.points
      .map((p, n) => `${n === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`)
      .join(' ');
    const first = s.points[0];
    const last = s.points[s.points.length - 1];
    // A single reading has no line to draw, so it gets no area either.
    const area =
      s.points.length > 1
        ? `${line} L${x(last.i).toFixed(1)} ${baseY} L${x(first.i).toFixed(1)} ${baseY} Z`
        : null;
    return { key: `${s.from}`, line, area, single: s.points.length === 1, cx: x(first.i), cy: y(first.v) };
  });

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.28" />
              <Stop offset="1" stopColor={color} stopOpacity="0.03" />
            </LinearGradient>
          </Defs>
          {ticks.map((t) => (
            <React.Fragment key={t}>
              <Line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#E3E8EF" strokeWidth="1" />
              <SvgText x={PAD.left - 6} y={y(t) + 4} fontSize="11" fill="#5B6B80" textAnchor="end">
                {t}
              </SvgText>
            </React.Fragment>
          ))}
          {xLabels.map((l, i) => (
            <React.Fragment key={`${l.text}-${i}`}>
              <Line x1={PAD.left + l.pos * innerW} x2={PAD.left + l.pos * innerW} y1={PAD.top} y2={baseY} stroke="#EDF1F6" strokeWidth="1" />
              <SvgText
                x={PAD.left + l.pos * innerW}
                y={height - 6}
                fontSize="11"
                fill="#5B6B80"
                textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
              >
                {l.text}
              </SvgText>
            </React.Fragment>
          ))}
          {paths.map((p) =>
            p.area ? <Path key={`a-${p.key}`} d={p.area} fill={`url(#${id})`} /> : null
          )}
          {paths.map((p) =>
            p.single ? (
              <Line
                key={`p-${p.key}`}
                x1={p.cx - 1.5}
                x2={p.cx + 1.5}
                y1={p.cy}
                y2={p.cy}
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
              />
            ) : (
              <Path
                key={`p-${p.key}`}
                d={p.line}
                stroke={color}
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )
          )}
        </Svg>
      ) : null}
    </View>
  );
}
