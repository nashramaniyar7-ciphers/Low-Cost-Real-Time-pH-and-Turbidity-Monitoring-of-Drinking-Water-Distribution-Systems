import React, { useState } from 'react';
import { Sliders, TrendingUp } from 'lucide-react';
import {
  NodeAnalysis,
  OperatingMode,
  PipelineNode,
  SensorReading,
  StandardsConfig,
} from '../types/water';
import { computeExperimentalForecast, formatPressure } from '../engine/waterAnalysis';
import { ComparisonChart, TelemetryChart } from './Charts';
import { ConnectivityLabel, QualityStatusLabel } from './StatusText';

interface LiveMonitoringViewProps {
  mode: OperatingMode;
  nodes: PipelineNode[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  analyses: Record<string, NodeAnalysis>;
  standards: StandardsConfig;
  onInjectManualReading: (nodeId: string, reading: Partial<SensorReading>) => void;
}

export function LiveMonitoringView({
  mode,
  nodes,
  selectedNodeId,
  onSelectNode,
  analyses,
  standards,
  onInjectManualReading,
}: LiveMonitoringViewProps) {
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];
  const [compareMetric, setCompareMetric] = useState<'ph' | 'turbidity' | 'pressure'>('turbidity');

  const [manualPh, setManualPh] = useState<string>('7.20');
  const [manualTurb, setManualTurb] = useState<string>('0.60');
  const [manualTemp, setManualTemp] = useState<string>('24.0');
  const [manualPress, setManualPress] = useState<string>('2.60');
  const [manualFlow, setManualFlow] = useState<string>('180');
  const [injectFeedback, setInjectFeedback] = useState<string | null>(null);

  if (!selectedNode) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
        No live hardware nodes connected yet. Post telemetry to <code className="font-mono">/api/sensors/ingest</code> or switch to Demonstration Mode.
      </div>
    );
  }

  const forecast = computeExperimentalForecast(selectedNode.history);
  const analysis = analyses[selectedNode.id];

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ph = parseFloat(manualPh);
    const turb = parseFloat(manualTurb);
    const temp = parseFloat(manualTemp);
    const press = parseFloat(manualPress);
    const flow = parseFloat(manualFlow);
    if (Number.isNaN(ph) || Number.isNaN(turb) || Number.isNaN(temp)) return;

    onInjectManualReading(selectedNode.id, {
      ph: Math.min(14, Math.max(0, ph)),
      turbidity: Math.max(0, turb),
      temperature: temp,
      pressure: Number.isNaN(press) ? null : Math.max(0, press),
      flowRate: Number.isNaN(flow) ? null : Math.max(0, flow),
      source: 'manual',
    });
    setInjectFeedback(`Injected manual reading into ${selectedNode.name} at ${new Date().toLocaleTimeString()}.`);
    setTimeout(() => setInjectFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Dual Live Graphs + Experimental Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Live Multi-Parameter Stream & Experimental Trend Projection
                {mode === 'demo' && <span className="ml-2 text-xs font-mono text-sky-700">· DEMO DATA</span>}
              </h2>
              <p className="text-xs text-slate-500">
                Inspecting {selectedNode.name} · <QualityStatusLabel status={analysis.overallStatus} />
              </p>
            </div>
            <select
              aria-label="Select node for live telemetry"
              value={selectedNode.id}
              onChange={(e) => onSelectNode(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <TelemetryChart
            readings={selectedNode.history}
            standards={standards}
            mode="quality"
            forecast={forecast}
            height={230}
          />

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-700 mb-2">Hydraulic Pressure & Flow Rate</h3>
            <TelemetryChart readings={selectedNode.history} standards={standards} mode="hydraulics" height={175} />
          </div>
        </div>

        {/* Manual Sensor Input + Experimental Forecast Table */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-sky-700" />
              <h3 className="text-sm font-semibold text-slate-900">Manual Sensor Input (Testing)</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Inject custom readings directly into <span className="font-medium text-slate-700">{selectedNode.name}</span> to test threshold and anomaly triggers.
            </p>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">pH (0–14)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="14"
                    value={manualPh}
                    onChange={(e) => setManualPh(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Turbidity (NTU)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="500"
                    value={manualTurb}
                    onChange={(e) => setManualTurb(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={manualTemp}
                    onChange={(e) => setManualTemp(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Pressure (bar)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={manualPress}
                    onChange={(e) => setManualPress(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Flow Rate (L/min)</label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  value={manualFlow}
                  onChange={(e) => setManualFlow(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 text-xs font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors cursor-pointer"
              >
                Inject Test Reading
              </button>
              {injectFeedback && <p className="text-xs text-teal-700 font-medium">{injectFeedback}</p>}
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-700" />
                <h3 className="text-sm font-semibold text-slate-900">Experimental Trend Projection</h3>
              </div>
            </div>
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
              Experimental linear-slope statistical projection from the last 12 packets. Not a deterministic hydraulic or chemical guarantee.
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1.5 text-left">Horizon</th>
                  <th className="py-1.5 text-right">Est. pH</th>
                  <th className="py-1.5 text-right">Est. Turbidity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {forecast.map((f) => (
                  <tr key={f.offsetMinutes}>
                    <td className="py-1.5 text-slate-700">{f.label}</td>
                    <td className="py-1.5 text-right text-slate-900">{f.phProjected.toFixed(2)}</td>
                    <td className="py-1.5 text-right text-slate-900">{f.turbidityProjected.toFixed(2)} NTU</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Multi-Location Comparative Analysis */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Multi-Location Comparative Analysis</h2>
            <p className="text-xs text-slate-500">
              Compare spatial water quality drift from the clear-water outlet downstream toward tail-end nodes.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ph', 'turbidity', 'pressure'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCompareMetric(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  compareMetric === m
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m === 'ph' ? 'pH Level' : m === 'turbidity' ? 'Turbidity (NTU)' : 'Pressure (bar)'}
              </button>
            ))}
          </div>
        </div>

        <ComparisonChart nodes={nodes} metric={compareMetric} />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-200">
          {nodes.map((node) => {
            const nr = node.currentReading;
            const na = analyses[node.id];
            return (
              <div key={node.id} className="text-xs space-y-1">
                <div className="font-semibold text-slate-900 truncate">{node.name}</div>
                <div className="flex items-center justify-between text-slate-600 font-mono tabular-nums">
                  <span>pH {nr.ph.toFixed(2)}</span>
                  <span>{nr.turbidity.toFixed(2)} NTU</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 font-mono tabular-nums">
                  <span>{formatPressure(nr.pressure, standards.pressureUnit)}</span>
                  <span>{nr.flowRate ?? 'N/A'} L/m</span>
                </div>
                <div className="pt-1 flex items-center justify-between">
                  <QualityStatusLabel status={na.overallStatus} />
                  <ConnectivityLabel status={node.connectivity} isLiveStream={mode === 'live'} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
