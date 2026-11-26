// client/src/App.jsx
import React from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between">
      <div>
        <Navbar />
        <main>
          <LandingPage />
        </main>
      </div>

      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-400">
        <p>CampusX Engineering Team • MERN + PostgreSQL + Prisma + FastAPI • 20-Day Campus Marketplace Sprint</p>
      </footer>
    </div>
  );
}

export default App;
