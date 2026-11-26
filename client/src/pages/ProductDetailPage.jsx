// client/src/pages/ProductDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingBag,
  Tag,
  Eye,
  Calendar,
  MessageSquare,
  Star,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { productsApi, resolveAssetUrl } from '../services/api';
import { ConditionBadge, ListingStatusBadge } from '../components/ListingBadges';
import { VerifiedBadge } from '../components/VerifiedBadge';

export const ProductDetailPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    productsApi
      .getById(id)
      .then((res) => {
        if (!active) return;
        setProduct(res?.data?.product || null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Listing could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-300 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading listing details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 rounded-2xl bg-slate-800/80 border border-rose-500/30 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Listing Unavailable</h2>
        <p className="text-sm text-slate-400">{error || 'Listing not found.'}</p>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>
      </div>
    );
  }

  const sellerAvatarUrl = resolveAssetUrl(product.seller?.profilePictureUrl);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Marketplace
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Placeholder Image & Details */}
        <div className="lg:col-span-2 bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 overflow-hidden shadow-xl">
          <div className="h-72 sm:h-80 bg-gradient-to-br from-slate-700/40 via-slate-800 to-slate-900 flex flex-col items-center justify-center border-b border-slate-700/60">
            <ShoppingBag className="w-16 h-16 text-slate-500" />
            <span className="text-xs text-slate-500 mt-3">Product photos coming on Day 5</span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <ListingStatusBadge status={product.status} />
              <ConditionBadge condition={product.condition} />
              {product.category && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                  <Tag className="w-3 h-3" />
                  {product.category.name}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{product.title}</h1>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-3xl font-black text-emerald-400">
                  {product.price !== null
                    ? `₹${Number(product.price).toLocaleString('en-IN')}`
                    : 'Price not set'}
                </span>
                {product.isNegotiable && (
                  <span className="text-xs font-medium text-slate-400 bg-slate-900/70 px-2.5 py-1 rounded-lg border border-slate-700">
                    Price Negotiable
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-700/60">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Description
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {product.description || 'No description provided.'}
              </p>
            </div>

            {Array.isArray(product.tags) && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-700 text-xs text-slate-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-700/60 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                {product.viewCount} views
              </span>
              {product.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Published {new Date(product.publishedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action & Seller Card */}
        <div className="space-y-5">
          <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 shadow-xl space-y-4">
            <button
              type="button"
              disabled
              title="Offers and real-time chat are coming in later days"
              className="w-full py-3 px-4 rounded-xl bg-slate-700/60 text-slate-400 border border-slate-600/60 font-semibold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Make Offer / Chat</span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
                Coming soon
              </span>
            </button>
          </div>

          <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 shadow-xl space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Seller Information
            </h2>

            <Link
              to={`/users/${product.seller?.id}`}
              className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-700/60 transition group"
            >
              {sellerAvatarUrl ? (
                <img
                  src={sellerAvatarUrl}
                  alt={product.seller?.name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-600 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {product.seller?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="font-bold text-white text-sm truncate group-hover:text-blue-300 transition flex items-center gap-1.5">
                  {product.seller?.name}
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </p>
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{Number(product.seller?.ratingAverage || 0).toFixed(1)}</span>
                </div>
              </div>
            </Link>

            {product.seller?.isVerifiedStudent && <VerifiedBadge />}
          </div>
        </div>
      </div>
    </div>
  );
};
