import React from 'react';
import { FlaskConical, Play, RotateCcw } from 'lucide-react';
import { ScenarioDefinition, VALIDATION_SCENARIOS } from '../engine/demoSimulator';
import { ValidationRunResult } from '../types/water';

interface TestingValidationViewProps {
  onApplyScenario: (scenario: ScenarioDefinition) => void;
  onRunAllValidation: () => void;
  onResetBaseline: () => void;
  validationResults: ValidationRunResult[];
}

export function TestingValidationView({
  onApplyScenario,
  onRunAllValidation,
  onResetBaseline,
  validationResults,
}: TestingValidationViewProps) {
  const passedCount = validationResults.filter((r) => r.passed).length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-sky-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Testing & Validation Environment
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Inject standard water-quality and hydraulic fault scenarios to observe real-time rule classification, early-warning anomaly triggers, and alert generation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onResetBaseline}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Nodes to Safe Baseline</span>
          </button>
          <button
            type="button"
            onClick={onRunAllValidation}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Full 8-Scenario Validation Suite</span>
          </button>
        </div>
      </div>

      {/* 8 Scenario Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {VALIDATION_SCENARIOS.map((sc) => (
          <div
            key={sc.key}
            className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{sc.name}</h3>
              </div>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{sc.summary}</p>
              <div className="mt-2 text-[11px] font-mono text-slate-500 tabular-nums">
                Target: {sc.targetNodeId.toUpperCase()} · Expected:{' '}
                <span className="uppercase font-semibold text-slate-700">{sc.expectedStatus}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onApplyScenario(sc)}
              className="w-full py-1.5 px-3 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Inject Scenario
            </button>
          </div>
        ))}
      </div>

      {/* Actual Validation Run Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Executed Validation Results</h3>
            <p className="text-xs text-slate-500">
              Displays actual measured engine outputs from executed test scenarios. Physical sensors require field calibration and laboratory verification; software rules do not guarantee zero false positives or zero missed events under unmodeled field interference.
            </p>
          </div>
          {validationResults.length > 0 && (
            <span className="text-xs font-mono tabular-nums font-semibold text-slate-800">
              Observed Match: {passedCount}/{validationResults.length} test runs
            </span>
          )}
        </div>

        {validationResults.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
            No validation suite runs executed yet. Click &ldquo;Run Full 8-Scenario Validation Suite&rdquo; or inject an individual scenario above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2 pr-3">Scenario</th>
                  <th className="py-2 px-3">Injected Telemetry</th>
                  <th className="py-2 px-3">Expected</th>
                  <th className="py-2 px-3">Actual</th>
                  <th className="py-2 px-3">Triggered Anomalies / Alerts</th>
                  <th className="py-2 pl-3 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {validationResults.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900">{res.scenarioName}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {new Date(res.executedAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                      {res.injectedValues.connectivity === 'disconnected'
                        ? 'Heartbeat lost'
                        : `pH ${res.injectedValues.ph.toFixed(2)} · ${res.injectedValues.turbidity.toFixed(2)} NTU · ${
                            res.injectedValues.pressure !== null ? `${res.injectedValues.pressure.toFixed(2)} bar` : 'N/A'
                          }`}
                    </td>
                    <td className="py-2.5 px-3 font-mono uppercase text-slate-600">
                      {res.expectedClassification}
                    </td>
                    <td className="py-2.5 px-3 font-mono uppercase font-semibold text-slate-900">
                      {res.actualClassification}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {res.anomaliesDetected.length > 0
                        ? res.anomaliesDetected.join('; ')
                        : `${res.triggeredAlertsCount} threshold alert(s)`}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-semibold">
                      {res.passed ? (
                        <span className="text-emerald-700">● Verified</span>
                      ) : (
                        <span className="text-rose-700">✖ Mismatch</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
