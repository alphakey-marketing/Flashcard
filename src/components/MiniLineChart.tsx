import React, { CSSProperties } from 'react';

interface MiniLineChartProps {
  values: number[];
  labels: string[];
  color?: string;
  height?: number;
}

/** Dependency-free inline SVG line chart — avoids pulling in a charting library for one small graph. */
const MiniLineChart: React.FC<MiniLineChartProps> = ({ values, labels, color = '#3b82f6', height = 120 }) => {
  if (values.length === 0) {
    return <div style={styles.empty}>Not enough data yet.</div>;
  }

  const width = 100; // percentage-based viewBox, scales to container via CSS width: 100%
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = values.length === 1 ? 0 : (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const first = labels[0];
  const last = labels[labels.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ ...styles.svg, height }}>
        <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          const [x, y] = p.split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r={1.2} fill={color} />;
        })}
      </svg>
      <div style={styles.labels}>
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  svg: {
    width: '100%',
    display: 'block',
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  empty: {
    fontSize: '13px',
    color: '#94a3b8',
    textAlign: 'center',
    padding: '24px 0',
  },
};

export default MiniLineChart;
