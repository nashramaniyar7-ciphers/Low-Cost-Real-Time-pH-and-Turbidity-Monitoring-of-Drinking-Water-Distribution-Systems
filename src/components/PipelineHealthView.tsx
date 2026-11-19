import React from 'react';
import { CheckCircle2, Gauge, SearchCheck, XCircle } from 'lucide-react';
import {
  LeakageIncident,
  NodeAnalysis,
  OperatingMode,
  PipelineNode,
  StandardsConfig,
} from '../types/water';
import { formatPressure } from '../engine/waterAnalysis';
import { PipelineSchematic, TelemetryChart } from './Charts';

interface PipelineHealthViewProps {
  mode: OperatingMode;
  nodes: PipelineNode[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  analyses: Record<string, NodeAnalysis>;
  standards: StandardsConfig;
  leakIncidents: LeakageIncident[];
  onUpdateLeakStatus: (id: string, state: 'confirmed' | 'cleared', note: string) => void;
}

export function PipelineHealthView({
  mode,
  nodes,
  selectedNodeId,
  onSelectNode,
  analyses,
  standards,
  leakIncidents,
  onUpdateLeakStatus,
}: PipelineHealthViewProps) {
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];

  const suspectedCount = leakIncidents.filter((l) => l.confirmationState === 'suspected').length;
  const confirmedCount = leakIncidents.filter((l) => l.confirmationState === 'confirmed').length;

  return (
    <div className="space-y-6">
      <PipelineSchematic
        nodes={nodes}
        analyses={analyses}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
      />

      {/* Hydraulic Operating Condition Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Hydraulic Pressure & Flow Diagnostics
                {mode === 'demo' && <span className="ml-2 text-xs font-mono text-sky-700">· DEMO DATA</span>}
              </h2>
              <p className="text-xs text-slate-500">
                Monitoring {selectedNode?.name ?? 'selected node'} for sudden pressure drops and abnormal flow surges.
              </p>
            </div>
            <Gauge className="w-4 h-4 text-sky-700" />
          </div>

          {selectedNode ? (
            <TelemetryChart
              readings={selectedNode.history}
              standards={standards}
              mode="hydraulics"
              height={220}
            />
          ) : (
            <p className="text-xs text-slate-500 py-8 text-center">No hydraulic telemetry available.</p>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {nodes.map((node) => {
              const a = analyses[node.id];
              const nr = node.currentReading;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    node.id === selectedNodeId
                      ? 'border-sky-500 bg-sky-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-slate-900 truncate">{node.name.split('·')[0]}</div>
                  <div className="font-mono tabular-nums text-slate-700 mt-1">
                    {formatPressure(nr.pressure, standards.pressureUnit)}
                  </div>
                  <div className="font-mono tabular-nums text-slate-500">
                    {nr.flowRate === null ? 'N/A' : `${nr.flowRate} L/min`}
                  </div>
                  <div className={`mt-1 font-medium ${a.suspectedLeakage ? 'text-rose-700' : 'text-teal-700'}`}>
                    {a.suspectedLeakage ? '▲ Suspected Leak' : '● Steady Head'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Suspected vs Confirmed Leakage Workflow */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Suspected vs. Confirmed Leakage Log</h2>
              <p className="text-xs text-slate-500">
                Pressure drops flag <strong>Suspected Leakage</strong> only. Confirmation requires field acoustic or valve isolation verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-600 pb-3 border-b border-slate-200 font-mono tabular-nums">
            <span>Suspected: <strong className="text-amber-700">{suspectedCount}</strong></span>
            <span>·</span>
            <span>Field Confirmed: <strong className="text-rose-700">{confirmedCount}</strong></span>
          </div>

          {leakIncidents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No abnormal pressure drop or mass-balance leakage indicators detected in the current session.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
              {leakIncidents.map((inc) => (
                <div key={inc.id} className="py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">{inc.nodeName}</span>
                    <span
                      className={`text-xs font-semibold ${
                        inc.confirmationState === 'confirmed'
                          ? 'text-rose-700'
                          : inc.confirmationState === 'cleared'
                          ? 'text-slate-500'
                          : 'text-amber-700'
                      }`}
                    >
                      {inc.confirmationState === 'confirmed'
                        ? '✖ Confirmed Leakage'
                        : inc.confirmationState === 'cleared'
                        ? 'Cleared / Normal Valve Op'
                        : '▲ Suspected Leakage'}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono tabular-nums text-slate-600">
                    ΔPressure: -{inc.pressureDropBar.toFixed(2)} bar · Flow Shift: {inc.flowDeviationPct > 0 ? '+' : ''}
                    {inc.flowDeviationPct.toFixed(1)}% · {new Date(inc.detectedAt).toLocaleTimeString()}
                  </div>

                  <p className="text-xs text-slate-600">{inc.operatorNote}</p>

                  {inc.confirmationState === 'suspected' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateLeakStatus(
                            inc.id,
                            'confirmed',
                            'Confirmed via field acoustic leak correlator and sector valve isolation check.'
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700 cursor-pointer"
                      >
                        <SearchCheck className="w-3 h-3" />
                        <span>Confirm Field Leak</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateLeakStatus(
                            inc.id,
                            'cleared',
                            'Verified as scheduled hydrant flushing or pressure-reducing valve adjustment.'
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 cursor-pointer"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Clear (Scheduled Op)</span>
                      </button>
                    </div>
                  )}

                  {inc.confirmationState === 'confirmed' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-rose-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Repair crew dispatch logged at {new Date(inc.updatedAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
