import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

export function CloudIcon({ size = 40, color = '#7DB8F0' }) {
  return (
    <Svg width={size} height={size * 0.7} viewBox="0 0 48 34">
      <Circle cx="14" cy="21" r="9" fill={color} />
      <Circle cx="26" cy="14" r="11" fill={color} />
      <Circle cx="37" cy="21" r="8" fill={color} />
      <Rect x="14" y="21" width="23" height="9" rx="4" fill={color} />
    </Svg>
  );
}

export function ParticlesIcon({ size = 36, color = '#5B7FA6' }) {
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { x: 24 + Math.cos(a) * 15, y: 24 + Math.sin(a) * 15, r: i % 2 === 0 ? 2.6 : 1.9 };
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={color} />
      ))}
      <Circle cx="24" cy="24" r="3.4" fill={color} />
      <Circle cx="16" cy="25" r="1.6" fill={color} />
      <Circle cx="31" cy="22" r="1.6" fill={color} />
    </Svg>
  );
}

export function SunIcon({ size = 36, color = '#F7B500' }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return {
      x1: 24 + Math.cos(a) * 14,
      y1: 24 + Math.sin(a) * 14,
      x2: 24 + Math.cos(a) * 20,
      y2: 24 + Math.sin(a) * 20,
    };
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {rays.map((r, i) => (
        <Path key={i} d={`M${r.x1} ${r.y1} L${r.x2} ${r.y2}`} stroke={color} strokeWidth="3.2" strokeLinecap="round" />
      ))}
      <Circle cx="24" cy="24" r="9.5" fill={color} />
    </Svg>
  );
}

export function ThermometerIcon({ size = 34, color = '#E53935' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="19" y="4" width="10" height="28" rx="5" fill="none" stroke={color} strokeWidth="3" />
      <Circle cx="24" cy="36" r="8" fill={color} />
      <Rect x="21.8" y="14" width="4.4" height="22" rx="2.2" fill={color} />
    </Svg>
  );
}

export function DropIcon({ size = 32, color = '#1E88E5' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24 5 C24 5 11 20 11 30 a13 13 0 0 0 26 0 C37 20 24 5 24 5 Z" fill={color} />
      <Path d="M18 31 a6 6 0 0 0 5 6" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function LeafBadge({ size = 84, color = '#2E9E4B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx="40" cy="40" r="40" fill={color} />
      <Path d="M22 56 C22 34 34 22 58 22 C58 46 46 60 22 56 Z" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round" />
      <Path d="M24 55 C32 45 42 37 52 29" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function WarningBadge({ size = 84, color = '#E53935' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle cx="40" cy="40" r="40" fill={color} />
      <G>
        <Path d="M40 17 L63 57 H17 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="6" strokeLinejoin="round" />
        <Rect x="37.5" y="29" width="5" height="16" rx="2.5" fill={color} />
        <Circle cx="40" cy="51" r="3" fill={color} />
      </G>
    </Svg>
  );
}
