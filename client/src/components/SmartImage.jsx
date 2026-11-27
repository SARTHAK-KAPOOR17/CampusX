// client/src/components/SmartImage.jsx
import React, { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';

/**
 * Image component with optional blurDataUrl background placeholder,
 * lazy loading, graceful fallback, and one-shot expired-URL recovery.
 */
export const SmartImage = ({
  src,
  blurDataUrl = null,
  alt = '',
  className = 'w-full h-full object-cover',
  loading = 'lazy',
  fallback = null,
  onUrlExpired = null,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retriedSrc, setRetriedSrc] = useState(null);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      fallback || (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700/50 via-slate-800 to-slate-900">
          <ShoppingBag className="w-10 h-10 text-slate-500" />
        </div>
      )
    );
  }

  const handleError = () => {
    if (onUrlExpired && retriedSrc !== src) {
      setRetriedSrc(src);
      onUrlExpired();
      return;
    }
    setFailed(true);
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-slate-900"
      style={
        blurDataUrl && !loaded
          ? {
              backgroundImage: `url("${blurDataUrl}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <img
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={`${className} transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
