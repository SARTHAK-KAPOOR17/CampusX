// client/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuthStore();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-300 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
