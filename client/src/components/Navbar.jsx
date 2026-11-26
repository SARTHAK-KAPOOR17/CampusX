// client/src/components/Navbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LogOut,
  LogIn,
  UserPlus,
  LayoutDashboard,
  UserCircle,
  Store,
  PlusCircle,
  Package,
} from 'lucide-react';
import { useAuthStore } from '../store';
import { VerifiedBadge } from './VerifiedBadge';

export const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-lg">
              CX
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              CampusX
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/marketplace"
              className="text-xs sm:text-sm text-slate-200 hover:text-white hover:bg-slate-800 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5"
            >
              <Store className="w-4 h-4 text-blue-400" />
              <span>Marketplace</span>
            </Link>

            <Link
              to="/sell"
              className="text-xs sm:text-sm text-slate-200 hover:text-white hover:bg-slate-800 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Sell</span>
            </Link>

            {isAuthenticated && (
              <Link
                to="/my-listings"
                className="text-xs sm:text-sm text-slate-200 hover:text-white hover:bg-slate-800 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5"
              >
                <Package className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">My Listings</span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="text-xs sm:text-sm text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              >
                <LayoutDashboard className="w-4 h-4 text-blue-400" />
                <span className="hidden md:inline">Dashboard</span>
              </Link>
              <Link
                to="/profile"
                className="text-xs sm:text-sm text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              >
                <UserCircle className="w-4 h-4 text-indigo-400" />
                <span className="hidden md:inline">Profile</span>
              </Link>
              {user?.isVerifiedStudent && <VerifiedBadge compact className="hidden xl:inline-flex" />}
              <button
                onClick={handleLogout}
                className="text-xs sm:text-sm text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 px-2.5 py-1.5 rounded-lg border border-rose-500/30 transition flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
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
