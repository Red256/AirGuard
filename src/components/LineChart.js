import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

const PAD = { left: 40, right: 8, top: 8, bottom: 24 };

export default function LineChart({ id, values, color, yMin, yMax, yStep, xLabels, height = 150 }) {
  const [width, setWidth] = useState(0);
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;

  const top = Math.max(yMax, Math.ceil(Math.max(...values) / yStep) * yStep);
  const x = (i) => PAD.left + (i / (values.length - 1)) * innerW;
  const y = (v) => PAD.top + (1 - (v - yMin) / (top - yMin)) * innerH;

  const ticks = [];
  for (let t = yMin; t <= top; t += yStep) ticks.push(t);

  let line = '';
  values.forEach((v, i) => {
    line += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
  });
  const baseY = PAD.top + innerH;
  const area = `${line}L${x(values.length - 1).toFixed(1)} ${baseY} L${x(0).toFixed(1)} ${baseY} Z`;

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
          <Path d={area} fill={`url(#${id})`} />
          <Path d={line} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      ) : null}
    </View>
  );
}
