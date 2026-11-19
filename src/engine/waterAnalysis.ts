import {
  AnomalyFinding,
  ConnectivityStatus,
  ForecastPoint,
  NodeAnalysis,
  ParameterAssessment,
  PipelineNode,
  QualityStatus,
  RecommendationItem,
  SensorReading,
  StandardsConfig,
  WaterAlert,
} from '../types/water';

export const DEFAULT_BIS_STANDARDS: StandardsConfig = {
  // BIS IS 10500:2012 Drinking Water — Specification
  phMin: 6.5,
  phMax: 8.5,
  phWarningMargin: 0.25,
  turbidityAcceptableMax: 1.0, // NTU (Acceptable Limit)
  turbidityPermissibleMax: 5.0, // NTU (Permissible Limit in absence of alternate source)
  // Operational engineering thresholds (clearly separated from BIS statutory limits)
  tempOperationalMax: 30.0,
  pressureMinBar: 1.5,
  pressureMaxBar: 4.5,
  flowMinLpm: 45,
  flowMaxLpm: 380,
  // Early-warning rate-of-change thresholds
  phSpikeDelta: 0.45,
  turbiditySpikeDelta: 1.2,
  pressureDropDeltaBar: 0.5,
  staleTimeoutSec: 30,
  pressureUnit: 'bar',
};

export function formatPressure(barValue: number | null, unit: 'bar' | 'psi'): string {
  if (barValue === null || Number.isNaN(barValue)) return 'N/A';
  if (unit === 'psi') {
    return `${(barValue * 14.5038).toFixed(1)} PSI`;
  }
  return `${barValue.toFixed(2)} bar`;
}

export function evaluateSensorConnectivity(
  node: PipelineNode,
  nowMs: number,
  staleTimeoutSec: number
): { status: ConnectivityStatus; note: string } {
  if (node.connectivity === 'disconnected') {
    return {
      status: 'disconnected',
      note: 'No telemetry heartbeat received from node microcontroller.',
    };
  }

  const lastMs = Date.parse(node.lastHeartbeat);
  const ageSec = Number.isFinite(lastMs) ? (nowMs - lastMs) / 1000 : 9999;

  if (ageSec > staleTimeoutSec * 2) {
    return {
      status: 'disconnected',
      note: `Heartbeat timed out (${Math.round(ageSec)}s since last packet).`,
    };
  }

  const r = node.currentReading;
  // Physical plausibility check for faulty sensor probes (e.g., broken electrode or short circuit)
  if (r.ph < 0.5 || r.ph > 13.8 || r.turbidity < 0 || r.turbidity > 1000) {
    return {
      status: 'faulty',
      note: 'Probe reading outside physical sensor bounds; inspect analog conditioning circuit or electrode.',
    };
  }

  // Flatline stale check if last 6 readings are bit-identical
  if (node.history.length >= 6) {
    const tail = node.history.slice(-6);
    const allSame = tail.every(
      (item) =>
        item.ph === tail[0].ph &&
        item.turbidity === tail[0].turbidity &&
        item.temperature === tail[0].temperature
    );
    if (allSame) {
      return {
        status: 'stale',
        note: 'Telemetry values have remained completely unchanged across 6 consecutive intervals (possible ADC freeze).',
      };
    }
  }

  if (ageSec > staleTimeoutSec) {
    return {
      status: 'stale',
      note: `Delayed packet arrival (${Math.round(ageSec)}s elapsed).`,
    };
  }

  return {
    status: 'connected',
    note: 'ESP32 telemetry stream active and calibrated.',
  };
}

