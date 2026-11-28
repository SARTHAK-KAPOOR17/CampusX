// client/src/pages/MarketplacePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PackageOpen,
  PlusCircle,
  Tag,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Heart,
} from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { categoriesApi, productsApi } from '../services/api';
import { ConditionBadge, ListingStatusBadge } from '../components/ListingBadges';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { SmartImage } from '../components/SmartImage';
import { SearchBarAutocomplete } from '../components/SearchBarAutocomplete';
import { staggerContainer, staggerItem, tapFeedback, MOTION_SPRINGS } from '../lib/motion';

const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'USED', label: 'Used' },
];

export const MarketplacePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
    hasNext: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [wishlist, setWishlist] = useState(() => new Set());

  const toggleWishlist = (id) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Extract state from URL search params (shareable & back-button friendly)
  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const conditionParam = searchParams.get('condition') || '';
  const selectedConditions = conditionParam
    ? conditionParam.split(',').filter(Boolean)
    : [];
  const availability = searchParams.get('availability') || 'all';
  const isNegotiable = searchParams.get('isNegotiable') === 'true';
  const verifiedSeller = searchParams.get('verifiedSeller') === 'true';
  const sort = searchParams.get('sort') || (q ? 'relevance' : 'newest');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [minPriceDraft, setMinPriceDraft] = useState(minPrice);
  const [maxPriceDraft, setMaxPriceDraft] = useState(maxPrice);

  useEffect(() => {
    setMinPriceDraft(minPrice);
    setMaxPriceDraft(maxPrice);
  }, [minPrice, maxPrice]);

  useEffect(() => {
    categoriesApi
      .list()
      .then((res) => setCategories(res?.data?.categories || []))
      .catch(() => {});
  }, []);

  const updateParams = useCallback(
    (updates, resetPage = true) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '' || value === false) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      if (resetPage) {
        next.delete('page');
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 12 };
      if (q.trim()) params.q = q.trim();
      if (category) params.category = category;
      else if (categoryId) params.categoryId = categoryId;
      if (minPrice !== '') params.minPrice = minPrice;
      if (maxPrice !== '') params.maxPrice = maxPrice;
      if (conditionParam) params.condition = conditionParam;
      if (availability && availability !== 'all') params.availability = availability;
      if (isNegotiable) params.isNegotiable = true;
      if (verifiedSeller) params.verifiedSeller = true;
      if (sort) {
        if (sort === 'relevance' && !q.trim()) {
          params.sort = 'newest';
        } else {
          params.sort = sort;
        }
      }

      const res = await productsApi.list(params);
      setProducts(res?.data?.products || []);
      setPagination(
        res?.data?.pagination || {
          page: 1,
          limit: 12,
          total: 0,
          totalPages: 1,
          hasNext: false,
        }
      );
    } catch (err) {
      setError(err.message || 'Failed to load marketplace listings.');
    } finally {
      setLoading(false);
    }
  }, [
    q,
    category,
    categoryId,
    minPrice,
    maxPrice,
    conditionParam,
    availability,
    isNegotiable,
    verifiedSeller,
    sort,
    page,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const toggleCondition = (cond) => {
    const next = selectedConditions.includes(cond)
      ? selectedConditions.filter((c) => c !== cond)
      : [...selectedConditions, cond];
    updateParams({ condition: next.join(',') });
  };

  const applyPriceRange = (e) => {
    e.preventDefault();
    if (
      minPriceDraft !== '' &&
      maxPriceDraft !== '' &&
      Number(minPriceDraft) > Number(maxPriceDraft)
    ) {
      setError('Minimum price cannot exceed maximum price.');
      return;
    }
    setError('');
    updateParams({
      minPrice: minPriceDraft,
      maxPrice: maxPriceDraft,
    });
  };

  const clearAllFilters = () => {
    setError('');
    setSearchParams(new URLSearchParams());
  };

  const handleSearchSubmit = (term) => {
    const clean = (term || '').trim();
    const updates = { q: clean };
    if (clean && !searchParams.get('sort')) {
      updates.sort = 'relevance';
    } else if (!clean && sort === 'relevance') {
      updates.sort = '';
    }
    updateParams(updates);
  };

  // Build active filter chips
  const activeChips = [];
  if (q) activeChips.push({ key: 'q', label: `Search: "${q}"`, clear: () => handleSearchSubmit('') });
  if (category) {
    const matched = categories.find((c) => c.slug === category);
    activeChips.push({
      key: 'category',
      label: `Category: ${matched?.name || category}`,
      clear: () => updateParams({ category: '', categoryId: '' }),
    });
  } else if (categoryId) {
    const matched = categories.find((c) => c.id === categoryId);
    activeChips.push({
      key: 'categoryId',
      label: `Category: ${matched?.name || 'Selected'}`,
      clear: () => updateParams({ category: '', categoryId: '' }),
    });
  }
  if (minPrice !== '' || maxPrice !== '') {
    activeChips.push({
      key: 'price',
      label: `Price: ₹${minPrice || '0'} – ${maxPrice ? `₹${maxPrice}` : 'Any'}`,
      clear: () => updateParams({ minPrice: '', maxPrice: '' }),
    });
  }
  selectedConditions.forEach((cond) => {
    const label = CONDITIONS.find((c) => c.value === cond)?.label || cond;
    activeChips.push({
      key: `cond-${cond}`,
      label: `Condition: ${label}`,
      clear: () => toggleCondition(cond),
    });
  });
  if (availability !== 'all') {
    activeChips.push({
      key: 'availability',
      label: availability === 'available' ? 'Available Only' : 'Reserved Only',
      clear: () => updateParams({ availability: '' }),
    });
  }
  if (isNegotiable) {
    activeChips.push({
      key: 'isNegotiable',
      label: 'Negotiable',
      clear: () => updateParams({ isNegotiable: '' }),
    });
  }
  if (verifiedSeller) {
    activeChips.push({
      key: 'verifiedSeller',
      label: 'Verified Sellers Only',
      clear: () => updateParams({ verifiedSeller: '' }),
    });
  }

  const filterPanelContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-400" />
          Filters
        </h2>
        {activeChips.length > 0 && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Category</h3>
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => updateParams({ category: '', categoryId: '' })}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              !category && !categoryId
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-700/60'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => {
            const active = category === cat.slug || categoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => updateParams({ category: cat.slug, categoryId: '' })}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700/60'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Range */}
      <form onSubmit={applyPriceRange} className="space-y-2.5 pt-3 border-t border-slate-700/60">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Price Range (₹)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            placeholder="Min"
            value={minPriceDraft}
            onChange={(e) => setMinPriceDraft(e.target.value)}
            aria-label="Minimum price"
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            min="0"
            placeholder="Max"
            value={maxPriceDraft}
            onChange={(e) => setMaxPriceDraft(e.target.value)}
            aria-label="Maximum price"
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="w-full py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition"
        >
          Apply Price
        </button>
      </form>

      {/* Condition Checkboxes */}
      <div className="space-y-2 pt-3 border-t border-slate-700/60">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Condition</h3>
        <div className="space-y-1.5">
          {CONDITIONS.map((cond) => (
            <label
              key={cond.value}
              className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white"
            >
              <input
                type="checkbox"
                checked={selectedConditions.includes(cond.value)}
                onChange={() => toggleCondition(cond.value)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span>{cond.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Availability */}
      <div className="space-y-2 pt-3 border-t border-slate-700/60">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Availability
        </h3>
        <div className="space-y-1.5">
          {[
            { value: 'all', label: 'All (Active & Reserved)' },
            { value: 'available', label: 'Available Only' },
            { value: 'reserved', label: 'Reserved Only' },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white"
            >
              <input
                type="radio"
                name="availability"
                checked={availability === opt.value}
                onChange={() => updateParams({ availability: opt.value === 'all' ? '' : opt.value })}
                className="w-3.5 h-3.5 bg-slate-900 border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2.5 pt-3 border-t border-slate-700/60">
        <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
          <span>Negotiable price</span>
          <input
            type="checkbox"
            checked={isNegotiable}
            onChange={(e) => updateParams({ isNegotiable: e.target.checked ? 'true' : '' })}
            className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-blue-500"
          />
        </label>

        <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
          <span>Verified sellers only</span>
          <input
            type="checkbox"
            checked={verifiedSeller}
            onChange={(e) => updateParams({ verifiedSeller: e.target.checked ? 'true' : '' })}
            className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-blue-500"
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-blue-400" />
            Campus Marketplace
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Search verified student listings across campus categories
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

      {/* Search & Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1">
          <SearchBarAutocomplete
            initialValue={q}
            onSubmitSearch={handleSearchSubmit}
            onSelectCategory={(slug) => updateParams({ category: slug, categoryId: '' })}
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-semibold text-slate-200 transition"
          >
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            Filters
            {activeChips.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px]">
                {activeChips.length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              aria-label="Sort listings"
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value })}
              className="bg-transparent text-xs sm:text-sm font-medium text-slate-100 focus:outline-none cursor-pointer"
            >
              {q.trim() && (
                <option value="relevance" className="bg-slate-900">
                  Best Match
                </option>
              )}
              <option value="newest" className="bg-slate-900">
                Newest
              </option>
              <option value="price_asc" className="bg-slate-900">
                Price: Low to High
              </option>
              <option value="price_desc" className="bg-slate-900">
                Price: High to Low
              </option>
              <option value="popularity" className="bg-slate-900">
                Most Popular
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Layout: Desktop Filter Sidebar + Results */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <aside className="hidden lg:block w-64 shrink-0 bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-5 shadow-xl sticky top-24">
          {filterPanelContent}
        </aside>

        {/* Mobile Slide-Over Filter Drawer */}
        <AnimatePresence>
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <m.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={MOTION_SPRINGS.modal}
                className="relative ml-auto w-80 max-w-full bg-slate-900 border-l border-slate-700 h-full overflow-y-auto p-6 shadow-2xl space-y-6"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="font-bold text-white">Filter Listings</span>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    aria-label="Close filters"
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {filterPanelContent}
              </m.div>
            </div>
          )}
        </AnimatePresence>

        {/* Right Results Column */}
        <div className="flex-1 min-w-0 w-full space-y-5">
          {/* Result Count + Active Chips */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              {loading ? (
                'Searching marketplace...'
              ) : (
                <>
                  <span className="font-bold text-white">{pagination.total}</span>{' '}
                  {pagination.total === 1 ? 'listing' : 'listings'} found
                  {q ? (
                    <span className="text-slate-400"> for &ldquo;{q}&rdquo;</span>
                  ) : null}
                </>
              )}
            </p>

            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-xs font-medium text-blue-200 transition"
                  >
                    <span>{chip.label}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-semibold text-slate-400 hover:text-white underline px-1"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
            >
              {error}
            </div>
          )}

          {/* Grid / Skeletons / Empty State */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-80 rounded-2xl border border-slate-700/60 skeleton-shimmer"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 px-6 rounded-2xl bg-slate-800/50 border border-slate-700/60 text-center space-y-4">
              <PackageOpen className="w-12 h-12 text-slate-500 mx-auto" />
              <h2 className="text-lg font-bold text-white">No matching listings found</h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Try loosening your price range, clearing condition filters, or searching with fewer keywords.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                {activeChips.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
                  >
                    Clear All Filters
                  </button>
                )}
                <Link
                  to="/sell"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  Create Listing
                </Link>
              </div>
            </div>
          ) : (
            <>
              <m.div
                variants={staggerContainer(0.04)}
                initial="initial"
                animate="animate"
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
              >
                {products.map((product, idx) => (
                  <m.div
                    key={product.id}
                    variants={idx < 12 ? staggerItem : undefined}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="h-full flex flex-col"
                  >
                    <Link
                      to={`/products/${product.id}`}
                      className="group bg-slate-800/80 hover:bg-slate-800 rounded-2xl border border-slate-700/80 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 overflow-hidden transition flex flex-col justify-between shadow-lg h-full"
                    >
                      <div>
                        <div className="aspect-[4/3] w-full bg-gradient-to-br from-slate-700/50 via-slate-800 to-slate-900 relative border-b border-slate-700/60 overflow-hidden">
                          <SmartImage
                            src={product.primaryImage?.thumbUrl}
                            blurDataUrl={product.primaryImage?.blurDataUrl}
                            alt={product.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onUrlExpired={fetchProducts}
                          />

                          {/* Wishlist Heart Pop Button */}
                          <button
                            type="button"
                            aria-label="Save to wishlist"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleWishlist(product.id);
                            }}
                            className="absolute top-3 left-3 z-10 w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-900 border border-slate-700/60 flex items-center justify-center transition"
                          >
                            <m.div
                              animate={
                                wishlist.has(product.id)
                                  ? { scale: [0.8, 1.25, 1] }
                                  : { scale: 1 }
                              }
                              transition={{ duration: 0.25 }}
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  wishlist.has(product.id)
                                    ? 'fill-rose-500 text-rose-500'
                                    : 'text-slate-300'
                                }`}
                              />
                            </m.div>
                          </button>

                          {product.status === 'RESERVED' && (
                            <div className="absolute top-3 right-3 z-10">
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
                  </m.div>
                ))}
              </m.div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => updateParams({ page: Math.max(1, page - 1) }, false)}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-slate-200 border border-slate-700"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="text-xs text-slate-400">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateParams({ page: Math.min(pagination.totalPages, page + 1) }, false)
                    }
                    disabled={!pagination.hasNext && page >= pagination.totalPages}
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
      </div>
    </div>
  );
};
