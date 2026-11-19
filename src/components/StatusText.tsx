import React from 'react';
import { ConnectivityStatus, QualityStatus } from '../types/water';

export function QualityStatusLabel({
  status,
  className = '',
}: {
  status: QualityStatus;
  className?: string;
}) {
  if (status === 'critical') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 ${className}`}>
        <span aria-hidden="true">✖</span>
        <span>Critical</span>
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 ${className}`}>
        <span aria-hidden="true">▲</span>
        <span>Warning</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 ${className}`}>
      <span aria-hidden="true">●</span>
      <span>Safe</span>
    </span>
  );
}

export function ConnectivityLabel({
  status,
  isLiveStream = false,
}: {
  status: ConnectivityStatus;
  isLiveStream?: boolean;
}) {
  if (status === 'disconnected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
        <span className="w-2 h-2 rounded-full bg-rose-600" aria-hidden="true" />
        <span>Disconnected</span>
      </span>
    );
  }
  if (status === 'faulty') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
        <span aria-hidden="true">▲</span>
        <span>Probe Fault</span>
      </span>
    );
  }
  if (status === 'stale') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
        <span>Stale Data</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
      <span
        className={`w-2 h-2 rounded-full bg-teal-600 ${isLiveStream ? 'animate-pulse' : ''}`}
        aria-hidden="true"
      />
      <span>Connected</span>
    </span>
  );
}