export function analyzeNode(
  node: PipelineNode,
  standards: StandardsConfig,
  upstreamNode?: PipelineNode | null,
  nowMs: number = Date.now()
): NodeAnalysis {
  const r = node.currentReading;
  const history = node.history;
  const assessments: ParameterAssessment[] = [];
  const anomalies: AnomalyFinding[] = [];
  const recommendations: RecommendationItem[] = [];

  const health = evaluateSensorConnectivity(node, nowMs, standards.staleTimeoutSec);

  // 1. pH Assessment (BIS IS 10500: 6.5 - 8.5, no relaxation)
  let phStatus: QualityStatus = 'safe';
  let phReason = 'Within BIS IS 10500 acceptable limits (6.5–8.5).';
  if (r.ph < standards.phMin || r.ph > standards.phMax) {
    phStatus = 'critical';
    phReason =
      r.ph < standards.phMin
        ? `Acidic excursion below BIS IS 10500 lower limit (${standards.phMin}).`
        : `Alkaline excursion above BIS IS 10500 upper limit (${standards.phMax}).`;
  } else if (
    r.ph < standards.phMin + standards.phWarningMargin ||
    r.ph > standards.phMax - standards.phWarningMargin
  ) {
    phStatus = 'warning';
    phReason = 'Approaching BIS IS 10500 boundary; monitor buffering trend closely.';
  }
  assessments.push({
    parameter: 'ph',
    label: 'pH Level',
    value: r.ph,
    unit: 'pH',
    expectedRange: `${standards.phMin.toFixed(1)} – ${standards.phMax.toFixed(1)}`,
    status: phStatus,
    reason: phReason,
  });

  // 2. Turbidity Assessment (BIS IS 10500: <= 1 NTU acceptable, <= 5 NTU permissible)
  let turbStatus: QualityStatus = 'safe';
  let turbReason = `Within BIS IS 10500 acceptable limit (≤ ${standards.turbidityAcceptableMax.toFixed(1)} NTU).`;
  if (r.turbidity > standards.turbidityPermissibleMax) {
    turbStatus = 'critical';
    turbReason = `Exceeds BIS IS 10500 permissible ceiling (${standards.turbidityPermissibleMax.toFixed(1)} NTU).`;
  } else if (r.turbidity > standards.turbidityAcceptableMax) {
    turbStatus = 'warning';
    turbReason = `Exceeds BIS acceptable limit (${standards.turbidityAcceptableMax.toFixed(1)} NTU); within permissible fallback ceiling (${standards.turbidityPermissibleMax.toFixed(1)} NTU).`;
  }
  assessments.push({
    parameter: 'turbidity',
    label: 'Turbidity',
    value: r.turbidity,
    unit: 'NTU',
    expectedRange: `≤ ${standards.turbidityAcceptableMax.toFixed(1)} NTU (max ${standards.turbidityPermissibleMax.toFixed(1)})`,
    status: turbStatus,
    reason: turbReason,
  });

  // 3. Water Temperature (Operational monitoring)
  let tempStatus: QualityStatus = 'safe';
  let tempReason = 'Within normal operational temperature band.';
  if (r.temperature > standards.tempOperationalMax + 4) {
    tempStatus = 'critical';
    tempReason = 'Elevated thermal reading may accelerate disinfectant decay and sensor drift.';
  } else if (r.temperature > standards.tempOperationalMax) {
    tempStatus = 'warning';
    tempReason = 'Above operational thermal baseline; verify chlorine residual manually.';
  }
  assessments.push({
    parameter: 'temperature',
    label: 'Water Temp',
    value: r.temperature,
    unit: '°C',
    expectedRange: `10.0 – ${standards.tempOperationalMax.toFixed(1)} °C (operational)`,
    status: tempStatus,
    reason: tempReason,
  });

  // 4. Pipeline Pressure (Hydraulic monitoring)
  let pressStatus: QualityStatus = 'safe';
  let pressReason = 'Nominal distribution residual pressure.';
  if (r.pressure === null) {
    pressReason = 'Pressure transducer telemetry not attached on this node.';
  } else if (r.pressure < standards.pressureMinBar * 0.7 || r.pressure > standards.pressureMaxBar * 1.15) {
    pressStatus = 'critical';
    pressReason =
      r.pressure < standards.pressureMinBar
        ? 'Severe pressure loss; risk of back-siphonage or main rupture.'
        : 'Over-pressurization risk; inspect pressure-reducing valve.';
  } else if (r.pressure < standards.pressureMinBar || r.pressure > standards.pressureMaxBar) {
    pressStatus = 'warning';
    pressReason =
      r.pressure < standards.pressureMinBar
        ? 'Low residual head below operational minimum.'
        : 'Pressure above nominal operational target.';
  }
  assessments.push({
    parameter: 'pressure',
    label: 'Pipeline Pressure',
    value: r.pressure,
    unit: standards.pressureUnit,
    expectedRange:
      standards.pressureUnit === 'psi'
        ? `${(standards.pressureMinBar * 14.5038).toFixed(0)} – ${(standards.pressureMaxBar * 14.5038).toFixed(0)} PSI`
        : `${standards.pressureMinBar.toFixed(1)} – ${standards.pressureMaxBar.toFixed(1)} bar`,
    status: pressStatus,
    reason: pressReason,
  });

  // 5. Flow Rate
  let flowStatus: QualityStatus = 'safe';
  let flowReason = 'Steady hydraulic flow within sector demand curve.';
  if (r.flowRate === null) {
    flowReason = 'Flow meter telemetry not attached on this node.';
  } else if (r.flowRate < standards.flowMinLpm * 0.5 || r.flowRate > standards.flowMaxLpm * 1.25) {
    flowStatus = 'critical';
    flowReason =
      r.flowRate < standards.flowMinLpm
        ? 'Near-zero flow condition; check upstream isolation valve or blockage.'
        : 'High flow surge consistent with downstream burst or hydrant open.';
  } else if (r.flowRate < standards.flowMinLpm || r.flowRate > standards.flowMaxLpm) {
    flowStatus = 'warning';
    flowReason = 'Flow rate outside typical diurnal operating envelope.';
  }
  assessments.push({
    parameter: 'flowRate',
    label: 'Flow Rate',
    value: r.flowRate,
    unit: 'L/min',
    expectedRange: `${standards.flowMinLpm} – ${standards.flowMaxLpm} L/min`,
    status: flowStatus,
    reason: flowReason,
  });

  // --- EARLY-WARNING & ANOMALY DETECTION ---
  const recentWindow = history.slice(-8, -1); // preceding readings excluding current
  const baselineWindow = recentWindow.length > 0 ? recentWindow : history.slice(-1);

  if (baselineWindow.length >= 2) {
    const avgPh = baselineWindow.reduce((acc, s) => acc + s.ph, 0) / baselineWindow.length;
    const avgTurb = baselineWindow.reduce((acc, s) => acc + s.turbidity, 0) / baselineWindow.length;
    const phDelta = r.ph - avgPh;
    const turbDelta = r.turbidity - avgTurb;

    if (Math.abs(phDelta) >= standards.phSpikeDelta) {
      anomalies.push({
        id: `anom-ph-${node.id}-${r.id}`,
        nodeId: node.id,
        nodeName: node.name,
        type: 'sudden_ph_shift',
        title: `Sudden pH Shift (${phDelta > 0 ? '+' : ''}${phDelta.toFixed(2)} pH)`,
        description: `Current pH (${r.ph.toFixed(2)}) deviated sharply from trailing window mean (${avgPh.toFixed(2)}).`,
        severity: Math.abs(phDelta) >= standards.phSpikeDelta * 1.4 || phStatus === 'critical' ? 'critical' : 'warning',
        detectedAt: r.timestamp,
        confidenceNote: 'Rule: Rolling-window delta exceedance.',
      });
    }

    if (turbDelta >= standards.turbiditySpikeDelta) {
      anomalies.push({
        id: `anom-turb-${node.id}-${r.id}`,
        nodeId: node.id,
        nodeName: node.name,
        type: 'turbidity_spike',
        title: `Rapid Turbidity Rise (+${turbDelta.toFixed(2)} NTU)`,
        description: `Turbidity climbed from trailing baseline ${avgTurb.toFixed(2)} NTU to ${r.turbidity.toFixed(2)} NTU.`,
        severity: r.turbidity > standards.turbidityPermissibleMax || turbDelta >= standards.turbiditySpikeDelta * 2 ? 'critical' : 'warning',
        detectedAt: r.timestamp,
        confidenceNote: 'Rule: Positive rate-of-change spike detector.',
      });
    }
  }

  // Persistent abnormality check (3+ consecutive warning/critical readings)
  if (history.length >= 4) {
    const lastFour = history.slice(-4);
    const persistentTurb = lastFour.every((s) => s.turbidity > standards.turbidityAcceptableMax);
    const persistentPh = lastFour.every((s) => s.ph < standards.phMin || s.ph > standards.phMax);
    if (persistentTurb || persistentPh) {
      anomalies.push({
        id: `anom-persist-${node.id}-${r.id}`,
        nodeId: node.id,
        nodeName: node.name,
        type: 'persistent_abnormality',
        title: 'Persistent Out-of-Spec Reading (4+ Intervals)',
        description: persistentPh
          ? 'Sustained pH non-compliance across consecutive intervals rather than transient noise.'
          : 'Sustained elevated turbidity across consecutive intervals.',
        severity: persistentPh || r.turbidity > standards.turbidityPermissibleMax ? 'critical' : 'warning',
        detectedAt: r.timestamp,
        confidenceNote: 'Rule: Multi-interval persistence filter.',
      });
    }
  }

  // Multi-parameter unusual combination (e.g., pH shift + turbidity spike + pressure drop)
  const abnormalQualityCount = [phStatus, turbStatus].filter((s) => s !== 'safe').length;
  const abnormalHydraulicCount = [pressStatus, flowStatus].filter((s) => s !== 'safe').length;
  if (abnormalQualityCount >= 2 || (abnormalQualityCount >= 1 && abnormalHydraulicCount >= 1)) {
    anomalies.push({
      id: `anom-corr-${node.id}-${r.id}`,
      nodeId: node.id,
      nodeName: node.name,
      type: 'multi_parameter_correlation',
      title: 'Correlated Multi-Parameter Event',
      description:
        abnormalQualityCount >= 2
          ? 'Simultaneous pH and turbidity anomalies detected. Possible ingress, cross-connection, or treatment dosing fault; laboratory grab sampling required.'
          : 'Water quality shift coincided with hydraulic pressure/flow disturbance, indicating potential intrusion during low-pressure transient.',
      severity: 'critical',
      detectedAt: r.timestamp,
      confidenceNote: 'Rule: Cross-sensor correlation detector (screening indicator only).',
    });
  }

  // --- PIPELINE LEAKAGE HEURISTICS (SUSPECTED VS CONFIRMED) ---
  let suspectedLeakage = false;
  let leakageReason: string | null = null;
  if (r.pressure !== null && baselineWindow.length >= 2) {
    const validPress = baselineWindow.filter((s) => s.pressure !== null);
    if (validPress.length > 0) {
      const avgPress = validPress.reduce((acc, s) => acc + (s.pressure ?? 0), 0) / validPress.length;
      const pressDrop = r.pressure - avgPress;
      const avgFlow =
        baselineWindow.filter((s) => s.flowRate !== null).reduce((acc, s) => acc + (s.flowRate ?? 0), 0) /
        Math.max(1, baselineWindow.filter((s) => s.flowRate !== null).length);

      if (pressDrop <= -standards.pressureDropDeltaBar) {
        suspectedLeakage = true;
        const flowText =
          r.flowRate !== null && avgFlow > 0
            ? ` and flow shifted by ${(((r.flowRate - avgFlow) / avgFlow) * 100).toFixed(1)}%`
            : '';
        leakageReason = `Suspected leakage: Pressure dropped by ${Math.abs(pressDrop).toFixed(2)} bar relative to baseline${flowText}. Requires field acoustic/valve check before confirming.`;
        anomalies.push({
          id: `anom-leak-${node.id}-${r.id}`,
          nodeId: node.id,
          nodeName: node.name,
          type: 'suspected_leakage',
          title: 'Suspected Pipeline Leakage Indicator',
          description: leakageReason,
          severity: Math.abs(pressDrop) >= standards.pressureDropDeltaBar * 1.6 ? 'critical' : 'warning',
          detectedAt: r.timestamp,
          confidenceNote: 'Hydraulic screening only — not yet field-confirmed.',
        });
      }
    }
  }

  // Upstream vs Downstream mass-balance flow divergence check
  if (
    !suspectedLeakage &&
    upstreamNode &&
    upstreamNode.currentReading.flowRate !== null &&
    r.flowRate !== null &&
    upstreamNode.currentReading.flowRate > 50
  ) {
    const lossRatio = (upstreamNode.currentReading.flowRate - r.flowRate) / upstreamNode.currentReading.flowRate;
    if (lossRatio > 0.32 && r.pressure !== null && r.pressure < standards.pressureMinBar) {
      suspectedLeakage = true;
      leakageReason = `Suspected inter-node loss: Downstream flow is ${(lossRatio * 100).toFixed(0)}% lower than ${upstreamNode.name} alongside low residual pressure.`;
    }
  }

  if (health.status === 'faulty' || health.status === 'disconnected' || health.status === 'stale') {
    anomalies.push({
      id: `anom-health-${node.id}-${r.id}`,
      nodeId: node.id,
      nodeName: node.name,
      type: 'sensor_fault',
      title: `Sensor Health: ${health.status.toUpperCase()}`,
      description: health.note,
      severity: health.status === 'disconnected' || health.status === 'faulty' ? 'critical' : 'warning',
      detectedAt: r.timestamp,
      confidenceNote: 'Telemetry integrity monitor.',
    });
  }

  // --- SMART RECOMMENDATION ENGINE ---
  if (phStatus !== 'safe') {
    recommendations.push({
      id: `rec-ph-${node.id}`,
      category: 'source_inspection',
      priority: phStatus,
      title: 'Inspect Source & Chemical Dosing',
      action:
        r.ph < standards.phMin
          ? 'Verify alum/coagulant dosing rate at treatment outlet and inspect for acidic industrial cross-connection.'
          : 'Inspect lime/alkali dosing pump and check recent cement-mortar pipe lining sections.',
      rationale: 'pH outside 6.5–8.5 reduces disinfection efficacy and accelerates pipe corrosion or scaling.',
    });
  }

  if (turbStatus !== 'safe') {
    recommendations.push({
      id: `rec-turb-${node.id}`,
      category: 'filtration',
      priority: turbStatus,
      title: 'Inspect Filtration & Flush Sediment',
      action:
        'Check rapid sand filter backwash cycles, inspect recent excavation/repair zones for sediment intrusion, and perform hydrant flushing if localized.',
      rationale: 'Suspended particulates shield microorganisms from residual chlorine and indicate filtration or main disturbance.',
    });
  }

  if (suspectedLeakage || pressStatus !== 'safe') {
    recommendations.push({
      id: `rec-hyd-${node.id}`,
      category: 'hydraulics',
      priority: pressStatus === 'critical' || suspectedLeakage ? 'critical' : 'warning',
      title: 'Field Pipeline Inspection for Suspected Leakage',
      action:
        'Dispatch line crew to inspect pressure zone valves, listen for acoustic leak signatures, and isolate sector if pressure drops below 1.0 bar to prevent contaminant back-siphonage.',
      rationale: 'Negative or low transient pressure creates ingress pathways through joints and hairline cracks.',
    });
  }

  if (abnormalQualityCount >= 2 || anomalies.some((a) => a.type === 'multi_parameter_correlation')) {
    recommendations.push({
      id: `rec-lab-${node.id}`,
      category: 'lab_sampling',
      priority: 'critical',
      title: 'Initiate Grab Sampling & Laboratory Verification',
      action:
        'Collect sterile grab samples at the node tap for free residual chlorine, TDS, heavy metals, and microbiological culture (E. coli / total coliform) per BIS IS 10500.',
      rationale:
        'Physical-chemical sensors (pH & turbidity) serve as rapid early-warning screening indicators and cannot confirm or identify specific pathogens or chemical contaminants on their own.',
    });
  }

  if (health.status !== 'connected') {
    recommendations.push({
      id: `rec-maint-${node.id}`,
      category: 'sensor_maintenance',
      priority: health.status === 'stale' ? 'warning' : 'critical',
      title: 'Verify Field Sensor Hardware & Telemetry Link',
      action:
        'Check ESP32 Wi-Fi/LoRa/GSM uplink RSSI, 5V power supply regulation, and clean the optical turbidity lens / pH glass bulb.',
      rationale: health.note,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: `rec-ok-${node.id}`,
      category: 'source_inspection',
      priority: 'info',
      title: 'Continue Routine Automated Surveillance',
      action: 'No corrective intervention needed. Maintain scheduled 14-day two-point pH buffer verification.',
      rationale: 'All monitored parameters comply with BIS IS 10500 acceptable thresholds.',
    });
  }

  // Overall node status
  let overallStatus: QualityStatus = 'safe';
  const statuses = assessments.map((a) => a.status);
  if (statuses.includes('critical') || anomalies.some((a) => a.severity === 'critical')) {
    overallStatus = 'critical';
  } else if (statuses.includes('warning') || anomalies.some((a) => a.severity === 'warning')) {
    overallStatus = 'warning';
  }

  return {
    nodeId: node.id,
    overallStatus,
    assessments,
    anomalies,
    recommendations,
    suspectedLeakage,
    leakageReason,
    sensorHealthNote: health.note,
  };
}

