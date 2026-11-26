// client/src/pages/MarketplacePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen, PlusCircle, Tag, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { categoriesApi, productsApi } from '../services/api';
import { ConditionBadge, ListingStatusBadge } from '../components/ListingBadges';
import { VerifiedBadge } from '../components/VerifiedBadge';

export const MarketplacePage = () => {
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    categoriesApi
      .list()
      .then((res) => setCategories(res?.data?.categories || []))
      .catch(() => {});
  }, []);

  const fetchProducts = useCallback(async (page, categoryId) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 12 };
      if (categoryId) params.categoryId = categoryId;
      const res = await productsApi.list(params);
      setProducts(res?.data?.products || []);
      setPagination(res?.data?.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load marketplace listings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(pagination.page, selectedCategoryId);
  }, [fetchProducts, pagination.page, selectedCategoryId]);

  const handleCategorySelect = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-blue-400" />
            Campus Marketplace
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse verified student listings across campus categories
          </p>
        </div>

        <Link
          to="/sell"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition shadow-lg shadow-blue-600/20 self-start sm:self-center"
        >
          <PlusCircle className="w-4 h-4" />
          Sell an Item
        </Link>
      </div>

      {/* Category Chips Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => handleCategorySelect('')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
            selectedCategoryId === ''
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
          }`}
        >
          All Categories
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategorySelect(cat.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
              selectedCategoryId === cat.id
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Grid / Loading / Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-80 rounded-2xl bg-slate-800/60 border border-slate-700/60 animate-pulse"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-16 px-6 rounded-2xl bg-slate-800/50 border border-slate-700/60 text-center space-y-4">
          <PackageOpen className="w-12 h-12 text-slate-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">No listings found</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            There are no active listings in this category yet. Be the first student to post an item!
          </p>
          <Link
            to="/sell"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
          >
            <PlusCircle className="w-4 h-4" />
            Create Listing
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="group bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700/80 hover:border-blue-500/50 overflow-hidden transition flex flex-col justify-between shadow-lg"
              >
                <div>
                  {/* Placeholder Image Block (real uploads on Day 5) */}
                  <div className="h-44 bg-gradient-to-br from-slate-700/50 via-slate-800 to-slate-900 flex flex-col items-center justify-center relative border-b border-slate-700/60">
                    <ShoppingBag className="w-10 h-10 text-slate-500 group-hover:text-blue-400 transition" />
                    <span className="text-[11px] text-slate-500 mt-2">Image coming Day 5</span>
                    {product.status === 'RESERVED' && (
                      <div className="absolute top-3 right-3">
                        <ListingStatusBadge status="RESERVED" />
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                        <Tag className="w-3 h-3" />
                        {product.category?.name || 'General'}
                      </span>
                      <ConditionBadge condition={product.condition} />
                    </div>

                    <h3 className="font-bold text-white text-base line-clamp-2 group-hover:text-blue-300 transition">
                      {product.title}
                    </h3>

                    <p className="text-xl font-extrabold text-emerald-400">
                      ₹{Number(product.price || 0).toLocaleString('en-IN')}
                      {product.isNegotiable && (
                        <span className="ml-2 text-[11px] font-normal text-slate-400">
                          Negotiable
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-700/60 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300 truncate">
                    {product.seller?.name || 'Student'}
                  </span>
                  {product.seller?.isVerifiedStudent && <VerifiedBadge compact />}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 border border-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="text-xs text-slate-400">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
              </span>
              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(prev.totalPages, prev.page + 1),
                  }))
                }
                disabled={pagination.page >= pagination.totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 border border-slate-700"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
