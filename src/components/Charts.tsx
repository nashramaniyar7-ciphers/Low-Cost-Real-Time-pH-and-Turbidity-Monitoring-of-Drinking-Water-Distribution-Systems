import React, { useState } from 'react';
import {
  ForecastPoint,
  NodeAnalysis,
  PipelineNode,
  QualityStatus,
  SensorReading,
  StandardsConfig,
} from '../types/water';

interface GaugeArcProps {
  label: string;
  value: number | null;
  unit: string;
  min: number;
  max: number;
  safeMin?: number;
  safeMax?: number;
  status: QualityStatus;
  decimals?: number;
  subtitle?: string;
}

export function GaugeArc({
  label,
  value,
  unit,
  min,
  max,
  safeMin,
  safeMax,
  status,
  decimals = 2,
  subtitle,
}: GaugeArcProps) {
  const pct =
    value === null ? 0 : Math.min(1, Math.max(0, (value - min) / Math.max(0.0001, max - min)));
  const radius = 56;
  const cx = 74;
  const cy = 68;
  const startAngle = Math.PI;
  const endAngle = 0;

  const polar = (ratio: number) => {
    const theta = startAngle + ratio * (endAngle - startAngle);
    return {
      x: cx + radius * Math.cos(theta),
      y: cy - radius * Math.sin(theta),
    };
  };

  const arcPath = (fromRatio: number, toRatio: number) => {
    const p1 = polar(fromRatio);
    const p2 = polar(toRatio);
    const largeArc = toRatio - fromRatio > 0.5 ? 1 : 0;
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  };

  const safeStart =
    safeMin !== undefined ? Math.min(1, Math.max(0, (safeMin - min) / (max - min))) : 0;
  const safeEnd =
    safeMax !== undefined ? Math.min(1, Math.max(0, (safeMax - min) / (max - min))) : 1;

  const strokeColor =
    status === 'critical' ? '#dc2626' : status === 'warning' ? '#d97706' : '#0284c7';

  const needleTip = polar(pct);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span
          className={`text-xs font-semibold ${
            status === 'critical'
              ? 'text-rose-700'
              : status === 'warning'
              ? 'text-amber-700'
              : 'text-emerald-700'
          }`}
        >
          {status === 'critical' ? '✖ Critical' : status === 'warning' ? '▲ Warning' : '● Safe'}
        </span>
      </div>

      <div className="flex flex-col items-center my-2">
        <svg viewBox="0 0 148 84" className="w-40 h-24 overflow-visible" role="img" aria-label={`${label} gauge`}>
          {/* Track */}
          <path
            d={arcPath(0, 1)}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Safe zone marker */}
          {safeEnd > safeStart && (
            <path
              d={arcPath(safeStart, safeEnd)}
              fill="none"
              stroke="#ccfbf1"
              strokeWidth="8"
              strokeLinecap="butt"
            />
          )}
          {/* Active value arc */}
          {value !== null && pct > 0.01 && (
            <path
              d={arcPath(0, pct)}
              fill="none"
              stroke={strokeColor}
              strokeWidth="8"
              strokeLinecap="round"
            />
          )}
          {/* Needle dot */}
          {value !== null && (
            <circle
              cx={needleTip.x}
              cy={needleTip.y}
              r="4.5"
              fill="#ffffff"
              stroke={strokeColor}
              strokeWidth="2.5"
            />
          )}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            className="fill-slate-900 font-mono font-bold text-[18px] tabular-nums"
          >
            {value === null ? 'N/A' : value.toFixed(decimals)}
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            className="fill-slate-400 font-mono text-[10px]"
          >
            {unit}
          </text>
        </svg>
      </div>

      {subtitle && <p className="text-[11px] text-slate-500 font-mono tabular-nums text-center">{subtitle}</p>}
    </div>
  );
}

interface TelemetryChartProps {
  readings: SensorReading[];
  standards: StandardsConfig;
  mode: 'quality' | 'hydraulics';
  forecast?: ForecastPoint[];
  height?: number;
}

