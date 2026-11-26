// client/src/pages/MyListingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  PlusCircle,
  Edit3,
  Trash2,
  Send,
  CheckCircle2,
  RotateCcw,
  Bookmark,
  AlertTriangle,
} from 'lucide-react';
import { productsApi } from '../services/api';
import { ConditionBadge, ListingStatusBadge } from '../components/ListingBadges';

const STATUS_TABS = ['', 'ACTIVE', 'DRAFT', 'RESERVED', 'SOLD', 'EXPIRED', 'UNDER_REVIEW'];

export const MyListingsPage = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadMine = useCallback(async (status) => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (status) params.status = status;
      const res = await productsApi.mine(params);
      setProducts(res?.data?.products || []);
    } catch (err) {
      setError(err.message || 'Failed to load your listings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMine(statusFilter);
  }, [loadMine, statusFilter]);

  const handlePublish = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await productsApi.publish(id);
      await loadMine(statusFilter);
    } catch (err) {
      setError(err.message || 'Could not publish draft.');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChange = async (id, targetStatus) => {
    setBusyId(id);
    setError('');
    try {
      await productsApi.updateStatus(id, targetStatus);
      await loadMine(statusFilter);
    } catch (err) {
      setError(err.message || 'Could not update listing status.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setError('');
    try {
      await productsApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadMine(statusFilter);
    } catch (err) {
      setError(err.message || 'Could not delete listing.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Package className="w-7 h-7 text-amber-400" />
            My Listings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage drafts, active listings, reservations, sold items, and relists
          </p>
        </div>

        <Link
          to="/sell"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition self-start sm:self-center"
        >
          <PlusCircle className="w-4 h-4" />
          New Listing
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab || 'ALL'}
            onClick={() => setStatusFilter(tab)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
              statusFilter === tab
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            {tab ? tab.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-24 rounded-2xl bg-slate-800/60 border border-slate-700/60 animate-pulse"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-14 px-6 rounded-2xl bg-slate-800/50 border border-slate-700/60 text-center space-y-3">
          <Package className="w-10 h-10 text-slate-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">No listings in this status</h2>
          <p className="text-sm text-slate-400">
            Create a new listing or switch status tabs above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((item) => {
            const isBusy = busyId === item.id;
            const editable = ['DRAFT', 'ACTIVE', 'RESERVED'].includes(item.status);

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ListingStatusBadge status={item.status} />
                    <ConditionBadge condition={item.condition} />
                    {item.category && (
                      <span className="text-xs text-slate-400">{item.category.name}</span>
                    )}
                  </div>

                  <Link
                    to={`/products/${item.id}`}
                    className="block font-bold text-lg text-white hover:text-blue-300 transition truncate"
                  >
                    {item.title}
                  </Link>

                  <p className="text-sm text-slate-300">
                    {item.price !== null
                      ? `₹${Number(item.price).toLocaleString('en-IN')}`
                      : 'Draft (no price set)'}{' '}
                    <span className="text-xs text-slate-500 ml-2">• {item.viewCount} views</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {editable && (
                    <Link
                      to={`/sell/${item.id}/edit`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium text-slate-100 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </Link>
                  )}

                  {item.status === 'DRAFT' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handlePublish(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Publish
                    </button>
                  )}

                  {item.status === 'ACTIVE' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleStatusChange(item.id, 'RESERVED')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      Mark Reserved
                    </button>
                  )}

                  {item.status === 'RESERVED' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleStatusChange(item.id, 'ACTIVE')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Make Active
                    </button>
                  )}

                  {(item.status === 'ACTIVE' || item.status === 'RESERVED') && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleStatusChange(item.id, 'SOLD')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Sold
                    </button>
                  )}

                  {item.status === 'EXPIRED' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleStatusChange(item.id, 'ACTIVE')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Relist
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setDeleteTarget(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Delete Listing?</h2>
                <p className="text-xs text-slate-300 mt-1">
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-white">&ldquo;{deleteTarget.title}&rdquo;</span>?
                  {deleteTarget.status === 'DRAFT'
                    ? ' Drafts are permanently deleted.'
                    : ' Published listings are archived from public view.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === deleteTarget.id}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-semibold text-white transition"
              >
                {busyId === deleteTarget.id ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
