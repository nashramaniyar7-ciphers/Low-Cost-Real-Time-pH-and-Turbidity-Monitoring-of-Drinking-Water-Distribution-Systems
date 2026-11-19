import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Cpu,
  Droplets,
  FileSpreadsheet,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Menu,
  Pause,
  Play,
  Settings,
  X,
} from 'lucide-react';
import {
  AIAnalysisResponse,
  LeakageIncident,
  NavSection,
  NodeAnalysis,
  NodeCalibration,
  NotificationDispatch,
  OperatingMode,
  PipelineNode,
  SensorReading,
  StandardsConfig,
  ValidationRunResult,
  WaterAlert,
} from './types/water';
import {
  analyzeNode,
  DEFAULT_BIS_STANDARDS,
  generateAlertsFromAnalysis,
} from './engine/waterAnalysis';
import {
  createInitialDemoNodes,
  ScenarioDefinition,
  stepDemoNodeReading,
  VALIDATION_SCENARIOS,
} from './engine/demoSimulator';
import { OverviewDashboard } from './components/OverviewDashboard';
import { LiveMonitoringView } from './components/LiveMonitoringView';
import { PipelineHealthView } from './components/PipelineHealthView';
import { AlertsView } from './components/AlertsView';
import { HistoricalAnalyticsView } from './components/HistoricalAnalyticsView';
import { SensorManagementView } from './components/SensorManagementView';
import { TestingValidationView } from './components/TestingValidationView';
import {
  SettingsStandardsView,
  WaterQualityReportsView,
} from './components/ReportsAndSettingsView';

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
  { id: 'live', label: 'Live Water Monitoring', icon: Activity },
  { id: 'pipeline', label: 'Pipeline Health', icon: GitBranch },
  { id: 'alerts', label: 'Alerts & Notifications', icon: Bell },
  { id: 'analytics', label: 'Historical Analytics', icon: BarChart3 },
  { id: 'sensors', label: 'Sensor Management', icon: Cpu },
  { id: 'testing', label: 'Testing & Validation', icon: FlaskConical },
  { id: 'reports', label: 'Water Quality Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings & Standards', icon: Settings },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [mode, setMode] = useState<OperatingMode>('demo');
  const [demoRunning, setDemoRunning] = useState(true);

  const [standards, setStandards] = useState<StandardsConfig>(DEFAULT_BIS_STANDARDS);
  const [demoNodes, setDemoNodes] = useState<PipelineNode[]>(() => createInitialDemoNodes());
  const [liveNodes, setLiveNodes] = useState<PipelineNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-a');

  const [alerts, setAlerts] = useState<WaterAlert[]>([]);
  const [notifications, setNotifications] = useState<NotificationDispatch[]>([]);
  const [leakIncidents, setLeakIncidents] = useState<LeakageIncident[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationRunResult[]>([]);

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const tickRef = useRef(0);
  const lastAlertSignatureRef = useRef<Record<string, number>>({});

  const activeNodes = mode === 'demo' ? demoNodes : liveNodes;

  // Ensure selectedNodeId points to an existing node when switching modes
  useEffect(() => {
    if (activeNodes.length > 0 && !activeNodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(activeNodes[0].id);
    }
  }, [activeNodes, selectedNodeId]);

  // Real-time Demo Simulation Loop
  useEffect(() => {
    if (mode !== 'demo' || !demoRunning) return;
    const timer = setInterval(() => {
      tickRef.current += 1;
      setDemoNodes((prev) => prev.map((node) => stepDemoNodeReading(node, tickRef.current)));
    }, 3500);
    return () => clearInterval(timer);
  }, [mode, demoRunning]);

  // Live Hardware Mode Polling from /api/sensors/live
  useEffect(() => {
    if (mode !== 'live') return;
    let cancelled = false;

    const fetchLive = async () => {
      try {
        const res = await fetch('/api/sensors/live');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data.nodes)) return;

        const mapped: PipelineNode[] = data.nodes.map(
          (item: {
            nodeId: string;
            name: string;
            zone: string;
            lastHeartbeat: string;
            currentReading: SensorReading;
            history: SensorReading[];
          }) => ({
            id: item.nodeId,
            name: item.name,
            zone: item.zone,
            pipeDiameterMm: 250,
            material: 'Field Pipe',
            elevationM: 35,
            upstreamNodeId: null,
            mcuModel: 'ESP32 Hardware',
            firmware: 'live-http',
            connectivity: 'connected',
            lastHeartbeat: item.lastHeartbeat,
            currentReading: item.currentReading,
            history: item.history,
            calibration: {
              phOffset: 0,
              phSlope: 1,
              phBufferLowMv: 176.8,
              phBufferMidMv: 0,
              turbidityZeroOffsetNtu: 0,
              turbidityGain: 1,
              lastCalibratedAt: item.lastHeartbeat,
              calibratedBy: 'Hardware Firmware',
            },
          })
        );
        setLiveNodes(mapped);
      } catch {
        // Keep last state on transient network error
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mode]);

  // Compute deterministic analysis across all active nodes
  const analyses: Record<string, NodeAnalysis> = useMemo(() => {
    const byId = Object.fromEntries(activeNodes.map((n) => [n.id, n]));
    const nowMs = Date.now();
    const map: Record<string, NodeAnalysis> = {};
    for (const node of activeNodes) {
      const upstream = node.upstreamNodeId ? byId[node.upstreamNodeId] : null;
      map[node.id] = analyzeNode(node, standards, upstream, nowMs);
    }
    return map;
  }, [activeNodes, standards]);

  // Record alerts & suspected leakage incidents when abnormal states arise
  useEffect(() => {
    const now = Date.now();
    const newAlerts: WaterAlert[] = [];
    const newNotifications: NotificationDispatch[] = [];
    const newLeaks: LeakageIncident[] = [];

    for (const node of activeNodes) {
      const analysis = analyses[node.id];
      if (!analysis) continue;

      const generated = generateAlertsFromAnalysis(node, analysis, mode);
      for (const alt of generated) {
        const sig = `${alt.nodeId}:${alt.ruleId}:${alt.severity}`;
        const lastSeen = lastAlertSignatureRef.current[sig] ?? 0;
        if (now - lastSeen > 25_000) {
          lastAlertSignatureRef.current[sig] = now;
          newAlerts.push(alt);

          if (alt.severity === 'critical') {
            newNotifications.push({
              id: `NTF-${Date.now()}-${Math.floor(Math.random() * 999)}`,
              alertId: alt.id,
              channel: 'Municipal SCADA Webhook',
              recipient: 'Duty Water Quality Engineer',
              message: `[CRITICAL] ${alt.nodeName}: ${alt.parameter} measured ${alt.actualValue} (Expected ${alt.expectedRange}).`,
              dispatchedAt: new Date().toISOString(),
              simulated: true,
            });
          }
        }
      }

      if (analysis.suspectedLeakage && analysis.leakageReason) {
        const leakSig = `leak:${node.id}`;
        const lastLeak = lastAlertSignatureRef.current[leakSig] ?? 0;
        if (now - lastLeak > 30_000) {
          lastAlertSignatureRef.current[leakSig] = now;
          newLeaks.push({
            id: `LEAK-${node.id.toUpperCase()}-${Date.now().toString().slice(-4)}`,
            nodeId: node.id,
            nodeName: node.name,
            detectedAt: node.currentReading.timestamp,
            pressureDropBar: Math.max(0.5, standards.pressureMinBar - (node.currentReading.pressure ?? 1.0) + 0.5),
            flowDeviationPct: 24.5,
            confirmationState: 'suspected',
            operatorNote: analysis.leakageReason,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 80));
    }
    if (newNotifications.length > 0) {
      setNotifications((prev) => [...newNotifications, ...prev].slice(0, 50));
    }
    if (newLeaks.length > 0) {
      setLeakIncidents((prev) => [...newLeaks, ...prev].slice(0, 30));
    }
  }, [activeNodes, analyses, mode, standards.pressureMinBar]);

  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status === 'active'),
    [alerts]
  );

  const handleInjectManualReading = useCallback(
    (nodeId: string, patch: Partial<SensorReading>) => {
      const nowIso = new Date().toISOString();
      setDemoNodes((prev) =>
        prev.map((node) => {
          if (node.id !== nodeId) return node;
          const nextReading: SensorReading = {
            ...node.currentReading,
            ...patch,
            id: `${node.id}-manual-${Date.now()}`,
            nodeId: node.id,
            timestamp: nowIso,
            source: patch.source ?? 'manual',
          };
          return {
            ...node,
            connectivity: 'connected',
            lastHeartbeat: nowIso,
            currentReading: nextReading,
            history: [...node.history.slice(-79), nextReading],
          };
        })
      );
      setMode('demo');
      setSelectedNodeId(nodeId);
    },
    []
  );

  const handleApplyScenario = useCallback((scenario: ScenarioDefinition) => {
    const nowIso = new Date().toISOString();
    setMode('demo');
    setSelectedNodeId(scenario.targetNodeId);

    setDemoNodes((prev) =>
      prev.map((node) => {
        if (node.id !== scenario.targetNodeId) return node;
        if (scenario.connectivityPatch === 'disconnected') {
          return {
            ...node,
            connectivity: 'disconnected',
          };
        }
        const nextReading: SensorReading = {
          ...node.currentReading,
          ...scenario.readingPatch,
          id: `${node.id}-sc-${Date.now()}`,
          timestamp: nowIso,
          source: 'manual',
        };
        return {
          ...node,
          connectivity: 'connected',
          lastHeartbeat: nowIso,
          currentReading: nextReading,
          history: [...node.history.slice(-79), nextReading],
        };
      })
    );
  }, []);

  const handleResetBaseline = useCallback(() => {
    lastAlertSignatureRef.current = {};
    setDemoNodes(createInitialDemoNodes());
    setMode('demo');
    setAiAnalysis(null);
    setAiError(null);
  }, []);

  const handleRunAllValidation = useCallback(() => {
    const baselineNodes = createInitialDemoNodes();
    const byId = Object.fromEntries(baselineNodes.map((n) => [n.id, n]));
    const results: ValidationRunResult[] = VALIDATION_SCENARIOS.map((sc) => {
      const target = byId[sc.targetNodeId];
      const nowIso = new Date().toISOString();

      const testNode: PipelineNode =
        sc.connectivityPatch === 'disconnected'
          ? { ...target, connectivity: 'disconnected' }
          : {
              ...target,
              connectivity: 'connected',
              lastHeartbeat: nowIso,
              currentReading: {
                ...target.currentReading,
                ...sc.readingPatch,
                id: `val-${sc.key}`,
                timestamp: nowIso,
                source: 'manual',
              },
              history: [
                ...target.history,
                {
                  ...target.currentReading,
                  ...sc.readingPatch,
                  id: `val-${sc.key}`,
                  timestamp: nowIso,
                  source: 'manual',
                },
              ],
            };

      const analysis = analyzeNode(testNode, standards, null, Date.now());
      const generatedAlerts = generateAlertsFromAnalysis(testNode, analysis, 'manual');
      const actualClassification =
        testNode.connectivity === 'disconnected' ? 'disconnected' : analysis.overallStatus;

      return {
        id: `valrun-${sc.key}-${Date.now()}`,
        scenarioKey: sc.key,
        scenarioName: sc.name,
        executedAt: nowIso,
        injectedValues: {
          ph: testNode.currentReading.ph,
          turbidity: testNode.currentReading.turbidity,
          pressure: testNode.currentReading.pressure,
          flowRate: testNode.currentReading.flowRate,
          connectivity: testNode.connectivity,
        },
        expectedClassification: sc.expectedStatus,
        actualClassification,
        triggeredAlertsCount: generatedAlerts.length,
        anomaliesDetected: analysis.anomalies.map((a) => a.title),
        passed: actualClassification === sc.expectedStatus,
        notes: analysis.sensorHealthNote,
      };
    });
    setValidationResults(results);
  }, [standards]);

  const handleUpdateCalibration = useCallback((nodeId: string, calibration: NodeCalibration) => {
    setDemoNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, calibration } : n)));
  }, []);

  const handleReconnectNode = useCallback((nodeId: string) => {
    const nowIso = new Date().toISOString();
    setDemoNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, connectivity: 'connected', lastHeartbeat: nowIso } : n
      )
    );
  }, []);

  const handleUpdateAlertStatus = useCallback((id: string, status: 'acknowledged' | 'resolved') => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const handleResolveAllAlerts = useCallback(() => {
    setAlerts((prev) =>
      prev.map((a) => (a.status === 'active' ? { ...a, status: 'resolved' } : a))
    );
  }, []);

  const handleSimulateDispatch = useCallback(
    (alert: WaterAlert, channel: NotificationDispatch['channel']) => {
      const dispatch: NotificationDispatch = {
        id: `NTF-${Date.now().toString().slice(-5)}`,
        alertId: alert.id,
        channel,
        recipient: 'Sector Operations Lead (+91-XXX-XXXX)',
        message: `[${alert.severity.toUpperCase()}] ${alert.nodeName}: ${alert.parameter} = ${alert.actualValue}. Action: ${alert.recommendedAction}`,
        dispatchedAt: new Date().toISOString(),
        simulated: true,
      };
      setNotifications((prev) => [dispatch, ...prev].slice(0, 50));
    },
    []
  );

  const handleUpdateLeakStatus = useCallback(
    (id: string, state: 'confirmed' | 'cleared', note: string) => {
      setLeakIncidents((prev) =>
        prev.map((inc) =>
          inc.id === id
            ? {
                ...inc,
                confirmationState: state,
                operatorNote: note,
                updatedAt: new Date().toISOString(),
              }
            : inc
        )
      );
    },
    []
  );

  const handleDownloadCsv = useCallback(() => {
    const header = [
      'Timestamp',
      'Mode',
      'Node ID',
      'Node Name',
      'pH',
      'Turbidity (NTU)',
      'Temperature (C)',
      'Pressure (bar)',
      'Flow Rate (L/min)',
      'Status',
    ];
    const rows: string[][] = [];
    for (const node of activeNodes) {
      const status = analyses[node.id]?.overallStatus ?? 'safe';
      for (const r of node.history.slice(-20)) {
        rows.push([
          r.timestamp,
          r.source.toUpperCase(),
          node.id,
          `"${node.name}"`,
          r.ph.toFixed(2),
          r.turbidity.toFixed(2),
          r.temperature.toFixed(1),
          r.pressure === null ? 'N/A' : r.pressure.toFixed(2),
          r.flowRate === null ? 'N/A' : String(r.flowRate),
          status.toUpperCase(),
        ]);
      }
    }
    const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aquaguard-water-quality-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [activeNodes, analyses, mode]);

  const handleRunAiAnalysis = useCallback(
    async (node: PipelineNode) => {
      setAiLoading(true);
      setAiError(null);
      try {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeName: node.name,
            zone: node.zone,
            recentReadings: node.history.slice(-15),
            activeAnomalies: analyses[node.id]?.anomalies ?? [],
            standards: {
              phRange: `${standards.phMin}-${standards.phMax}`,
              turbidityAcceptableMax: standards.turbidityAcceptableMax,
              turbidityPermissibleMax: standards.turbidityPermissibleMax,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAiError(data.error ?? 'AI analysis unavailable.');
        } else {
          setAiAnalysis(data as AIAnalysisResponse);
        }
      } catch (err: unknown) {
        setAiError(err instanceof Error ? err.message : 'Failed to connect to AI analysis endpoint.');
      } finally {
        setAiLoading(false);
      }
    },
    [analyses, standards]
  );

  const currentNavLabel = NAV_ITEMS.find((i) => i.id === activeSection)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-20">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Droplets className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-base tracking-tight text-slate-900 whitespace-nowrap">
            AquaGuard AI
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  active
                    ? 'bg-sky-50 text-sky-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-sky-600' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'alerts' && activeAlerts.length > 0 && (
                  <span className="font-mono tabular-nums text-[11px] font-semibold text-rose-700">
                    {activeAlerts.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
          <div className="font-medium text-slate-700">BIS IS 10500 Reference</div>
          <div>pH 6.5–8.5 · Turbidity ≤ 1.0 NTU</div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-white h-full border-r border-slate-200 flex flex-col z-50">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="font-display font-bold text-base text-slate-900">AquaGuard AI</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-lg ${
                      active ? 'bg-sky-50 text-sky-800' : 'text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
              {currentNavLabel}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {mode === 'demo' && (
              <button
                type="button"
                onClick={() => setDemoRunning((r) => !r)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                {demoRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{demoRunning ? 'Pause Demo' : 'Resume Demo'}</span>
              </button>
            )}

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg" role="group" aria-label="Operating Mode">
              <button
                type="button"
                onClick={() => setMode('demo')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'demo'
                    ? 'bg-white text-sky-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Demo Mode
              </button>
              <button
                type="button"
                onClick={() => setMode('live')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'live'
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Sensor Mode
              </button>
            </div>
          </div>
        </header>

        {/* Explicit Mode Banner */}
        <div
          className={`px-4 sm:px-6 py-2 text-xs border-b flex flex-wrap items-center justify-between gap-2 no-print ${
            mode === 'demo'
              ? 'bg-sky-50/80 border-sky-200 text-sky-900'
              : 'bg-teal-50/80 border-teal-200 text-teal-900'
          }`}
        >
          <div>
            {mode === 'demo' ? (
              <span>
                <strong className="font-mono">DEMO DATA</strong> — Displaying simulated multi-node ESP32 pipeline telemetry for demonstration and scenario testing. Not live field hardware readings.
              </span>
            ) : (
              <span>
                <strong className="font-mono">LIVE SENSOR MODE</strong> — Reading actual packets posted to <code className="font-mono">/api/sensors/ingest</code> ({liveNodes.length} hardware node(s) active).
              </span>
            )}
          </div>
          {mode === 'demo' && (
            <button
              type="button"
              onClick={() => setActiveSection('testing')}
              className="font-medium text-sky-800 hover:underline cursor-pointer whitespace-nowrap"
            >
              Inject Test Scenarios →
            </button>
          )}
        </div>

        {/* Viewport Container */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          {activeSection === 'overview' && (
            <OverviewDashboard
              mode={mode}
              nodes={activeNodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              analyses={analyses}
              standards={standards}
              activeAlerts={activeAlerts}
              onNavigate={setActiveSection}
              aiAnalysis={aiAnalysis}
              aiLoading={aiLoading}
              aiError={aiError}
              onRunAiAnalysis={handleRunAiAnalysis}
            />
          )}

          {activeSection === 'live' && (
            <LiveMonitoringView
              mode={mode}
              nodes={activeNodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              analyses={analyses}
              standards={standards}
              onInjectManualReading={handleInjectManualReading}
            />
          )}

          {activeSection === 'pipeline' && (
            <PipelineHealthView
              mode={mode}
              nodes={activeNodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              analyses={analyses}
              standards={standards}
              leakIncidents={leakIncidents}
              onUpdateLeakStatus={handleUpdateLeakStatus}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertsView
              alerts={alerts}
              notifications={notifications}
              onUpdateAlertStatus={handleUpdateAlertStatus}
              onResolveAll={handleResolveAllAlerts}
              onSimulateDispatch={handleSimulateDispatch}
            />
          )}

          {activeSection === 'analytics' && (
            <HistoricalAnalyticsView
              mode={mode}
              nodes={activeNodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              standards={standards}
              onDownloadCsv={handleDownloadCsv}
            />
          )}

          {activeSection === 'sensors' && (
            <SensorManagementView
              mode={mode}
              nodes={activeNodes}
              analyses={analyses}
              onUpdateCalibration={handleUpdateCalibration}
              onReconnectNode={handleReconnectNode}
              onSwitchToLiveMode={() => setMode('live')}
            />
          )}

          {activeSection === 'testing' && (
            <TestingValidationView
              onApplyScenario={(sc) => {
                handleApplyScenario(sc);
                setActiveSection('overview');
              }}
              onRunAllValidation={handleRunAllValidation}
              onResetBaseline={handleResetBaseline}
              validationResults={validationResults}
            />
          )}

          {activeSection === 'reports' && (
            <WaterQualityReportsView
              mode={mode}
              nodes={activeNodes}
              analyses={analyses}
              alerts={alerts}
              standards={standards}
              onDownloadCsv={handleDownloadCsv}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsStandardsView
              standards={standards}
              onUpdateStandards={setStandards}
            />
          )}
        </main>
      </div>
    </div>
  );
}
