import { useCountUp } from '@/components/CountUp';

interface Props {
  percent: number;
  // Remembers the last value shown so the ring only animates when it changes.
  animateKey?: string;
  size?: number;
  stroke?: number;
  trackColor?: string;
  fillColor?: string;
  textColor?: string;
}

export default function ProgressRing({ percent, animateKey, size = 64, stroke = 6, trackColor = 'rgba(255,255,255,0.28)', fillColor = '#ffffff', textColor = '#ffffff' }: Props) {
  const r = (size - stroke) / 2;
  const c = r * 2 * Math.PI;
  const animated = useCountUp(percent, animateKey);
  const clamped = Math.max(0, Math.min(100, animated));
  const offset = c * (1 - clamped / 100);
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={center} cy={center} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={center} cy={center} r={r} fill="none" stroke={fillColor} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text x={center} y={center + size * 0.055} textAnchor="middle" fontSize={size * 0.23} fontWeight={800} fill={textColor} fontFamily="system-ui, -apple-system, sans-serif">
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}
