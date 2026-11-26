// client/src/components/VerifiedBadge.jsx
import React from 'react';
import { BadgeCheck } from 'lucide-react';

export const VerifiedBadge = ({ compact = false, className = '' }) => {
  return (
    <span
      title="Verified University Student"
      className={`inline-flex items-center gap-1 rounded-full font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${className}`}
    >
      <BadgeCheck className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-emerald-400 shrink-0`} />
      <span>Verified Student</span>
    </span>
  );
};
