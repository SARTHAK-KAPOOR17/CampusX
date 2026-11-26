// client/src/components/StatusBadge.jsx
import React from 'react';

export const StatusBadge = ({ status }) => {
  const isHealthy = status === 'healthy' || status === 'connected' || status === 'online';
  const isDegraded = status === 'degraded';

  if (isHealthy) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        {status.toUpperCase()}
      </span>
    );
  }

  if (isDegraded) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
        {status.toUpperCase()}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
      {status ? status.toUpperCase() : 'OFFLINE'}
    </span>
  );
};
