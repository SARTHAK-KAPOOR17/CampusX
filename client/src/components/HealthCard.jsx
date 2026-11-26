// client/src/components/HealthCard.jsx
import React from 'react';
import { StatusBadge } from './StatusBadge';
import { Server, Database, Cpu, Clock, RefreshCw } from 'lucide-react';

export const HealthCard = ({ serverHealth, aiHealth, loading, onRefresh, lastChecked }) => {
  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">System Health & Telemetry</h3>
            <p className="text-xs text-slate-400">Live heartbeat of CampusX containerized services</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-600 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Probing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        {/* Express Server Health */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-blue-400" />
                Express API
              </span>
              <StatusBadge status={serverHealth?.status} />
            </div>
            <p className="text-sm font-medium text-slate-200">
              {serverHealth?.service || 'campusx-server'}
            </p>
            <div className="mt-2 space-y-1 text-xs text-slate-400">
              <p className="flex justify-between">
                <span>Uptime:</span>
                <span className="font-mono text-slate-300">
                  {serverHealth?.uptime ? `${Math.floor(serverHealth.uptime)}s` : 'N/A'}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Environment:</span>
                <span className="font-mono text-slate-300">
                  {serverHealth?.environment || 'development'}
                </span>
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
            Endpoint: <code className="text-blue-400">/api/health</code>
          </div>
        </div>

        {/* PostgreSQL / Prisma Health */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                PostgreSQL DB
              </span>
              <StatusBadge status={serverHealth?.database?.status} />
            </div>
            <p className="text-sm font-medium text-slate-200">Prisma ORM Client</p>
            <div className="mt-2 space-y-1 text-xs text-slate-400">
              <p className="flex justify-between">
                <span>Query Latency:</span>
                <span className="font-mono text-slate-300">
                  {serverHealth?.database?.latencyMs != null
                    ? `${serverHealth.database.latencyMs}ms`
                    : 'N/A'}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Dialect:</span>
                <span className="font-mono text-slate-300">PostgreSQL 16</span>
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
            Schema: <code className="text-indigo-400">users</code> (Placeholder Model)
          </div>
        </div>

        {/* FastAPI AI Service Health */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                FastAPI AI Service
              </span>
              <StatusBadge status={aiHealth?.status} />
            </div>
            <p className="text-sm font-medium text-slate-200">
              {aiHealth?.service || 'campusx-ai-service'}
            </p>
            <div className="mt-2 space-y-1 text-xs text-slate-400">
              <p className="flex justify-between">
                <span>Status:</span>
                <span className="font-mono text-slate-300">
                  {aiHealth?.status || 'offline'}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Version:</span>
                <span className="font-mono text-slate-300">{aiHealth?.version || '1.0.0'}</span>
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
            Endpoint: <code className="text-purple-400">:8000/health</code>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          Last telemetry heartbeat: {lastChecked || 'Just now'}
        </span>
        <span className="text-slate-400">
          All health checks strictly conform to standard JSON schema
        </span>
      </div>
    </div>
  );
};
