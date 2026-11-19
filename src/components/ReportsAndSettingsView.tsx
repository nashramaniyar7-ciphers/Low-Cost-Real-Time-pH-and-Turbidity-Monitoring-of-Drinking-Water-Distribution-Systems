import React, { useState } from 'react';
import { Download, FileText, Printer, RotateCcw, Save } from 'lucide-react';
import {
  NodeAnalysis,
  OperatingMode,
  PipelineNode,
  StandardsConfig,
  WaterAlert,
} from '../types/water';
import { DEFAULT_BIS_STANDARDS, formatPressure } from '../engine/waterAnalysis';
import { QualityStatusLabel } from './StatusText';

interface ReportsViewProps {
  mode: OperatingMode;
  nodes: PipelineNode[];
  analyses: Record<string, NodeAnalysis>;
  alerts: WaterAlert[];
  standards: StandardsConfig;
  onDownloadCsv: () => void;
}

export function WaterQualityReportsView({
  mode,
  nodes,
  analyses,
  alerts,
  standards,
  onDownloadCsv,
}: ReportsViewProps) {
  const safeNodes = nodes.filter((n) => analyses[n.id]?.overallStatus === 'safe').length;
  const warnNodes = nodes.filter((n) => analyses[n.id]?.overallStatus === 'warning').length;
  const critNodes = nodes.filter((n) => analyses[n.id]?.overallStatus === 'critical').length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Water Quality Compliance & Incident Reports</h2>
          <p className="text-xs text-slate-500">
            Export telemetry snapshots, BIS IS 10500 compliance status, and alert audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDownloadCsv}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Full CSV Report</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-sky-700 font-semibold text-sm">
              <FileText className="w-4 h-4" />
              <span>AquaGuard AI — Drinking-Water Distribution Audit Summary</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Generated {new Date().toLocaleString()} · Data Source:{' '}
              {mode === 'demo' ? 'SIMULATED DEMO DATA' : 'LIVE HARDWARE TELEMETRY'}
            </p>
          </div>
          <div className="text-xs font-mono text-slate-600 text-right">
            <div>Reference Standard: BIS IS 10500:2012</div>
            <div>
              pH {standards.phMin}–{standards.phMax} · Turbidity ≤ {standards.turbidityAcceptableMax} NTU (max{' '}
              {standards.turbidityPermissibleMax})
            </div>
          </div>
        </div>

        {/* Summary Figures */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 block">Monitored Nodes</span>
            <span className="text-xl font-mono font-bold text-slate-900 tabular-nums">{nodes.length}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 block">Safe / Compliant</span>
            <span className="text-xl font-mono font-bold text-emerald-700 tabular-nums">{safeNodes}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 block">Warning / Critical Nodes</span>
            <span className="text-xl font-mono font-bold text-amber-700 tabular-nums">
              {warnNodes} / {critNodes}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 block">Recorded Alerts</span>
            <span className="text-xl font-mono font-bold text-slate-900 tabular-nums">{alerts.length}</span>
          </div>
        </div>

        {/* Node Snapshot Table */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Node Telemetry Snapshot</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 px-3 text-right">pH</th>
                  <th className="py-2 px-3 text-right">Turbidity</th>
                  <th className="py-2 px-3 text-right">Temp</th>
                  <th className="py-2 px-3 text-right">Pressure</th>
                  <th className="py-2 px-3 text-right">Flow</th>
                  <th className="py-2 pl-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {nodes.map((node) => {
                  const r = node.currentReading;
                  const a = analyses[node.id];
                  return (
                    <tr key={node.id}>
                      <td className="py-2 pr-4 font-sans font-medium text-slate-900">{node.name}</td>
                      <td className="py-2 px-3 text-right">{r.ph.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">{r.turbidity.toFixed(2)} NTU</td>
                      <td className="py-2 px-3 text-right">{r.temperature.toFixed(1)}°C</td>
                      <td className="py-2 px-3 text-right">
                        {formatPressure(r.pressure, standards.pressureUnit)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {r.flowRate === null ? 'N/A' : `${r.flowRate} L/min`}
                      </td>
                      <td className="py-2 pl-3 font-sans">
                        <QualityStatusLabel status={a.overallStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 pt-3 border-t border-slate-200">
          Disclaimer: Automated inline pH, turbidity, temperature, and hydraulic readings serve as continuous operational screening indicators. Regulatory potability certification and pathogen identification require accredited laboratory testing under BIS IS 10500 protocols.
        </p>
      </div>
    </div>
  );
}

interface SettingsStandardsViewProps {
  standards: StandardsConfig;
  onUpdateStandards: (next: StandardsConfig) => void;
}

export function SettingsStandardsView({
  standards,
  onUpdateStandards,
}: SettingsStandardsViewProps) {
  const [draft, setDraft] = useState<StandardsConfig>(standards);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStandards(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleReset = () => {
    setDraft(DEFAULT_BIS_STANDARDS);
    onUpdateStandards(DEFAULT_BIS_STANDARDS);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Drinking-Water Quality Standards & Thresholds
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Defaults follow BIS IS 10500:2012 drinking-water guidelines for pH and turbidity. Operational hydraulic thresholds can be tuned per municipality.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to BIS IS 10500 Defaults</span>
          </button>
        </div>

        {/* BIS Quality Thresholds */}
        <div>
          <h3 className="text-xs font-semibold text-slate-700 mb-3">
            BIS IS 10500 Water Quality Guidelines
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">pH Lower Acceptable Limit</label>
              <input
                type="number"
                step="0.1"
                value={draft.phMin}
                onChange={(e) => setDraft({ ...draft, phMin: parseFloat(e.target.value) || 6.5 })}
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
              <span className="text-[11px] text-slate-400">BIS IS 10500: 6.5 (no relaxation)</span>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">pH Upper Acceptable Limit</label>
              <input
                type="number"
                step="0.1"
                value={draft.phMax}
                onChange={(e) => setDraft({ ...draft, phMax: parseFloat(e.target.value) || 8.5 })}
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
              <span className="text-[11px] text-slate-400">BIS IS 10500: 8.5 (no relaxation)</span>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">pH Early-Warning Margin</label>
              <input
                type="number"
                step="0.05"
                value={draft.phWarningMargin}
                onChange={(e) =>
                  setDraft({ ...draft, phWarningMargin: parseFloat(e.target.value) || 0.25 })
                }
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
              <span className="text-[11px] text-slate-400">Triggers Warning before crossing limit</span>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Turbidity Acceptable Max (NTU)</label>
              <input
                type="number"
                step="0.1"
                value={draft.turbidityAcceptableMax}
                onChange={(e) =>
                  setDraft({ ...draft, turbidityAcceptableMax: parseFloat(e.target.value) || 1.0 })
                }
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
              <span className="text-[11px] text-slate-400">BIS IS 10500 Acceptable: 1.0 NTU</span>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Turbidity Permissible Max (NTU)</label>
              <input
                type="number"
                step="0.5"
                value={draft.turbidityPermissibleMax}
                onChange={(e) =>
                  setDraft({ ...draft, turbidityPermissibleMax: parseFloat(e.target.value) || 5.0 })
                }
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
              <span className="text-[11px] text-slate-400">BIS Permissible (no alternate source): 5.0 NTU</span>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Temp Operational Max (°C)</label>
              <input
                type="number"
                step="1"
                value={draft.tempOperationalMax}
                onChange={(e) =>
                  setDraft({ ...draft, tempOperationalMax: parseFloat(e.target.value) || 30 })
                }
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
              <span className="text-[11px] text-slate-400">Operational indicator (not BIS limit)</span>
            </div>
          </div>
        </div>

        {/* Hydraulic & Anomaly Sensitivity */}
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-xs font-semibold text-slate-700 mb-3">
            Hydraulic Operating Envelope & Anomaly Sensitivity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Pressure Display Unit</label>
              <select
                value={draft.pressureUnit}
                onChange={(e) =>
                  setDraft({ ...draft, pressureUnit: e.target.value as 'bar' | 'psi' })
                }
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="bar">bar (Metric)</option>
                <option value="psi">PSI (Imperial)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Min Residual Pressure (bar)</label>
              <input
                type="number"
                step="0.1"
                value={draft.pressureMinBar}
                onChange={(e) =>
                  setDraft({ ...draft, pressureMinBar: parseFloat(e.target.value) || 1.5 })
                }
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Sudden Pressure Drop Trigger (bar)</label>
              <input
                type="number"
                step="0.1"
                value={draft.pressureDropDeltaBar}
                onChange={(e) =>
                  setDraft({ ...draft, pressureDropDeltaBar: parseFloat(e.target.value) || 0.5 })
                }
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Sudden pH Shift Trigger (ΔpH)</label>
              <input
                type="number"
                step="0.05"
                value={draft.phSpikeDelta}
                onChange={(e) =>
                  setDraft({ ...draft, phSpikeDelta: parseFloat(e.target.value) || 0.45 })
                }
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Turbidity Spike Trigger (ΔNTU)</label>
              <input
                type="number"
                step="0.1"
                value={draft.turbiditySpikeDelta}
                onChange={(e) =>
                  setDraft({ ...draft, turbiditySpikeDelta: parseFloat(e.target.value) || 1.2 })
                }
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Stale Sensor Timeout (sec)</label>
              <input
                type="number"
                step="5"
                value={draft.staleTimeoutSec}
                onChange={(e) =>
                  setDraft({ ...draft, staleTimeoutSec: parseInt(e.target.value, 10) || 30 })
                }
                className="w-full px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center gap-4">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Standards Configuration</span>
          </button>
          {savedNotice && (
            <span className="text-xs font-medium text-teal-700">
              Thresholds updated and re-evaluated across all active nodes.
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
