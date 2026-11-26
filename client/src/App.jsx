// client/src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { VerificationPage } from './pages/VerificationPage';
import { ProfilePage } from './pages/ProfilePage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { SellPage } from './pages/SellPage';
import { MyListingsPage } from './pages/MyListingsPage';
import { useAuthStore } from './store';

function App() {
  const silentRefresh = useAuthStore((state) => state.silentRefresh);

  // Attempt silent session restore via httpOnly refresh cookie on app load
  useEffect(() => {
    silentRefresh();
  }, [silentRefresh]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between">
        <div>
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/users/:id" element={<PublicProfilePage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/verify"
                element={
                  <ProtectedRoute>
                    <VerificationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sell"
                element={
                  <ProtectedRoute>
                    <SellPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sell/:id/edit"
                element={
                  <ProtectedRoute>
                    <SellPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-listings"
                element={
                  <ProtectedRoute>
                    <MyListingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <RoleRoute allowedRoles={['ADMIN', 'MODERATOR']}>
                    <DashboardPage />
                  </RoleRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>

        <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-400">
          <p>CampusX Engineering Team • MERN + PostgreSQL + Prisma + FastAPI • 20-Day Campus Marketplace Sprint</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