export function generateAlertsFromAnalysis(
  node: PipelineNode,
  analysis: NodeAnalysis,
  mode: 'demo' | 'live' | 'manual'
): WaterAlert[] {
  const alerts: WaterAlert[] = [];
  const r = node.currentReading;

  for (const assess of analysis.assessments) {
    if (assess.status === 'safe' || assess.value === null) continue;
    const rec =
      analysis.recommendations.find((item) => {
        if (assess.parameter === 'ph') return item.category === 'source_inspection';
        if (assess.parameter === 'turbidity') return item.category === 'filtration';
        return item.category === 'hydraulics';
      })?.action ?? 'Inspect monitoring point and verify with portable reference meter.';

    alerts.push({
      id: `ALT-${node.id.toUpperCase()}-${assess.parameter.toUpperCase()}-${Date.now().toString().slice(-5)}`,
      nodeId: node.id,
      nodeName: node.name,
      parameter: assess.label,
      actualValue: `${assess.value.toFixed(assess.parameter === 'flowRate' ? 0 : 2)} ${assess.unit}`,
      expectedRange: assess.expectedRange,
      severity: assess.status,
      detectedAt: r.timestamp,
      recommendedAction: rec,
      status: 'active',
      sourceMode: r.source ?? mode,
      ruleId: `RULE-THRESHOLD-${assess.parameter.toUpperCase()}`,
    });
  }

  for (const anom of analysis.anomalies) {
    if (anom.type === 'sudden_ph_shift' || anom.type === 'turbidity_spike' || anom.type === 'multi_parameter_correlation' || anom.type === 'suspected_leakage') {
      alerts.push({
        id: `ALT-${node.id.toUpperCase()}-ANOM-${Math.floor(Math.random() * 900 + 100)}`,
        nodeId: node.id,
        nodeName: node.name,
        parameter: anom.title,
        actualValue: `pH ${r.ph.toFixed(2)} · ${r.turbidity.toFixed(2)} NTU`,
        expectedRange: 'Baseline trend stability',
        severity: anom.severity,
        detectedAt: anom.detectedAt,
        recommendedAction:
          anom.type === 'multi_parameter_correlation'
            ? 'Initiate grab sampling and laboratory verification; pH/turbidity alone do not confirm specific pathogens.'
            : anom.description,
        status: 'active',
        sourceMode: r.source ?? mode,
        ruleId: `RULE-${anom.type.toUpperCase()}`,
      });
    }
  }

  return alerts;
}

