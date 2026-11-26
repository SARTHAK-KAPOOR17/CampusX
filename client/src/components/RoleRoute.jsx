// client/src/components/RoleRoute.jsx
import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store';

export const RoleRoute = ({ allowedRoles = [], children }) => {
  const { user, isAuthenticated, isInitializing } = useAuthStore();

  if (isInitializing) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-300 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Checking permissions...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user?.role)) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-2xl bg-slate-800/70 border border-rose-500/30 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-sm text-slate-400">
          Your current role (<span className="font-mono text-rose-300">{user?.role}</span>) does not
          have permission to view this page. Required: {allowedRoles.join(' or ')}.
        </p>
        <Link
          to="/dashboard"
          className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return children;
};
