import { ConnectivityStatus, PipelineNode, SensorReading } from '../types/water';

export interface ScenarioDefinition {
  key: string;
  name: string;
  summary: string;
  targetNodeId: string;
  expectedStatus: 'safe' | 'warning' | 'critical' | 'disconnected';
  readingPatch: Partial<SensorReading>;
  connectivityPatch?: ConnectivityStatus;
}

export const VALIDATION_SCENARIOS: ScenarioDefinition[] = [
  {
    key: 'normal',
    name: 'Normal Water Conditions',
    summary: 'Stable potable baseline within BIS IS 10500 limits across pH, turbidity, and pressure.',
    targetNodeId: 'node-a',
    expectedStatus: 'safe',
    readingPatch: { ph: 7.32, turbidity: 0.42, temperature: 23.4, pressure: 3.1, flowRate: 245 },
    connectivityPatch: 'connected',
  },
  {
    key: 'low_ph',
    name: 'Low pH Excursion',
    summary: 'Acidic shift to pH 5.75 simulating coagulant over-dosing or acidic industrial ingress.',
    targetNodeId: 'node-a',
    expectedStatus: 'critical',
    readingPatch: { ph: 5.75, turbidity: 0.65, temperature: 23.8, pressure: 3.0, flowRate: 240 },
    connectivityPatch: 'connected',
  },
  {
    key: 'high_ph',
    name: 'High pH Excursion',
    summary: 'Alkaline shift to pH 9.15 simulating lime dosing malfunction or fresh mortar leaching.',
    targetNodeId: 'node-b',
    expectedStatus: 'critical',
    readingPatch: { ph: 9.15, turbidity: 0.72, temperature: 24.5, pressure: 2.75, flowRate: 182 },
    connectivityPatch: 'connected',
  },
  {
    key: 'high_turbidity',
    name: 'High Turbidity Event',
    summary: 'Sustained 6.4 NTU reading exceeding the BIS IS 10500 permissible ceiling (5.0 NTU).',
    targetNodeId: 'node-b',
    expectedStatus: 'critical',
    readingPatch: { ph: 7.25, turbidity: 6.4, temperature: 24.1, pressure: 2.7, flowRate: 175 },
    connectivityPatch: 'connected',
  },
  {
    key: 'sudden_turbidity_spike',
    name: 'Sudden Turbidity Increase',
    summary: 'Rapid +2.6 NTU jump from 0.5 NTU baseline triggering rate-of-change early warning.',
    targetNodeId: 'node-c',
    expectedStatus: 'warning',
    readingPatch: { ph: 7.38, turbidity: 3.1, temperature: 24.2, pressure: 2.4, flowRate: 132 },
    connectivityPatch: 'connected',
  },
  {
    key: 'pressure_drop',
    name: 'Sudden Pressure Drop',
    summary: 'Hydraulic drop of -1.1 bar alongside flow surge indicating suspected main leakage.',
    targetNodeId: 'node-b',
    expectedStatus: 'critical',
    readingPatch: { ph: 7.29, turbidity: 0.85, temperature: 24.0, pressure: 1.05, flowRate: 345 },
    connectivityPatch: 'connected',
  },
  {
    key: 'simultaneous_abnormal',
    name: 'Simultaneous Abnormal Readings',
    summary: 'Combined acidic pH (6.05), high turbidity (5.8 NTU), and low pressure (1.2 bar) contamination risk.',
    targetNodeId: 'node-c',
    expectedStatus: 'critical',
    readingPatch: { ph: 6.05, turbidity: 5.8, temperature: 25.1, pressure: 1.2, flowRate: 95 },
    connectivityPatch: 'connected',
  },
  {
    key: 'sensor_disconnection',
    name: 'Sensor Disconnection',
    summary: 'Simulated ESP32 telemetry link loss to verify health monitoring and stale timeout flags.',
    targetNodeId: 'node-d',
    expectedStatus: 'disconnected',
    readingPatch: {},
    connectivityPatch: 'disconnected',
  },
];

function createSeededHistory(
  nodeId: string,
  basePh: number,
  baseTurb: number,
  baseTemp: number,
  basePress: number,
  baseFlow: number,
  points: number,
  intervalMs: number
): SensorReading[] {
  const now = Date.now();
  const list: SensorReading[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const ts = new Date(now - i * intervalMs).toISOString();
    const wave = Math.sin(i * 0.45);
    const wave2 = Math.cos(i * 0.3);
    list.push({
      id: `${nodeId}-seed-${points - i}`,
      nodeId,
      timestamp: ts,
      ph: Number((basePh + wave * 0.08 + (Math.random() - 0.5) * 0.05).toFixed(2)),
      turbidity: Number(Math.max(0.12, baseTurb + wave2 * 0.09 + (Math.random() - 0.5) * 0.06).toFixed(2)),
      temperature: Number((baseTemp + wave * 0.35 + (Math.random() - 0.5) * 0.15).toFixed(1)),
      pressure: Number(Math.max(0.4, basePress + wave2 * 0.12 + (Math.random() - 0.5) * 0.05).toFixed(2)),
      flowRate: Number(Math.max(20, baseFlow + wave * 12 + (Math.random() - 0.5) * 6).toFixed(0)),
      source: 'demo',
      signalStrengthDbm: -62 - Math.floor(Math.random() * 8),
      batteryMv: 4980,
    });
  }
  return list;
}

