// client/src/components/Navbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut, LogIn, UserPlus, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '../store';

export const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-xl">
            CX
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              CampusX
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Day 2 Auth + RBAC
            </span>
          </div>
        </Link>

        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-1 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mr-1" />
            <span>MERN + Postgres + Prisma</span>
          </div>

          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="text-xs sm:text-sm text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              >
                <LayoutDashboard className="w-4 h-4 text-blue-400" />
                <span>Dashboard</span>
              </Link>
              <span className="hidden sm:inline-block text-xs font-mono px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                {user?.name} ({user?.role})
              </span>
              <button
                onClick={handleLogout}
                className="text-xs sm:text-sm text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 px-3 py-1.5 rounded-lg border border-rose-500/30 transition flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-xs sm:text-sm text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </Link>
              <Link
                to="/signup"
                className="text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shadow-sm shadow-blue-600/30"
              >
                <UserPlus className="w-4 h-4" />
                <span>Signup</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
