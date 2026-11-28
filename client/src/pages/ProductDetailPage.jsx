// client/src/pages/ProductDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
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
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Heart,
} from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { productsApi, resolveAssetUrl } from '../services/api';
import { ConditionBadge, ListingStatusBadge } from '../components/ListingBadges';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { SmartImage } from '../components/SmartImage';
import { MOTION_SPRINGS, tapFeedback, heartPop } from '../lib/motion';

export const ProductDetailPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const loadProduct = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const res = await productsApi.getById(id);
      setProduct(res?.data?.product || null);
      setActiveIndex(0);
    } catch (err) {
      setError(err.message || 'Listing could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct(true);
  }, [loadProduct]);

  const images = Array.isArray(product?.images) ? product.images : [];
  const safeIndex = activeIndex < images.length ? activeIndex : 0;
  const activeImage = images[safeIndex] || null;

  useEffect(() => {
    if (!lightboxOpen || images.length === 0) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') setActiveIndex((prev) => (prev + 1) % images.length);
      if (e.key === 'ArrowLeft') setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, images.length]);

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
        {/* Left: Product Gallery & Details */}
        <div className="lg:col-span-2 bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 overflow-hidden shadow-xl">
          <div className="bg-slate-900/80 border-b border-slate-700/60">
            <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-slate-700/40 via-slate-800 to-slate-900 overflow-hidden">
              {activeImage ? (
                <m.div
                  key={activeImage.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="w-full h-full block group focus:outline-none"
                    aria-label="Open full-size image lightbox"
                  >
                    <SmartImage
                      src={activeImage.mediumUrl || activeImage.largeUrl}
                      blurDataUrl={activeImage.blurDataUrl}
                      alt={`${product.title} photo ${safeIndex + 1}`}
                      loading="eager"
                      className="w-full h-full object-contain bg-slate-950"
                      onUrlExpired={() => loadProduct(false)}
                    />
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 text-xs text-slate-200 border border-slate-700 opacity-85 group-hover:opacity-100 transition">
                      <Maximize2 className="w-3.5 h-3.5" />
                      Zoom
                    </span>
                  </button>

                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous photo"
                        onClick={() => setActiveIndex((prev) => (prev - 1 + images.length) % images.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-slate-700 flex items-center justify-center transition"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next photo"
                        onClick={() => setActiveIndex((prev) => (prev + 1) % images.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-slate-700 flex items-center justify-center transition"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </m.div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <ShoppingBag className="w-16 h-16 text-slate-500" />
                  <span className="text-xs text-slate-500 mt-3">No photos uploaded</span>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex items-center gap-2 p-3 overflow-x-auto bg-slate-900/90 border-t border-slate-800">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`View photo ${idx + 1}`}
                    className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition ${
                      idx === safeIndex
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-slate-700 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <SmartImage
                      src={img.thumbUrl}
                      blurDataUrl={img.blurDataUrl}
                      alt={`${product.title} thumbnail ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
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

            <div className="flex items-start justify-between gap-4">
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

              {/* Wishlist Button with Heart Pop */}
              <m.button
                whileTap={tapFeedback.whileTap}
                type="button"
                onClick={() => setIsSaved(!isSaved)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition shrink-0 ${
                  isSaved
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <m.div
                  animate={isSaved ? { scale: [0.8, 1.25, 1] } : { scale: 1 }}
                  transition={{ duration: 0.25 }}
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
                </m.div>
                <span>{isSaved ? 'Saved' : 'Wishlist'}</span>
              </m.button>
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
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-600 shrink-0">
                  <SmartImage
                    src={sellerAvatarUrl}
                    alt={product.seller?.name}
                    className="w-12 h-12 object-cover"
                    onUrlExpired={() => loadProduct(false)}
                  />
                </div>
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

      {/* Full-Screen Lightbox Modal */}
      {/* Full Size Photo Lightbox Modal */}
      <AnimatePresence>
        {lightboxOpen && activeImage && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label="Full-size photo lightbox"
            className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <m.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={MOTION_SPRINGS.modal}
              className="relative max-w-5xl w-full max-h-[85vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={activeImage.largeUrl || activeImage.mediumUrl}
                alt={`${product.title} full size ${safeIndex + 1}`}
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />

              <button
                type="button"
                aria-label="Close lightbox"
                onClick={() => setLightboxOpen(false)}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous lightbox photo"
                    onClick={() =>
                      setActiveIndex((prev) => (prev - 1 + images.length) % images.length)
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 flex items-center justify-center transition"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next lightbox photo"
                    onClick={() => setActiveIndex((prev) => (prev + 1) % images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 flex items-center justify-center transition"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </m.div>

            <p className="mt-3 text-xs font-mono text-slate-300">
              {safeIndex + 1} / {images.length} — Use arrow keys or Esc to close
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