export function createInitialDemoNodes(): PipelineNode[] {
  const nowIso = new Date().toISOString();

  const configs = [
    {
      id: 'node-a',
      name: 'Node A · Main Treatment Outlet',
      zone: 'Zone 1 — Clear Water Sump Discharge',
      pipeDiameterMm: 450,
      material: 'Ductile Iron (DI)',
      elevationM: 42,
      upstreamNodeId: null,
      mcuModel: 'ESP32-WROOM-32D',
      firmware: 'ag-fw-1.4.2',
      basePh: 7.34,
      baseTurb: 0.38,
      baseTemp: 23.2,
      basePress: 3.15,
      baseFlow: 252,
    },
    {
      id: 'node-b',
      name: 'Node B · Sector 4 Trunk Line',
      zone: 'Zone 2 — Central Commercial Corridor',
      pipeDiameterMm: 300,
      material: 'HDPE PN10',
      elevationM: 36,
      upstreamNodeId: 'node-a',
      mcuModel: 'ESP32-WROOM-32D',
      firmware: 'ag-fw-1.4.2',
      basePh: 7.28,
      baseTurb: 0.54,
      baseTemp: 24.0,
      basePress: 2.74,
      baseFlow: 184,
    },
    {
      id: 'node-c',
      name: 'Node C · Hospital Zone Sub-Main',
      zone: 'Zone 3 — Critical Healthcare Feed',
      pipeDiameterMm: 200,
      material: 'Ductile Iron (DI)',
      elevationM: 39,
      upstreamNodeId: 'node-b',
      mcuModel: 'ESP32-S3-DevKit',
      firmware: 'ag-fw-1.4.2',
      basePh: 7.41,
      baseTurb: 0.45,
      baseTemp: 23.7,
      basePress: 2.48,
      baseFlow: 128,
    },
    {
      id: 'node-d',
      name: 'Node D · Tail-End Reservoir',
      zone: 'Zone 4 — Eastern Residential Tail-End',
      pipeDiameterMm: 150,
      material: 'uPVC Class 4',
      elevationM: 31,
      upstreamNodeId: 'node-b',
      mcuModel: 'ESP32-WROOM-32D',
      firmware: 'ag-fw-1.4.0',
      basePh: 7.18,
      baseTurb: 0.78,
      baseTemp: 24.9,
      basePress: 1.92,
      baseFlow: 76,
    },
  ];

  return configs.map((cfg) => {
    const history = createSeededHistory(
      cfg.id,
      cfg.basePh,
      cfg.baseTurb,
      cfg.baseTemp,
      cfg.basePress,
      cfg.baseFlow,
      36,
      5000
    );
    return {
      id: cfg.id,
      name: cfg.name,
      zone: cfg.zone,
      pipeDiameterMm: cfg.pipeDiameterMm,
      material: cfg.material,
      elevationM: cfg.elevationM,
      upstreamNodeId: cfg.upstreamNodeId,
      mcuModel: cfg.mcuModel,
      firmware: cfg.firmware,
      connectivity: 'connected',
      lastHeartbeat: nowIso,
      currentReading: history[history.length - 1],
      history,
      calibration: {
        phOffset: 0.02,
        phSlope: 0.992,
        phBufferLowMv: 175.4,
        phBufferMidMv: 1.2,
        turbidityZeroOffsetNtu: 0.04,
        turbidityGain: 1.0,
        lastCalibratedAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
        calibratedBy: 'Field Tech #04',
      },
    };
  });
}