export function TelemetryChart({
  readings,
  standards,
  mode,
  forecast = [],
  height = 240,
}: TelemetryChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const data = readings.slice(-36);
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
        No telemetry packets received yet.
      </div>
    );
  }

  const W = 720;
  const H = height;
  const padL = 44;
  const padR = 44;
  const padT = 18;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const totalPoints = data.length + forecast.length;
  const xForIdx = (i: number) =>
    padL + (totalPoints <= 1 ? plotW / 2 : (i / (totalPoints - 1)) * plotW);

  // Axis ranges
  const leftMin = mode === 'quality' ? 5.0 : 0;
  const leftMax = mode === 'quality' ? 10.0 : 5.5;
  const rightMin = 0;
  const rightMax =
    mode === 'quality'
      ? Math.max(6.5, ...data.map((d) => d.turbidity * 1.15), ...forecast.map((f) => f.turbidityUpper * 1.1))
      : Math.max(400, ...data.map((d) => (d.flowRate ?? 0) * 1.15));

  const yLeft = (val: number) => {
    const clamped = Math.min(leftMax, Math.max(leftMin, val));
    return padT + plotH - ((clamped - leftMin) / (leftMax - leftMin)) * plotH;
  };
  const yRight = (val: number) => {
    const clamped = Math.min(rightMax, Math.max(rightMin, val));
    return padT + plotH - ((clamped - rightMin) / (rightMax - rightMin)) * plotH;
  };

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const leftPts = data.map((d, i) => ({
    x: xForIdx(i),
    y: yLeft(mode === 'quality' ? d.ph : d.pressure ?? 0),
  }));

  const rightPts = data.map((d, i) => ({
    x: xForIdx(i),
    y: yRight(mode === 'quality' ? d.turbidity : d.flowRate ?? 0),
  }));

  const forecastPhPts =
    mode === 'quality' && forecast.length > 0
      ? [
          leftPts[leftPts.length - 1],
          ...forecast.map((f, idx) => ({
            x: xForIdx(data.length + idx),
            y: yLeft(f.phProjected),
          })),
        ]
      : [];

  const forecastTurbPts =
    mode === 'quality' && forecast.length > 0
      ? [
          rightPts[rightPts.length - 1],
          ...forecast.map((f, idx) => ({
            x: xForIdx(data.length + idx),
            y: yRight(f.turbidityProjected),
          })),
        ]
      : [];

  const activePoint = hoverIndex !== null && hoverIndex < data.length ? data[hoverIndex] : null;
  const activeForecast =
    hoverIndex !== null && hoverIndex >= data.length ? forecast[hoverIndex - data.length] : null;

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto cursor-crosshair"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * W;
          const ratio = Math.min(1, Math.max(0, (relX - padL) / plotW));
          const idx = Math.round(ratio * (totalPoints - 1));
          setHoverIndex(idx);
        }}
      >
        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + plotH * (1 - t);
          const leftVal = (leftMin + (leftMax - leftMin) * t).toFixed(1);
          const rightVal = (rightMin + (rightMax - rightMin) * t).toFixed(mode === 'quality' ? 1 : 0);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-slate-400 font-mono text-[10px]">
                {leftVal}
              </text>
              <text x={W - padR + 6} y={y + 3} textAnchor="start" className="fill-slate-400 font-mono text-[10px]">
                {rightVal}
              </text>
            </g>
          );
        })}

        {/* BIS / Threshold Reference Lines */}
        {mode === 'quality' && (
          <>
            <line
              x1={padL}
              y1={yLeft(standards.phMax)}
              x2={W - padR}
              y2={yLeft(standards.phMax)}
              stroke="#0284c7"
              strokeOpacity="0.35"
              strokeDasharray="4 4"
            />
            <line
              x1={padL}
              y1={yLeft(standards.phMin)}
              x2={W - padR}
              y2={yLeft(standards.phMin)}
              stroke="#0284c7"
              strokeOpacity="0.35"
              strokeDasharray="4 4"
            />
            <line
              x1={padL}
              y1={yRight(standards.turbidityAcceptableMax)}
              x2={W - padR}
              y2={yRight(standards.turbidityAcceptableMax)}
              stroke="#0d9488"
              strokeOpacity="0.45"
              strokeDasharray="2 3"
            />
          </>
        )}

        {/* Forecast divider */}
        {forecast.length > 0 && (
          <line
            x1={xForIdx(data.length - 1)}
            y1={padT}
            x2={xForIdx(data.length - 1)}
            y2={H - padB}
            stroke="#94a3b8"
            strokeDasharray="3 3"
          />
        )}

        {/* Primary curves */}
        <path d={buildPath(leftPts)} fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinejoin="round" />
        <path d={buildPath(rightPts)} fill="none" stroke="#0d9488" strokeWidth="2" strokeLinejoin="round" />

        {/* Experimental forecast curves */}
        {forecastPhPts.length > 1 && (
          <path
            d={buildPath(forecastPhPts)}
            fill="none"
            stroke="#0284c7"
            strokeWidth="1.8"
            strokeDasharray="5 4"
          />
        )}
        {forecastTurbPts.length > 1 && (
          <path
            d={buildPath(forecastTurbPts)}
            fill="none"
            stroke="#0d9488"
            strokeWidth="1.8"
            strokeDasharray="5 4"
          />
        )}

        {/* Hover crosshair */}
        {hoverIndex !== null && (
          <g>
            <line
              x1={xForIdx(hoverIndex)}
              y1={padT}
              x2={xForIdx(hoverIndex)}
              y2={H - padB}
              stroke="#475569"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {hoverIndex < data.length && (
              <>
                <circle cx={leftPts[hoverIndex].x} cy={leftPts[hoverIndex].y} r="4" fill="#0284c7" stroke="#fff" strokeWidth="1.5" />
                <circle cx={rightPts[hoverIndex].x} cy={rightPts[hoverIndex].y} r="4" fill="#0d9488" stroke="#fff" strokeWidth="1.5" />
              </>
            )}
          </g>
        )}

        {/* Axis titles */}
        <text x={padL} y={H - 6} className="fill-slate-400 font-mono text-[10px]">
          {new Date(data[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </text>
        <text x={W - padR} y={H - 6} textAnchor="end" className="fill-slate-400 font-mono text-[10px]">
          {forecast.length > 0
            ? 'Experimental +60m Forecast →'
            : new Date(data[data.length - 1].timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
        </text>
      </svg>

      {/* Legend & Live Crosshair HUD */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-sky-600 inline-block" />
            <span>{mode === 'quality' ? 'pH (left axis)' : `Pressure (${standards.pressureUnit}, left)`}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-teal-600 inline-block" />
            <span>{mode === 'quality' ? 'Turbidity NTU (right axis)' : 'Flow Rate L/min (right)'}</span>
          </span>
          {forecast.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="w-3 border-t border-dashed border-slate-500 inline-block" />
              <span>Experimental projection</span>
            </span>
          )}
        </div>

        <div className="font-mono tabular-nums text-[11px] text-slate-700 min-h-[18px]">
          {activePoint ? (
            mode === 'quality' ? (
              <span>
                {new Date(activePoint.timestamp).toLocaleTimeString()} · pH {activePoint.ph.toFixed(2)} ·{' '}
                {activePoint.turbidity.toFixed(2)} NTU · {activePoint.temperature.toFixed(1)}°C
              </span>
            ) : (
              <span>
                {new Date(activePoint.timestamp).toLocaleTimeString()} ·{' '}
                {activePoint.pressure === null ? 'N/A' : `${activePoint.pressure.toFixed(2)} bar`} ·{' '}
                {activePoint.flowRate === null ? 'N/A' : `${activePoint.flowRate.toFixed(0)} L/min`}
              </span>
            )
          ) : activeForecast ? (
            <span>
              Forecast {activeForecast.label}: pH {activeForecast.phProjected.toFixed(2)} ·{' '}
              {activeForecast.turbidityProjected.toFixed(2)} NTU
            </span>
          ) : (
            <span className="text-slate-400">Hover chart to inspect exact readings</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ComparisonChartProps {
  nodes: PipelineNode[];
  metric: 'ph' | 'turbidity' | 'pressure';
}

const NODE_COLORS = ['#0284c7', '#0d9488', '#6366f1', '#d97706'];

export function ComparisonChart({ nodes, metric }: ComparisonChartProps) {
  const W = 680;
  const H = 200;
  const padL = 42;
  const padR = 16;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const seriesList = nodes.map((n) => n.history.slice(-24));
  const maxLen = Math.max(1, ...seriesList.map((s) => s.length));

  const minVal = metric === 'ph' ? 5.5 : 0;
  const maxVal =
    metric === 'ph'
      ? 9.5
      : metric === 'turbidity'
      ? Math.max(3.0, ...seriesList.flat().map((r) => r.turbidity * 1.15))
      : 4.5;

  const xAt = (idx: number) => padL + (maxLen <= 1 ? plotW / 2 : (idx / (maxLen - 1)) * plotW);
  const yAt = (val: number) => {
    const c = Math.min(maxVal, Math.max(minVal, val));
    return padT + plotH - ((c - minVal) / (maxVal - minVal)) * plotH;
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {[0, 0.5, 1].map((t) => {
          const y = padT + plotH * (1 - t);
          const v = (minVal + (maxVal - minVal) * t).toFixed(1);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-slate-400 font-mono text-[10px]">
                {v}
              </text>
            </g>
          );
        })}

        {nodes.map((node, nIdx) => {
          const hist = node.history.slice(-24);
          if (hist.length === 0) return null;
          const pts = hist
            .map((r, i) => {
              const v =
                metric === 'ph' ? r.ph : metric === 'turbidity' ? r.turbidity : r.pressure ?? 0;
              return `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`;
            })
            .join(' ');
          return (
            <path
              key={node.id}
              d={pts}
              fill="none"
              stroke={NODE_COLORS[nIdx % NODE_COLORS.length]}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
        {nodes.map((node, idx) => (
          <span key={node.id} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm inline-block"
              style={{ backgroundColor: NODE_COLORS[idx % NODE_COLORS.length] }}
            />
            <span>{node.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface PipelineSchematicProps {
  nodes: PipelineNode[];
  analyses: Record<string, NodeAnalysis>;
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
}

export function PipelineSchematic({
  nodes,
  analyses,
  selectedNodeId,
  onSelectNode,
}: PipelineSchematicProps) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const positions: Record<string, { x: number; y: number }> = {
    'node-a': { x: 140, y: 110 },
    'node-b': { x: 360, y: 110 },
    'node-c': { x: 580, y: 55 },
    'node-d': { x: 580, y: 165 },
  };

  const statusColor = (id: string) => {
    const n = byId[id];
    const a = analyses[id];
    if (!n || n.connectivity === 'disconnected') return '#64748b';
    if (!a) return '#0284c7';
    if (a.overallStatus === 'critical') return '#dc2626';
    if (a.overallStatus === 'warning') return '#d97706';
    return '#0d9488';
  };

  const renderEdge = (fromId: string, toId: string, x1: number, y1: number, x2: number, y2: number) => {
    const targetAnalysis = analyses[toId];
    const leak = targetAnalysis?.suspectedLeakage;
    return (
      <g key={`${fromId}-${toId}`}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={leak ? '#dc2626' : '#cbd5e1'}
          strokeWidth={leak ? '4' : '3'}
          strokeDasharray={leak ? '6 4' : undefined}
        />
        {leak && (
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 - 8}
            textAnchor="middle"
            className="fill-rose-700 font-mono text-[10px] font-semibold"
          >
            Suspected Leak Segment
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Distribution Network Hydraulic Schematic</h3>
          <p className="text-xs text-slate-500">Click any monitoring point to inspect sensor telemetry and leakage status.</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" /> Safe
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" /> Warning
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" /> Critical / Suspected Leak
          </span>
        </div>
      </div>

      <svg viewBox="0 0 740 225" className="w-full h-auto bg-slate-50/60 rounded-lg border border-slate-100">
        {/* Source Tank */}
        <rect x="20" y="82" width="68" height="56" rx="6" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />
        <text x="54" y="108" textAnchor="middle" className="fill-sky-900 text-[10px] font-semibold">
          WTP Clear
        </text>
        <text x="54" y="121" textAnchor="middle" className="fill-sky-700 text-[10px]">
          Sump
        </text>

        {/* Pipes */}
        <line x1="88" y1="110" x2="140" y2="110" stroke="#94a3b8" strokeWidth="3" />
        {renderEdge('node-a', 'node-b', 140, 110, 360, 110)}
        {renderEdge('node-b', 'node-c', 360, 110, 580, 55)}
        {renderEdge('node-b', 'node-d', 360, 110, 580, 165)}

        {/* Render Nodes */}
        {nodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;
          const color = statusColor(node.id);
          const isSelected = selectedNodeId === node.id;
          const r = node.currentReading;

          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onClick={() => onSelectNode(node.id)}
            >
              {isSelected && (
                <circle cx={pos.x} cy={pos.y} r="26" fill="none" stroke="#0284c7" strokeWidth="2" strokeDasharray="3 2" />
              )}
              <circle cx={pos.x} cy={pos.y} r="18" fill="#ffffff" stroke={color} strokeWidth="3" />
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" className="fill-slate-900 font-mono text-[10px] font-bold">
                {node.id.replace('node-', '').toUpperCase()}
              </text>

              {/* Node Card Label */}
              <rect
                x={pos.x - 68}
                y={pos.y + 24}
                width="136"
                height="34"
                rx="6"
                fill="#ffffff"
                stroke={isSelected ? '#0284c7' : '#e2e8f0'}
              />
              <text x={pos.x} y={pos.y + 38} textAnchor="middle" className="fill-slate-800 text-[10px] font-semibold">
                {node.name.split('·')[1]?.trim() ?? node.name}
              </text>
              <text x={pos.x} y={pos.y + 51} textAnchor="middle" className="fill-slate-500 font-mono text-[9.5px] tabular-nums">
                {node.connectivity === 'disconnected'
                  ? 'OFFLINE'
                  : `pH ${r.ph.toFixed(1)} · ${r.turbidity.toFixed(1)} NTU · ${r.pressure !== null ? `${r.pressure.toFixed(1)} bar` : 'N/A'}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
