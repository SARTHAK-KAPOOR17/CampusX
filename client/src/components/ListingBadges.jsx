// client/src/components/ListingBadges.jsx
import React from 'react';

const STATUS_STYLES = {
  DRAFT: 'bg-slate-600/20 text-slate-300 border-slate-500/40',
  ACTIVE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  RESERVED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  SOLD: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  EXPIRED: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  UNDER_REVIEW: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const CONDITION_STYLES = {
  NEW: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  LIKE_NEW: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  GOOD: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  FAIR: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  USED: 'bg-slate-600/25 text-slate-300 border-slate-500/40',
};

const CONDITION_LABELS = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  USED: 'Used',
};

export const ListingStatusBadge = ({ status }) => {
  if (!status) return null;
  const style = STATUS_STYLES[status] || STATUS_STYLES.DRAFT;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
};

export const ConditionBadge = ({ condition }) => {
  if (!condition) return null;
  const style = CONDITION_STYLES[condition] || CONDITION_STYLES.USED;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style}`}
    >
      {CONDITION_LABELS[condition] || condition}
    </span>
  );
};