/**
 * Experimental linear-slope + residual variance forecast.
 * Explicitly labeled experimental in the UI.
 */
export function computeExperimentalForecast(history: SensorReading[]): ForecastPoint[] {
  const window = history.slice(-12);
  if (window.length < 3) return [];

  const n = window.length;
  const linearSlope = (vals: number[]) => {
    const meanX = (n - 1) / 2;
    const meanY = vals.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - meanX) * (vals[i] - meanY);
      den += (i - meanX) * (i - meanX);
    }
    const slope = den === 0 ? 0 : num / den;
    // Dampen slope slightly to avoid runaway linear extrapolation
    return { slope: slope * 0.65, last: vals[n - 1], std: Math.sqrt(vals.reduce((a, b) => a + (b - meanY) ** 2, 0) / n) };
  };

  const phStats = linearSlope(window.map((w) => w.ph));
  const turbStats = linearSlope(window.map((w) => w.turbidity));

  const steps = [1, 2, 3, 4]; // +15m, +30m, +45m, +60m (assuming ~15m projection intervals)
  return steps.map((step) => {
    const phProj = Math.min(14, Math.max(0, Number((phStats.last + phStats.slope * step).toFixed(2))));
    const turbProj = Math.max(0.05, Number((turbStats.last + turbStats.slope * step).toFixed(2)));
    const phBand = Math.max(0.08, phStats.std * (1 + step * 0.25));
    const turbBand = Math.max(0.12, turbStats.std * (1 + step * 0.3));
    return {
      offsetMinutes: step * 15,
      label: `+${step * 15}m`,
      phProjected: phProj,
      turbidityProjected: turbProj,
      phLower: Number(Math.max(0, phProj - phBand).toFixed(2)),
      phUpper: Number(Math.min(14, phProj + phBand).toFixed(2)),
      turbidityLower: Number(Math.max(0, turbProj - turbBand).toFixed(2)),
      turbidityUpper: Number((turbProj + turbBand).toFixed(2)),
    };
  });
}
