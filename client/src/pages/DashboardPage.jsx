// client/src/pages/DashboardPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  UserCheck,
  Mail,
  LogOut,
  RefreshCw,
  AlertTriangle,
  UserCircle,
  ExternalLink,
  ArrowRight,
  TrendingUp,
  Package,
  Users,
  Star,
} from 'lucide-react';
import { m } from 'framer-motion';
import { useAuthStore } from '../store';
import { authApi, resolveAssetUrl } from '../services/api';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { tapFeedback } from '../lib/motion';

export const DashboardPage = () => {
  const { user, logout, logoutAll, setAuth, accessToken } = useAuthStore();
  const [syncMessage, setSyncMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'stats' | 'security'
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

  const avatarUrl = resolveAssetUrl(user?.profilePictureUrl);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      {/* Prompt banner for unverified users */}
      {!user?.isVerifiedStudent && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-amber-200">
                Verify your university email to unlock your Student Badge
              </h2>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Student verification will be required for marketplace listings and campus chat.
              </p>
            </div>
          </div>

          <Link
            to="/verify"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs sm:text-sm transition shrink-0 self-start sm:self-center"
          >
            Verify Now
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-700/60">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-600 shadow-lg"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{user?.name}</h1>
                {user?.isVerifiedStudent && <VerifiedBadge compact />}
                {user?.authProvider === 'GOOGLE' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/25 text-xs font-semibold">
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Google Account
                  </span>
                )}
              </div>
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

        {/* Animated Tabs with layoutId pill */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-900/70 border border-slate-700/60 w-fit">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'stats', label: 'Campus Activity' },
            { id: 'security', label: 'Security & Tokens' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {activeTab === tab.id && (
                <m.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-blue-600 rounded-lg shadow-sm"
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Account & Verification
              </span>
              <p className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" />
                {user?.isVerifiedStudent
                  ? `Verified (${user?.collegeEmail})`
                  : 'Active • Pending College Verification'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Authentication Method
              </span>
              <p className="text-sm font-medium text-slate-200">
                {user?.authProvider === 'GOOGLE'
                  ? user?.hasPassword
                    ? 'Google Sign-In + Email Password'
                    : 'Google Sign-In (Password not set)'
                  : 'Email & Password'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" /> Students
              </span>
              <div className="text-2xl font-bold text-white">
                <AnimatedCounter value={1420} duration={600} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-400" /> Active Listings
              </span>
              <div className="text-2xl font-bold text-white">
                <AnimatedCounter value={84} duration={600} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" /> Trades
              </span>
              <div className="text-2xl font-bold text-white">
                <AnimatedCounter value={312} duration={600} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400" /> Rating
              </span>
              <div className="text-2xl font-bold text-white">
                <AnimatedCounter value={4.9} duration={600} suffix=" ★" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Token Storage Policy
              </span>
              <p className="text-sm font-medium text-slate-200">
                Access token in memory • Refresh token in httpOnly cookie
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Session Status
              </span>
              <p className="text-sm font-medium text-emerald-400">
                Active & Encrypted (TLS + CSP)
              </p>
            </div>
          </div>
        )}

        {syncMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
            {syncMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            to="/profile"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition flex items-center gap-2"
          >
            <UserCircle className="w-4 h-4" />
            Edit Profile
          </Link>

          {user?.id && (
            <Link
              to={`/users/${user.id}`}
              className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Public Profile
            </Link>
          )}

          <m.button
            whileTap={tapFeedback.whileTap}
            onClick={handleVerifyMe}
            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Verify Session (/me)
          </m.button>

          <m.button
            whileTap={tapFeedback.whileTap}
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-sm font-medium transition flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </m.button>

          <m.button
            whileTap={tapFeedback.whileTap}
            onClick={handleLogoutAll}
            className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-700 text-sm font-medium transition"
          >
            Logout All Devices
          </m.button>
        </div>
      </div>
    </div>
  );
};
