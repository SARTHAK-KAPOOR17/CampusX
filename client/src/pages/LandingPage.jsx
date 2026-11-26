// client/src/pages/LandingPage.jsx
import React from 'react';
import { useHealth } from '../hooks/useHealth';
import { HealthCard } from '../components/HealthCard';
import {
  Sparkles,
  BookOpen,
  Laptop,
  Home,
  CheckCircle2,
  Lock,
  Boxes,
  Activity,
  ArrowRight,
  GitPullRequest
} from 'lucide-react';

export const LandingPage = () => {
  const { serverHealth, aiHealth, loading, refetch, lastChecked } = useHealth();

  const features = [
    {
      icon: <Lock className="w-5 h-5 text-blue-400" />,
      title: 'Verified Student Network',
      description: 'Zero spam, zero stranger danger. Authenticated strictly via verified university email credentials.',
    },
    {
      icon: <Sparkles className="w-5 h-5 text-indigo-400" />,
      title: 'AI Price & Condition Estimator',
      description: 'Dedicated FastAPI engine scans listings to suggest fair student pricing based on campus market trends.',
    },
    {
      icon: <BookOpen className="w-5 h-5 text-emerald-400" />,
      title: 'Course-Matched Textbooks',
      description: 'Swap and buy semester textbooks directly mapped to university course codes and syllabi.',
    },
    {
      icon: <Laptop className="w-5 h-5 text-amber-400" />,
      title: 'Campus Electronics & Dorm Gear',
      description: 'Safe handoffs on campus quads and student unions without shipping delays or payment fraud.',
    },
  ];

  const milestones = [
    { name: 'Express Modular Monolith', status: 'done', detail: 'src/modules, src/config, src/utils, src/middleware' },
    { name: 'Security Middlewares', status: 'done', detail: 'Helmet, CORS Whitelist, Rate Limiter, XSS Sanitization' },
    { name: 'Prisma ORM & PostgreSQL', status: 'done', detail: 'PostgreSQL datasource with initial User model' },
    { name: 'Vite React + Tailwind CSS', status: 'done', detail: 'Custom hook telemetry, modular components, responsive UI' },
    { name: 'FastAPI AI Skeleton', status: 'done', detail: 'Async /health microservice ready for vector embeddings' },
    { name: 'Docker Compose Orchestration', status: 'done', detail: 'PostgreSQL, Server, Client, AI service healthchecks' },
    { name: 'GitHub Actions CI Pipeline', status: 'done', detail: 'Automated install, lint, test, and build matrix' },
    { name: 'Supertest & Jest Test Suite', status: 'done', detail: 'Central error handling and /api/health coverage' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          DAY 1: Project Foundation & Architecture Online
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
          The AI-Powered Marketplace for{' '}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            University Campuses
          </span>
        </h1>
        <p className="text-base sm:text-lg text-slate-300">
          Peer-to-peer student commerce reimagined with verified student trust, smart AI pricing, and clean modular engineering.
        </p>
      </div>

      {/* Live System Health Telemetry */}
      <HealthCard
        serverHealth={serverHealth}
        aiHealth={aiHealth}
        loading={loading}
        onRefresh={refetch}
        lastChecked={lastChecked}
      />

      {/* Day 1 Deliverables Checklist */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Boxes className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-white">Day 1 Architecture Deliverables</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {milestones.map((m, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/80"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-200">{m.name}</p>
                <p className="text-xs text-slate-400">{m.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Marketplace Vision Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((feat, idx) => (
          <div
            key={idx}
            className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 transition flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mb-3 border border-slate-700/80">
                {feat.icon}
              </div>
              <h3 className="font-bold text-white text-base mb-1">{feat.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{feat.description}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center text-xs text-blue-400 font-medium">
              Coming in Roadmap <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
