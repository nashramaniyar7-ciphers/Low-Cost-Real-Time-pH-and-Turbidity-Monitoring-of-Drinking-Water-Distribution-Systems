import React, { useState } from 'react';
import { Bell, Check, CheckCheck, Send } from 'lucide-react';
import { NotificationDispatch, WaterAlert } from '../types/water';

interface AlertsViewProps {
  alerts: WaterAlert[];
  notifications: NotificationDispatch[];
  onUpdateAlertStatus: (id: string, status: 'acknowledged' | 'resolved') => void;
  onResolveAll: () => void;
  onSimulateDispatch: (alert: WaterAlert, channel: NotificationDispatch['channel']) => void;
}

export function AlertsView({
  alerts,
  notifications,
  onUpdateAlertStatus,
  onResolveAll,
  onSimulateDispatch,
}: AlertsViewProps) {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');

  const filtered = alerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => a.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Alert Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'critical', 'warning'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sev === 'all' ? 'All Severities' : sev}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'active', 'acknowledged', 'resolved'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onResolveAll}
          disabled={activeCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Acknowledge & Resolve Active ({activeCount})</span>
        </button>
      </div>

      {/* Main Split: Structured Alerts + Simulated Notification Centre */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Water Quality & Hydraulic Alert Feed</h2>
              <p className="text-xs text-slate-500">
                Showing {filtered.length} of {alerts.length} recorded alert events
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
              No alerts match the selected filter criteria.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filtered.map((alert) => (
                <div key={alert.id} className="py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-slate-800">{alert.id}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-medium text-slate-900">{alert.nodeName}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500 font-mono uppercase">{alert.sourceMode}</span>
                    </div>

                    <span
                      className={`text-xs font-semibold ${
                        alert.severity === 'critical' ? 'text-rose-700' : 'text-amber-700'
                      }`}
                    >
                      {alert.severity === 'critical' ? '✖ Critical' : '▲ Warning'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-500 block">Detected Parameter</span>
                      <span className="font-semibold text-slate-900">{alert.parameter}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Actual Measured Value</span>
                      <span className="font-mono tabular-nums font-semibold text-rose-700">
                        {alert.actualValue}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Expected Acceptable Range</span>
                      <span className="font-mono tabular-nums text-slate-700">{alert.expectedRange}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700">
                    <strong className="text-slate-900">Recommended Action:</strong> {alert.recommendedAction}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <span className="font-mono text-slate-500">
                      Detected {new Date(alert.detectedAt).toLocaleString()} · Status:{' '}
                      <strong className="capitalize text-slate-700">{alert.status}</strong>
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {alert.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => onUpdateAlertStatus(alert.id, 'acknowledged')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-slate-100 text-slate-800 rounded hover:bg-slate-200 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Acknowledge</span>
                        </button>
                      )}
                      {alert.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => onUpdateAlertStatus(alert.id, 'resolved')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-teal-600 text-white rounded hover:bg-teal-700 cursor-pointer"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Mark Resolved</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSimulateDispatch(alert, 'SMS Gateway')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-50 rounded cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Simulate SMS Dispatch</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Simulated Notification Centre */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-sky-700" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Simulated Notification Centre</h2>
              <p className="text-[11px] text-slate-500">
                Demonstration log of municipal SMS, SCADA webhook, and email dispatches (no external SMS gateway required).
              </p>
            </div>
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              No alert notifications dispatched yet. Trigger a scenario or click &ldquo;Simulate SMS Dispatch&rdquo;.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-800">{n.channel}</span>
                    <span className="font-mono text-[11px]">{new Date(n.dispatchedAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    To: {n.recipient} · SIMULATED DISPATCH
                  </div>
                  <p className="text-slate-700 leading-relaxed">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
