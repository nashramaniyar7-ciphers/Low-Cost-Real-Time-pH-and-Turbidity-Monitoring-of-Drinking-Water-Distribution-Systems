import React, { useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Cpu, Layers, ShieldAlert, Sparkles } from 'lucide-react';
import {
  AIAnalysisResponse,
  NavSection,
  NodeAnalysis,
  OperatingMode,
  PipelineNode,
  StandardsConfig,
  WaterAlert,
} from '../types/water';
import { formatPressure } from '../engine/waterAnalysis';
import { GaugeArc, TelemetryChart } from './Charts';
import { ConnectivityLabel, QualityStatusLabel } from './StatusText';

interface OverviewDashboardProps {
  mode: OperatingMode;
  nodes: PipelineNode[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  analyses: Record<string, NodeAnalysis>;
  standards: StandardsConfig;
  activeAlerts: WaterAlert[];
  onNavigate: (section: NavSection) => void;
  aiAnalysis: AIAnalysisResponse | null;
  aiLoading: boolean;
  aiError: string | null;
  onRunAiAnalysis: (node: PipelineNode) => void;
}

export function OverviewDashboard({
  mode,
  nodes,
  selectedNodeId,
  onSelectNode,
  analyses,
  standards,
  activeAlerts,
  onNavigate,
  aiAnalysis,
  aiLoading,
  aiError,
  onRunAiAnalysis,
}: OverviewDashboardProps) {
  const [chartMode, setChartMode] = useState<'quality' | 'hydraulics'>('quality');

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];
  if (!selectedNode) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Waiting for Live Hardware Telemetry</h2>
        <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2">
          Live Sensor Mode is active, and no ESP32 or MQTT bridge packets have been posted to{' '}
          <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">/api/sensors/ingest</code> yet.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('sensors')}
            className="px-4 py-2 text-xs font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors cursor-pointer"
          >
            Open Hardware Integration & Test Sender
          </button>
        </div>
      </div>
    );
  }

  const analysis = analyses[selectedNode.id];
  const r = selectedNode.currentReading;
  const assessMap = Object.fromEntries(analysis.assessments.map((a) => [a.parameter, a]));

  const pressureDisplayValue =
    r.pressure === null
      ? null
      : standards.pressureUnit === 'psi'
      ? Number((r.pressure * 14.5038).toFixed(1))
      : r.pressure;

  return (
    <div className="space-y-6">
      {/* Node Selector & Context Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="overview-node-select" className="text-xs font-medium text-slate-500">
            Monitoring Point
          </label>
          <select
            id="overview-node-select"
            value={selectedNode.id}
            onChange={(e) => onSelectNode(e.target.value)}
            className="text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500 hidden sm:inline">
            {selectedNode.zone} · {selectedNode.pipeDiameterMm} mm {selectedNode.material}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Node Status:</span>
            <QualityStatusLabel status={analysis.overallStatus} />
          </div>
          <span className="text-slate-300" aria-hidden="true">|</span>
          <ConnectivityLabel status={selectedNode.connectivity} isLiveStream={mode === 'live'} />
          <span className="text-slate-300" aria-hidden="true">|</span>
          <span className="font-mono tabular-nums text-slate-600">
            Updated {new Date(r.timestamp).toLocaleTimeString()}
            {mode === 'demo' ? ' · DEMO DATA' : ''}
          </span>
        </div>
      </div>

      {/* 5-Parameter Real-Time Gauge Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <GaugeArc
          label="pH Level"
          value={r.ph}
          unit="pH"
          min={4.5}
          max={10.5}
          safeMin={standards.phMin}
          safeMax={standards.phMax}
          status={assessMap.ph?.status ?? 'safe'}
          decimals={2}
          subtitle={`BIS IS 10500: ${standards.phMin}–${standards.phMax}`}
        />
        <GaugeArc
          label="Turbidity"
          value={r.turbidity}
          unit="NTU"
          min={0}
          max={8}
          safeMin={0}
          safeMax={standards.turbidityAcceptableMax}
          status={assessMap.turbidity?.status ?? 'safe'}
          decimals={2}
          subtitle={`BIS Max: ${standards.turbidityAcceptableMax.toFixed(1)} (Perm ${standards.turbidityPermissibleMax.toFixed(1)})`}
        />
        <GaugeArc
          label="Water Temperature"
          value={r.temperature}
          unit="°C"
          min={5}
          max={45}
          safeMin={10}
          safeMax={standards.tempOperationalMax}
          status={assessMap.temperature?.status ?? 'safe'}
          decimals={1}
          subtitle={`Operational ≤ ${standards.tempOperationalMax.toFixed(0)}°C`}
        />
        <GaugeArc
          label="Pipeline Pressure"
          value={pressureDisplayValue}
          unit={standards.pressureUnit}
          min={0}
          max={standards.pressureUnit === 'psi' ? 80 : 5.5}
          safeMin={standards.pressureUnit === 'psi' ? standards.pressureMinBar * 14.5038 : standards.pressureMinBar}
          safeMax={standards.pressureUnit === 'psi' ? standards.pressureMaxBar * 14.5038 : standards.pressureMaxBar}
          status={assessMap.pressure?.status ?? 'safe'}
          decimals={standards.pressureUnit === 'psi' ? 1 : 2}
          subtitle={`Target: ${assessMap.pressure?.expectedRange ?? '1.5–4.5 bar'}`}
        />
        <GaugeArc
          label="Flow Rate"
          value={r.flowRate}
          unit="L/min"
          min={0}
          max={450}
          safeMin={standards.flowMinLpm}
          safeMax={standards.flowMaxLpm}
          status={assessMap.flowRate?.status ?? 'safe'}
          decimals={0}
          subtitle={`Envelope: ${standards.flowMinLpm}–${standards.flowMaxLpm} L/min`}
        />
      </div>

      {/* Main Chart + Early Warning / AI Insights Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Real-Time Distribution Telemetry
                {mode === 'demo' && (
                  <span className="ml-2 text-xs font-mono font-medium text-sky-700">· DEMO DATA</span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                Dashed lines indicate BIS IS 10500 acceptable pH (6.5–8.5) and turbidity (1.0 NTU) limits.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setChartMode('quality')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'quality'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                pH & Turbidity
              </button>
              <button
                type="button"
                onClick={() => setChartMode('hydraulics')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'hydraulics'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pressure & Flow
              </button>
            </div>
          </div>

          <TelemetryChart readings={selectedNode.history} standards={standards} mode={chartMode} />
        </div>

        {/* Intelligent Anomaly & Recommendation Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Early-Warning & Actionable Insights</h2>
              <p className="text-xs text-slate-500">Rule-based screening + optional AI root-cause module</p>
            </div>
            <button
              type="button"
              onClick={() => onRunAiAnalysis(selectedNode)}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiLoading ? 'Analyzing...' : 'Run AI Assessment'}</span>
            </button>
          </div>

          {/* Anomalies detected */}
          <div className="divide-y divide-slate-100">
            {analysis.anomalies.length === 0 ? (
              <div className="py-3 text-xs text-slate-600">
                No sudden fluctuations, rate-of-change spikes, or multi-parameter correlations detected on{' '}
                <span className="font-medium text-slate-900">{selectedNode.name}</span>.
              </div>
            ) : (
              analysis.anomalies.map((anom) => (
                <div key={anom.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">{anom.title}</span>
                    <span
                      className={`text-xs font-semibold ${
                        anom.severity === 'critical' ? 'text-rose-700' : 'text-amber-700'
                      }`}
                    >
                      {anom.severity === 'critical' ? '✖ Critical' : '▲ Warning'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{anom.description}</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">{anom.confidenceNote}</p>
                </div>
              ))
            )}
          </div>

          {/* Smart Recommendation Engine */}
          <div className="pt-3 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-700 mb-2">Recommended Operational Steps</h3>
            <div className="space-y-2.5">
              {analysis.recommendations.slice(0, 3).map((rec) => (
                <div key={rec.id} className="text-xs">
                  <p className="font-medium text-slate-900">{rec.title}</p>
                  <p className="text-slate-600 mt-0.5">{rec.action}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">
              Scientific note: pH and turbidity sensors provide rapid physical-chemical screening and cannot alone confirm the presence or identity of pathogens or specific chemical contaminants.
            </p>
          </div>

          {/* AI Response / Error Display */}
          {aiError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              {aiError}
            </div>
          )}
          {aiAnalysis && (
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-800">AI Engineering Assessment</span>
                <span className="text-[11px] font-mono text-slate-400">{aiAnalysis.modelUsed}</span>
              </div>
              <p className="text-xs text-slate-700">{aiAnalysis.summary}</p>
              {aiAnalysis.hypotheses.length > 0 && (
                <ul className="list-disc pl-4 text-xs text-slate-600 space-y-0.5">
                  {aiAnalysis.hypotheses.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-slate-500 italic">{aiAnalysis.limitationsNote}</p>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Location Summary Table + Active Alert Link */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Distribution Network Overview</h2>
            <p className="text-xs text-slate-500">
              Live comparison across {nodes.length} pipeline monitoring nodes · {activeAlerts.length} active alert(s)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-800 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Open Alert Centre ({activeAlerts.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-4">Monitoring Node</th>
                <th className="py-2.5 px-3 text-right">pH</th>
                <th className="py-2.5 px-3 text-right">Turbidity</th>
                <th className="py-2.5 px-3 text-right">Temp</th>
                <th className="py-2.5 px-3 text-right">Pressure</th>
                <th className="py-2.5 px-3 text-right">Flow</th>
                <th className="py-2.5 px-3">Quality</th>
                <th className="py-2.5 pl-3">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {nodes.map((node) => {
                const a = analyses[node.id];
                const nr = node.currentReading;
                const isSelected = node.id === selectedNode.id;
                return (
                  <tr
                    key={node.id}
                    onClick={() => onSelectNode(node.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-sky-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-slate-900 text-xs">{node.name}</div>
                      <div className="text-[11px] text-slate-500">{node.zone}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-800">
                      {nr.ph.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-800">
                      {nr.turbidity.toFixed(2)} NTU
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-800">
                      {nr.temperature.toFixed(1)}°C
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-800">
                      {formatPressure(nr.pressure, standards.pressureUnit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-800">
                      {nr.flowRate === null ? 'N/A' : `${nr.flowRate} L/min`}
                    </td>
                    <td className="py-2.5 px-3">
                      <QualityStatusLabel status={a.overallStatus} />
                    </td>
                    <td className="py-2.5 pl-3">
                      <ConnectivityLabel status={node.connectivity} isLiveStream={mode === 'live'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Three Engineering Value Pillars: Affordability, Early Detection, Scalability */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sky-700 font-semibold text-sm">
            <Cpu className="w-4 h-4" />
            <span>1. Affordability (Low-Cost IoT BOM)</span>
          </div>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Engineered around ESP32 microcontrollers (~$5), analog pH & optical turbidity probes (~$18), DS18B20 temperature, and Hall-effect flow sensors (~$15)—enabling municipal deployment at a fraction of commercial multiparameter SCADA analyzers.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-teal-700 font-semibold text-sm">
            <ShieldAlert className="w-4 h-4" />
            <span>2. Early Warning & Correlation</span>
          </div>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Combines BIS IS 10500 threshold evaluation with rolling-window delta detection, persistence filtering, and hydraulic pressure-flow cross-correlation to catch suspicious quality shifts before water reaches consumers.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Layers className="w-4 h-4" />
            <span>3. Multi-Node Municipal Scalability</span>
          </div>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Stateless REST/MQTT-compatible ingestion accepts unlimited ESP32 nodes across treatment outlets, trunk lines, critical zones, and tail-end reservoirs with automatic sensor health and calibration tracking.
          </p>
        </div>
      </div>
    </div>
  );
}
