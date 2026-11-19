import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LiveReadingRecord {
  id: string;
  nodeId: string;
  timestamp: string;
  ph: number;
  turbidity: number;
  temperature: number;
  pressure: number | null;
  flowRate: number | null;
  source: 'live';
  signalStrengthDbm?: number;
  batteryMv?: number;
}

interface LiveNodeStore {
  nodeId: string;
  name: string;
  zone: string;
  lastHeartbeat: string;
  currentReading: LiveReadingRecord;
  history: LiveReadingRecord[];
}

const liveNodesMap = new Map<string, LiveNodeStore>();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'aquaguard-ai-telemetry',
      liveNodesConnected: liveNodesMap.size,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      timestamp: new Date().toISOString(),
    });
  });

  // Hardware Ingestion Endpoint (ESP32 HTTP POST or MQTT-to-HTTP Bridge)
  app.post('/api/sensors/ingest', (req: Request, res: Response) => {
    const body = req.body ?? {};
    const nodeId = typeof body.nodeId === 'string' && body.nodeId.trim() ? body.nodeId.trim() : null;
    const ph = Number(body.ph);
    const turbidity = Number(body.turbidity);
    const temperature = Number(body.temperature ?? 24.0);
    const pressure = body.pressure === undefined || body.pressure === null ? null : Number(body.pressure);
    const flowRate = body.flowRate === undefined || body.flowRate === null ? null : Number(body.flowRate);

    if (!nodeId || Number.isNaN(ph) || Number.isNaN(turbidity)) {
      res.status(400).json({
        error: 'Invalid telemetry payload. Required fields: nodeId (string), ph (number), turbidity (number).',
      });
      return;
    }

    const nowIso = typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString();
    const record: LiveReadingRecord = {
      id: `live-${nodeId}-${Date.now()}`,
      nodeId,
      timestamp: nowIso,
      ph: Number(ph.toFixed(2)),
      turbidity: Number(Math.max(0, turbidity).toFixed(2)),
      temperature: Number((Number.isNaN(temperature) ? 24.0 : temperature).toFixed(1)),
      pressure: pressure !== null && !Number.isNaN(pressure) ? Number(pressure.toFixed(2)) : null,
      flowRate: flowRate !== null && !Number.isNaN(flowRate) ? Number(flowRate.toFixed(0)) : null,
      source: 'live',
      signalStrengthDbm: typeof body.rssi === 'number' ? body.rssi : undefined,
      batteryMv: typeof body.batteryMv === 'number' ? body.batteryMv : undefined,
    };

    const existing = liveNodesMap.get(nodeId);
    const history = existing ? [...existing.history.slice(-79), record] : [record];
    liveNodesMap.set(nodeId, {
      nodeId,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : `Live Node · ${nodeId}`,
      zone: typeof body.zone === 'string' && body.zone.trim() ? body.zone.trim() : 'Field Hardware Feed',
      lastHeartbeat: nowIso,
      currentReading: record,
      history,
    });

    res.status(201).json({
      accepted: true,
      nodeId,
      receivedAt: nowIso,
      historyCount: history.length,
    });
  });

  // Live Sensor Polling Endpoint
  app.get('/api/sensors/live', (_req: Request, res: Response) => {
    const nodes = Array.from(liveNodesMap.values());
    res.json({
      mode: 'live',
      count: nodes.length,
      nodes,
      fetchedAt: new Date().toISOString(),
    });
  });

  // Clear live hardware buffer (for field testing reset)
  app.delete('/api/sensors/live', (_req: Request, res: Response) => {
    liveNodesMap.clear();
    res.json({ cleared: true });
  });

  // Server-Side Gemini AI Anomaly & Root-Cause Analysis
  app.post('/api/ai/analyze', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in server secrets. Deterministic rule-based and statistical anomaly detection remains active.',
      });
      return;
    }

    const { nodeName, zone, recentReadings, activeAnomalies, standards } = req.body ?? {};
    if (!Array.isArray(recentReadings) || recentReadings.length === 0) {
      res.status(400).json({ error: 'recentReadings array is required for telemetry analysis.' });
      return;
    }

    const promptPayload = {
      nodeName: String(nodeName ?? 'Unknown Node'),
      zone: String(zone ?? 'Distribution Pipeline'),
      standardsSummary: standards ?? { phRange: '6.5-8.5', turbidityAcceptableMax: 1.0, turbidityPermissibleMax: 5.0 },
      recentReadings: recentReadings.slice(-15),
      activeRuleAnomalies: activeAnomalies ?? [],
    };

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyze this drinking-water distribution pipeline telemetry window:\n${JSON.stringify(
          promptPayload,
          null,
          2
        )}`,
        config: {
          systemInstruction:
            'You are a senior municipal water-quality engineer and IoT telemetry analyst. ' +
            'Evaluate the provided sensor readings against BIS IS 10500 guidelines (pH 6.5-8.5; turbidity acceptable <= 1.0 NTU, permissible <= 5.0 NTU) and hydraulic trends. ' +
            'CRITICAL SCIENTIFIC CONSTRAINT: Never claim that pH, turbidity, temperature, or pressure sensors alone confirm or identify any specific pathogen (like E. coli) or specific chemical toxin. Always frame findings as physical-chemical screening indicators requiring field verification and laboratory grab sampling when abnormal. ' +
            'Keep summary concise (2-3 sentences), list 2-4 plausible engineering hypotheses, 2-4 concrete field inspection actions, and an explicit sensor-limitation caveat.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              hypotheses: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendedFieldChecks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              limitationsNote: { type: Type.STRING },
            },
            required: ['summary', 'hypotheses', 'recommendedFieldChecks', 'limitationsNote'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        summary: parsed.summary ?? 'Analysis complete.',
        hypotheses: Array.isArray(parsed.hypotheses) ? parsed.hypotheses : [],
        recommendedFieldChecks: Array.isArray(parsed.recommendedFieldChecks) ? parsed.recommendedFieldChecks : [],
        limitationsNote:
          parsed.limitationsNote ??
          'Physical-chemical probes cannot confirm microbiological pathogens; verify anomalies via laboratory testing.',
        modelUsed: 'gemini-4-hydrogen',
        analyzedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upstream AI analysis failed.';
      res.status(502).json({
        error: `AI telemetry analysis failed: ${message}`,
      });
    }
  });

  // Vite middleware in dev / static files in production
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  if (!isProd || !fs.existsSync(distPath)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`AquaGuard AI server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
