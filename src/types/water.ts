export type OperatingMode = 'demo' | 'live';

export type QualityStatus = 'safe' | 'warning' | 'critical';

export type ConnectivityStatus = 'connected' | 'stale' | 'disconnected' | 'faulty';

export type NavSection =
  | 'overview'
  | 'live'
  | 'pipeline'
  | 'alerts'
  | 'analytics'
  | 'sensors'
  | 'testing'
  | 'reports'
  | 'settings';

export type PressureUnit = 'bar' | 'psi';

export interface SensorReading {
  id: string;
  nodeId: string;
  timestamp: string; // ISO string
  ph: number;
  turbidity: number; // NTU
  temperature: number; // °C
  pressure: number | null; // bar (canonical storage)
  flowRate: number | null; // L/min
  source: 'demo' | 'live' | 'manual';
  signalStrengthDbm?: number;
  batteryMv?: number;
}

export interface PipelineNode {
  id: string;
  name: string;
  zone: string;
  pipeDiameterMm: number;
  material: string;
  elevationM: number;
  upstreamNodeId: string | null;
  mcuModel: string;
  firmware: string;
  connectivity: ConnectivityStatus;
  lastHeartbeat: string;
  currentReading: SensorReading;
  history: SensorReading[];
  calibration: NodeCalibration;
}

export interface NodeCalibration {
  phOffset: number;
  phSlope: number; // nominal 1.0
  phBufferLowMv: number; // e.g., at pH 4.01
  phBufferMidMv: number; // e.g., at pH 7.00
  turbidityZeroOffsetNtu: number;
  turbidityGain: number;
  lastCalibratedAt: string;
  calibratedBy: string;
}

export interface StandardsConfig {
  // BIS IS 10500:2012 Drinking Water Specification
  phMin: number; // 6.5 acceptable (no relaxation)
  phMax: number; // 8.5 acceptable (no relaxation)
  phWarningMargin: number; // 0.3 margin inside bounds triggers early warning
  turbidityAcceptableMax: number; // 1.0 NTU (BIS acceptable limit)
  turbidityPermissibleMax: number; // 5.0 NTU (BIS permissible limit if no alternate source)
  // Operational monitoring parameters (not BIS numeric potable limits)
  tempOperationalMax: number; // 30 °C operational baseline
  pressureMinBar: number; // 1.5 bar minimum residual pressure
  pressureMaxBar: number; // 4.5 bar max nominal distribution pressure
  flowMinLpm: number; // 40 L/min low-flow threshold
  flowMaxLpm: number; // 420 L/min burst/surge threshold
  // Anomaly sensitivity
  phSpikeDelta: number; // sudden shift >= 0.45 pH over window
  turbiditySpikeDelta: number; // sudden shift >= 1.2 NTU over window
  pressureDropDeltaBar: number; // sudden drop <= -0.5 bar
  staleTimeoutSec: number; // 30s default
  pressureUnit: PressureUnit;
}

export interface ParameterAssessment {
  parameter: 'ph' | 'turbidity' | 'temperature' | 'pressure' | 'flowRate';
  label: string;
  value: number | null;
  unit: string;
  expectedRange: string;
  status: QualityStatus;
  reason: string;
}

export interface AnomalyFinding {
  id: string;
  nodeId: string;
  nodeName: string;
  type:
    | 'sudden_ph_shift'
    | 'turbidity_spike'
    | 'persistent_abnormality'
    | 'multi_parameter_correlation'
    | 'suspected_leakage'
    | 'sensor_fault';
  title: string;
  description: string;
  severity: 'warning' | 'critical';
  detectedAt: string;
  confidenceNote: string;
}

export interface RecommendationItem {
  id: string;
  category: 'source_inspection' | 'filtration' | 'hydraulics' | 'lab_sampling' | 'sensor_maintenance';
  priority: 'warning' | 'critical' | 'info';
  title: string;
  action: string;
  rationale: string;
}

export interface NodeAnalysis {
  nodeId: string;
  overallStatus: QualityStatus;
  assessments: ParameterAssessment[];
  anomalies: AnomalyFinding[];
  recommendations: RecommendationItem[];
  suspectedLeakage: boolean;
  leakageReason: string | null;
  sensorHealthNote: string;
}

export interface WaterAlert {
  id: string;
  nodeId: string;
  nodeName: string;
  parameter: string;
  actualValue: string;
  expectedRange: string;
  severity: 'warning' | 'critical';
  detectedAt: string;
  recommendedAction: string;
  status: 'active' | 'acknowledged' | 'resolved';
  sourceMode: 'demo' | 'live' | 'manual';
  ruleId: string;
}

export interface NotificationDispatch {
  id: string;
  alertId: string;
  channel: 'SMS Gateway' | 'Municipal SCADA Webhook' | 'Operator Email';
  recipient: string;
  message: string;
  dispatchedAt: string;
  simulated: boolean;
}

export interface LeakageIncident {
  id: string;
  nodeId: string;
  nodeName: string;
  detectedAt: string;
  pressureDropBar: number;
  flowDeviationPct: number;
  confirmationState: 'suspected' | 'confirmed' | 'cleared';
  operatorNote: string;
  updatedAt: string;
}

export interface ForecastPoint {
  offsetMinutes: number;
  label: string;
  phProjected: number;
  turbidityProjected: number;
  phLower: number;
  phUpper: number;
  turbidityLower: number;
  turbidityUpper: number;
}

export interface ValidationRunResult {
  id: string;
  scenarioKey: string;
  scenarioName: string;
  executedAt: string;
  injectedValues: {
    ph: number;
    turbidity: number;
    pressure: number | null;
    flowRate: number | null;
    connectivity: ConnectivityStatus;
  };
  expectedClassification: QualityStatus | 'disconnected';
  actualClassification: QualityStatus | 'disconnected';
  triggeredAlertsCount: number;
  anomaliesDetected: string[];
  passed: boolean;
  notes: string;
}

export interface AIAnalysisResponse {
  summary: string;
  hypotheses: string[];
  recommendedFieldChecks: string[];
  limitationsNote: string;
  modelUsed: string;
  analyzedAt: string;
}
