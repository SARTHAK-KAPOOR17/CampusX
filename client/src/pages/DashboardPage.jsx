// client/src/pages/DashboardPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, UserCheck, Mail, LogOut, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store';
import { authApi } from '../services/api';

export const DashboardPage = () => {
  const { user, logout, logoutAll, setAuth, accessToken } = useAuthStore();
  const [syncMessage, setSyncMessage] = useState('');
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleLogoutAll = async () => {
    await logoutAll();
    navigate('/login');
  };

  const handleVerifyMe = async () => {
    setSyncMessage('');
    try {
      const res = await authApi.me();
      if (res?.data?.user) {
        setAuth({ user: res.data.user, accessToken });
        setSyncMessage('Session verified via GET /api/auth/me');
      }
    } catch (err) {
      setSyncMessage(err.message || 'Verification failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-700/60">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{user?.name}</h1>
              <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                {user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <Shield className="w-3.5 h-3.5" />
              ROLE: {user?.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Account Status
            </span>
            <p className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" />
              {user?.isActive ? 'Active & Authenticated' : 'Inactive'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Token Storage Policy
            </span>
            <p className="text-sm font-medium text-slate-200">
              Access token in memory • Refresh token in httpOnly cookie
            </p>
          </div>
        </div>

        {syncMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
            {syncMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleVerifyMe}
            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Verify Session (/me)
          </button>

          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-sm font-medium transition flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>

          <button
            onClick={handleLogoutAll}
            className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-700 text-sm font-medium transition"
          >
            Logout All Devices
          </button>
        </div>
      </div>
    </div>
  );
};
