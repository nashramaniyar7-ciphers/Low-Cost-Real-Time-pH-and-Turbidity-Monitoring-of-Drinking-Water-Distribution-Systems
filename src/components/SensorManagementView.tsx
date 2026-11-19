import React, { useState } from 'react';
import { Cpu, RefreshCw, Send, Wrench } from 'lucide-react';
import { NodeAnalysis, NodeCalibration, OperatingMode, PipelineNode } from '../types/water';
import { ConnectivityLabel } from './StatusText';

interface SensorManagementViewProps {
  mode: OperatingMode;
  nodes: PipelineNode[];
  analyses: Record<string, NodeAnalysis>;
  onUpdateCalibration: (nodeId: string, calibration: NodeCalibration) => void;
  onReconnectNode: (nodeId: string) => void;
  onSwitchToLiveMode: () => void;
}

export function SensorManagementView({
  mode,
  nodes,
  analyses,
  onUpdateCalibration,
  onReconnectNode,
  onSwitchToLiveMode,
}: SensorManagementViewProps) {
  const [calNodeId, setCalNodeId] = useState<string>(nodes[0]?.id ?? 'node-a');
  const activeCalNode = nodes.find((n) => n.id === calNodeId) ?? nodes[0];

  const [mvLow, setMvLow] = useState<string>('175.4');
  const [mvMid, setMvMid] = useState<string>('1.2');
  const [turbZero, setTurbZero] = useState<string>('0.04');
  const [calSavedMsg, setCalSavedMsg] = useState<string | null>(null);

  const [testIngestStatus, setTestIngestStatus] = useState<string | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);

  const handleSaveCalibration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCalNode) return;
    const low = parseFloat(mvLow);
    const mid = parseFloat(mvMid);
    const zero = parseFloat(turbZero);
    if (Number.isNaN(low) || Number.isNaN(mid) || Number.isNaN(zero)) return;

    // Ideal Nernst slope at 25°C: 59.16 mV/pH => 4.01 to 7.00 (Δ2.99 pH) = ~176.9 mV
    const idealSpan = 176.89;
    const measuredSpan = Math.abs(low - mid);
    const computedSlope = Number(Math.max(0.75, Math.min(1.25, measuredSpan / idealSpan)).toFixed(3));
    const offsetPh = Number((-mid / 59.16).toFixed(3));

    onUpdateCalibration(activeCalNode.id, {
      phOffset: offsetPh,
      phSlope: computedSlope,
      phBufferLowMv: low,
      phBufferMidMv: mid,
      turbidityZeroOffsetNtu: zero,
      turbidityGain: 1.0,
      lastCalibratedAt: new Date().toISOString(),
      calibratedBy: 'Operator Bench Calibration',
    });
    setCalSavedMsg(
      `Calibration updated for ${activeCalNode.name}: Slope ${(computedSlope * 100).toFixed(1)}%, Offset ${offsetPh >= 0 ? '+' : ''}${offsetPh} pH.`
    );
    setTimeout(() => setCalSavedMsg(null), 5000);
  };

  const handleSendLiveTestPacket = async () => {
    setIngestLoading(true);
    setTestIngestStatus(null);
    try {
      const res = await fetch('/api/sensors/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: 'esp32-bench-01',
          name: 'ESP32 Bench Node · Lab Prototype',
          zone: 'Hardware Ingest Verification',
          ph: 7.18,
          turbidity: 0.52,
          temperature: 24.3,
          pressure: 2.85,
          flowRate: 195,
          rssi: -58,
          batteryMv: 4990,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestIngestStatus(`Error: ${data.error ?? res.statusText}`);
      } else {
        setTestIngestStatus(
          `Packet accepted by server (${data.nodeId} at ${new Date(data.receivedAt).toLocaleTimeString()}). Switch to Live Sensor Mode to view.`
        );
      }
    } catch (err: unknown) {
      setTestIngestStatus(`Request failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setIngestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hardware Node Registry & Health Monitoring */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">IoT Sensor Fleet & Health Monitoring</h2>
            <p className="text-xs text-slate-500">
              Monitors ESP32 heartbeat timeouts, flatline/stale ADC reads, and probe plausibility bounds.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Active Mode: {mode === 'demo' ? 'DEMONSTRATION' : 'LIVE HARDWARE'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-medium">
                <th className="py-2 pr-4">Node / Location</th>
                <th className="py-2 px-3">Microcontroller</th>
                <th className="py-2 px-3">Health Status</th>
                <th className="py-2 px-3 text-right">RSSI / Supply</th>
                <th className="py-2 px-3">Last Heartbeat</th>
                <th className="py-2 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nodes.map((node) => {
                const healthNote = analyses[node.id]?.sensorHealthNote ?? '';
                return (
                  <tr key={node.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900">{node.name}</div>
                      <div className="text-[11px] text-slate-500">{healthNote}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      <div>{node.mcuModel}</div>
                      <div className="text-[11px] text-slate-400">{node.firmware}</div>
                    </td>
                    <td className="py-3 px-3">
                      <ConnectivityLabel status={node.connectivity} isLiveStream={mode === 'live'} />
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                      {node.connectivity === 'disconnected'
                        ? '—'
                        : `${node.currentReading.signalStrengthDbm ?? -64} dBm · ${((node.currentReading.batteryMv ?? 5000) / 1000).toFixed(2)}V`}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-600">
                      {new Date(node.lastHeartbeat).toLocaleTimeString()}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {node.connectivity !== 'connected' ? (
                        <button
                          type="button"
                          onClick={() => onReconnectNode(node.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-sky-600 text-white rounded hover:bg-sky-700 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Restore Link</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCalNodeId(node.id)}
                          className="text-[11px] font-medium text-sky-700 hover:underline cursor-pointer"
                        >
                          Calibrate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calibration + Hardware API Integration Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2-Point Calibration */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-teal-700" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Sensor Calibration & Validation</h3>
              <p className="text-xs text-slate-500">Two-point pH buffer calibration (pH 4.01 & pH 7.00) and optical turbidity zeroing</p>
            </div>
          </div>

          {activeCalNode && (
            <form onSubmit={handleSaveCalibration} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Target Node</label>
                <select
                  value={activeCalNode.id}
                  onChange={(e) => setCalNodeId(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">pH 4.01 Buffer (mV)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mvLow}
                    onChange={(e) => setMvLow(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">pH 7.00 Buffer (mV)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mvMid}
                    onChange={(e) => setMvMid(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Distilled Zero (NTU)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={turbZero}
                    onChange={(e) => setTurbZero(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
              </div>

              <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono tabular-nums text-slate-700 space-y-1">
                <div>
                  Active Slope: {(activeCalNode.calibration.phSlope * 100).toFixed(1)}% · Offset:{' '}
                  {activeCalNode.calibration.phOffset >= 0 ? '+' : ''}
                  {activeCalNode.calibration.phOffset} pH
                </div>
                <div className="text-slate-500 font-sans">
                  Last calibrated {new Date(activeCalNode.calibration.lastCalibratedAt).toLocaleDateString()} by{' '}
                  {activeCalNode.calibration.calibratedBy}
                </div>
              </div>

              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer"
              >
                Compute & Save Calibration
              </button>
              {calSavedMsg && <p className="text-xs text-teal-700 font-medium">{calSavedMsg}</p>}
            </form>
          )}
        </div>

        {/* ESP32 / MQTT Backend Integration */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-700" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">ESP32 & MQTT Bridge API Integration</h3>
              <p className="text-xs text-slate-500">
                Real HTTP ingestion endpoint active at <code className="font-mono text-slate-800">POST /api/sensors/ingest</code>
              </p>
            </div>
          </div>

          <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-[11px] font-mono overflow-x-auto leading-relaxed">
{`POST /api/sensors/ingest
Content-Type: application/json

{
  "nodeId": "esp32-sector4-01",
  "name": "Sector 4 Main Pipe",
  "ph": 7.24,
  "turbidity": 0.68,
  "temperature": 24.1,
  "pressure": 2.75,
  "flowRate": 188
}`}
          </pre>

          <p className="text-xs text-slate-600">
            External ESP32 hardware requires Wi-Fi/GSM connectivity pointed to this server URL (or an MQTT broker such as Mosquitto/EMQX forwarding payloads via webhook to <code className="font-mono">/api/sensors/ingest</code>).
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSendLiveTestPacket}
              disabled={ingestLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-60 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{ingestLoading ? 'Sending...' : 'Send Test Hardware Packet'}</span>
            </button>
            <button
              type="button"
              onClick={onSwitchToLiveMode}
              className="px-3 py-2 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Switch to Live Sensor Mode
            </button>
          </div>
          {testIngestStatus && <p className="text-xs text-sky-800 font-medium">{testIngestStatus}</p>}
        </div>
      </div>
    </div>
  );
}