export function stepDemoNodeReading(node: PipelineNode, tickCount: number): PipelineNode {
  if (node.connectivity === 'disconnected') {
    return node;
  }

  const prev = node.currentReading;
  const phase = tickCount * 0.35 + node.id.charCodeAt(node.id.length - 1);

  // Gently drift around safe baseline unless the user injected a scenario recently;
  // if source is 'manual', keep a realistic small jitter around the injected value for 6 ticks before relaxing.
  const targetPh = prev.source === 'manual' ? prev.ph : 7.28 + Math.sin(phase * 0.5) * 0.11;
  const targetTurb = prev.source === 'manual' ? prev.turbidity : 0.48 + Math.cos(phase * 0.4) * 0.14;
  const targetPress =
    prev.pressure === null
      ? null
      : prev.source === 'manual'
      ? prev.pressure
      : (node.id === 'node-a' ? 3.15 : node.id === 'node-b' ? 2.74 : node.id === 'node-c' ? 2.45 : 1.92) +
        Math.sin(phase * 0.3) * 0.08;
  const targetFlow =
    prev.flowRate === null
      ? null
      : prev.source === 'manual'
      ? prev.flowRate
      : (node.id === 'node-a' ? 250 : node.id === 'node-b' ? 182 : node.id === 'node-c' ? 126 : 78) +
        Math.cos(phase * 0.3) * 8;

  const nextPh = Number(
    Math.min(14, Math.max(0, prev.ph + (targetPh - prev.ph) * 0.35 + (Math.random() - 0.5) * 0.04)).toFixed(2)
  );
  const nextTurb = Number(
    Math.max(0.05, prev.turbidity + (targetTurb - prev.turbidity) * 0.35 + (Math.random() - 0.5) * 0.05).toFixed(2)
  );
  const nextTemp = Number(
    Math.max(5, Math.min(45, prev.temperature + (Math.random() - 0.5) * 0.12)).toFixed(1)
  );
  const nextPress =
    targetPress === null || prev.pressure === null
      ? null
      : Number(Math.max(0.1, prev.pressure + (targetPress - prev.pressure) * 0.4 + (Math.random() - 0.5) * 0.04).toFixed(2));
  const nextFlow =
    targetFlow === null || prev.flowRate === null
      ? null
      : Number(Math.max(0, prev.flowRate + (targetFlow - prev.flowRate) * 0.4 + (Math.random() - 0.5) * 4).toFixed(0));

  const nowIso = new Date().toISOString();
  const nextReading: SensorReading = {
    id: `${node.id}-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    nodeId: node.id,
    timestamp: nowIso,
    ph: nextPh,
    turbidity: nextTurb,
    temperature: nextTemp,
    pressure: nextPress,
    flowRate: nextFlow,
    source: prev.source === 'manual' ? 'manual' : 'demo',
    signalStrengthDbm: -61 - Math.floor(Math.random() * 9),
    batteryMv: 4970 + Math.floor(Math.random() * 30),
  };

  return {
    ...node,
    lastHeartbeat: nowIso,
    currentReading: nextReading,
    history: [...node.history.slice(-79), nextReading],
  };
}

export interface HistoricalBucket {
  label: string;
  timestamp: string;
  phAvg: number;
  phMin: number;
  phMax: number;
  turbidityAvg: number;
  turbidityMax: number;
  pressureAvg: number;
  flowAvg: number;
  warningEvents: number;
  criticalEvents: number;
}

export function generateHistoricalSeries(
  nodeId: string,
  timeframe: 'hourly' | 'daily' | 'weekly'
): HistoricalBucket[] {
  const count = timeframe === 'hourly' ? 24 : timeframe === 'daily' ? 14 : 12;
  const now = Date.now();
  const stepMs =
    timeframe === 'hourly'
      ? 3600_000
      : timeframe === 'daily'
      ? 12 * 3600_000
      : 2.5 * 86400_000;

  const nodeSeed = nodeId.charCodeAt(nodeId.length - 1);
  const buckets: HistoricalBucket[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(now - i * stepMs);
    const idx = count - i;
    const spike = (idx + nodeSeed) % 11 === 0;
    const minorWarn = (idx + nodeSeed) % 5 === 0;

    const phAvg = Number((7.26 + Math.sin(idx * 0.5 + nodeSeed) * 0.18 + (spike ? -0.65 : 0)).toFixed(2));
    const turbAvg = Number((0.46 + Math.abs(Math.cos(idx * 0.4 + nodeSeed)) * 0.25 + (spike ? 2.4 : minorWarn ? 0.75 : 0)).toFixed(2));
    const pressAvg = Number((2.65 + Math.sin(idx * 0.35) * 0.22 - (spike ? 0.85 : 0)).toFixed(2));
    const flowAvg = Number((175 + Math.sin(idx * 0.6) * 48 + (spike ? 70 : 0)).toFixed(0));

    const label =
      timeframe === 'hourly'
        ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : dt.toLocaleDateString([], { month: 'short', day: 'numeric' });

    buckets.push({
      label,
      timestamp: dt.toISOString(),
      phAvg,
      phMin: Number((phAvg - 0.14).toFixed(2)),
      phMax: Number((phAvg + 0.16).toFixed(2)),
      turbidityAvg: turbAvg,
      turbidityMax: Number((turbAvg + (spike ? 1.4 : 0.22)).toFixed(2)),
      pressureAvg: pressAvg,
      flowAvg,
      warningEvents: minorWarn ? 1 : 0,
      criticalEvents: spike ? 1 : 0,
    });
  }

  return buckets;
}
