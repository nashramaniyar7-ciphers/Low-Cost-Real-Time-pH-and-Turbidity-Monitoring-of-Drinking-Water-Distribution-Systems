import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { OperatingMode, PipelineNode, StandardsConfig } from '../types/water';
import { generateHistoricalSeries, HistoricalBucket } from '../engine/demoSimulator';

interface HistoricalAnalyticsViewProps {
  mode: OperatingMode;
  nodes: PipelineNode[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  standards: StandardsConfig;
  onDownloadCsv: () => void;
}

function SimpleTrendSvg({
  buckets,
  title,
  unit,
  getValue,
  threshold,
  color,
}: {
  buckets: HistoricalBucket[];
  title: string;
  unit: string;
  getValue: (b: HistoricalBucket) => number;
  threshold?: { value: number; label: string };
  color: string;
}) {
  const W = 540;
  const H = 170;
  const padL = 38;
  const padR = 14;
  const padT = 16;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const vals = buckets.map(getValue);
  const minV = Math.min(...vals, threshold ? threshold.value * 0.9 : Infinity) * 0.95;
  const maxV = Math.max(...vals, threshold ? threshold.value * 1.1 : -Infinity) * 1.05;
  const span = Math.max(0.1, maxV - minV);

  const xAt = (i: number) => padL + (buckets.length <= 1 ? plotW / 2 : (i / (buckets.length - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - ((v - minV) / span) * plotH;

  const path = buckets
    .map((b, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(getValue(b)).toFixed(1)}`)
    .join(' ');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-xs font-mono text-slate-500">{unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {[0, 0.5, 1].map((t) => {
          const y = padT + plotH * (1 - t);
          const lbl = (minV + span * t).toFixed(1);
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" />
              <text x={padL - 5} y={y + 3} textAnchor="end" className="fill-slate-400 font-mono text-[9.5px]">
                {lbl}
              </text>
            </g>
          );
        })}

        {threshold && (
          <line
            x1={padL}
            y1={yAt(threshold.value)}
            x2={W - padR}
            y2={yAt(threshold.value)}
            stroke="#dc2626"
            strokeOpacity="0.4"
            strokeDasharray="4 3"
          />
        )}

        <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />

        {buckets.length > 0 && (
          <>
            <text x={padL} y={H - 6} className="fill-slate-400 font-mono text-[9.5px]">
              {buckets[0].label}
            </text>
            <text x={W - padR} y={H - 6} textAnchor="end" className="fill-slate-400 font-mono text-[9.5px]">
              {buckets[buckets.length - 1].label}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

export function HistoricalAnalyticsView({
  mode,
  nodes,
  selectedNodeId,
  onSelectNode,
  standards,
  onDownloadCsv,
}: HistoricalAnalyticsViewProps) {
  const [timeframe, setTimeframe] = useState<'hourly' | 'daily' | 'weekly'>('hourly');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];

  const buckets = useMemo(() => {
    if (!selectedNode) return [];
    return generateHistoricalSeries(selectedNode.id, timeframe);
  }, [selectedNode, timeframe]);

  const warningTotal = buckets.reduce((acc, b) => acc + b.warningEvents, 0);
  const criticalTotal = buckets.reduce((acc, b) => acc + b.criticalEvents, 0);

  const filteredBuckets = buckets.filter(
    (b) =>
      b.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(b.phAvg).includes(searchQuery) ||
      String(b.turbidityAvg).includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Node for historical analytics"
            value={selectedNode?.id ?? ''}
            onChange={(e) => onSelectNode(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5"
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['hourly', 'daily', 'weekly'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                  timeframe === tf
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf === 'hourly' ? 'Hourly (24h)' : tf === 'daily' ? 'Daily (7d)' : 'Weekly (30d)'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="font-mono tabular-nums text-slate-600">
            Warnings: <strong className="text-amber-700">{warningTotal}</strong> · Critical:{' '}
            <strong className="text-rose-700">{criticalTotal}</strong>
            {mode === 'demo' ? ' · DEMO BASELINE' : ''}
          </span>
          <button
            type="button"
            onClick={onDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* 3 Variation Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SimpleTrendSvg
          buckets={buckets}
          title="pH Variation Trend"
          unit="pH"
          getValue={(b) => b.phAvg}
          threshold={{ value: standards.phMax, label: 'BIS Max' }}
          color="#0284c7"
        />
        <SimpleTrendSvg
          buckets={buckets}
          title="Turbidity Variation Trend"
          unit="NTU"
          getValue={(b) => b.turbidityAvg}
          threshold={{ value: standards.turbidityAcceptableMax, label: 'BIS 1.0 NTU' }}
          color="#0d9488"
        />
        <SimpleTrendSvg
          buckets={buckets}
          title="Pipeline Pressure Trend"
          unit="bar"
          getValue={(b) => b.pressureAvg}
          threshold={{ value: standards.pressureMinBar, label: 'Min Head' }}
          color="#4f46e5"
        />
      </div>

      {/* Water Quality History Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Water Quality Historical Log</h2>
            <p className="text-xs text-slate-500">
              Aggregated interval statistics for {selectedNode?.name ?? 'selected node'}
            </p>
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by time or value..."
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 w-56"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-medium">
                <th className="py-2 pr-4">Interval</th>
                <th className="py-2 px-3 text-right">pH Avg (Min–Max)</th>
                <th className="py-2 px-3 text-right">Turbidity Avg / Peak</th>
                <th className="py-2 px-3 text-right">Pressure Avg</th>
                <th className="py-2 px-3 text-right">Flow Avg</th>
                <th className="py-2 pl-3 text-right">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {filteredBuckets.map((b) => (
                <tr key={b.timestamp} className="hover:bg-slate-50">
                  <td className="py-2 pr-4 font-sans text-slate-800">{b.label}</td>
                  <td className="py-2 px-3 text-right text-slate-800">
                    {b.phAvg.toFixed(2)} ({b.phMin.toFixed(2)}–{b.phMax.toFixed(2)})
                  </td>
                  <td className="py-2 px-3 text-right text-slate-800">
                    {b.turbidityAvg.toFixed(2)} / {b.turbidityMax.toFixed(2)} NTU
                  </td>
                  <td className="py-2 px-3 text-right text-slate-800">{b.pressureAvg.toFixed(2)} bar</td>
                  <td className="py-2 px-3 text-right text-slate-800">{b.flowAvg} L/min</td>
                  <td className="py-2 pl-3 text-right">
                    {b.criticalEvents > 0 ? (
                      <span className="text-rose-700 font-semibold">✖ {b.criticalEvents} Crit</span>
                    ) : b.warningEvents > 0 ? (
                      <span className="text-amber-700 font-semibold">▲ {b.warningEvents} Warn</span>
                    ) : (
                      <span className="text-emerald-700">● Safe</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
