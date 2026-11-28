// client/src/components/GoogleSignInButton.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { authApi } from '../services/api';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let gisScriptLoadingPromise = null;
const loadGisScript = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.google?.accounts?.id) return Promise.resolve(window.google);

  if (!gisScriptLoadingPromise) {
    gisScriptLoadingPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google));
        existing.addEventListener('error', (e) => reject(e));
        return;
      }
      const script = document.createElement('script');
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = (e) => reject(e);
      document.body.appendChild(script);
    });
  }
  return gisScriptLoadingPromise;
};

export const GoogleSignInButton = ({ redirectTo = '/dashboard' }) => {
  const containerRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const { googleLogin, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let mounted = true;

    // Check backend feature flag & frontend clientId presence
    authApi
      .getConfig()
      .then((res) => {
        if (!mounted) return;
        const serverGoogleEnabled = Boolean(res?.data?.googleEnabled);
        if (serverGoogleEnabled && clientId) {
          setEnabled(true);
        } else {
          setEnabled(false);
        }
      })
      .catch(() => {
        if (mounted) setEnabled(false);
      });

    return () => {
      mounted = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (!enabled || !clientId || !containerRef.current) return;
    let cancelled = false;

    loadGisScript()
      .then((google) => {
        if (cancelled || !google?.accounts?.id || !containerRef.current) return;

        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (!response?.credential) return;
            try {
              setLoadError(null);
              await googleLogin({ credential: response.credential });
              navigate(redirectTo, { replace: true });
            } catch (err) {
              setLoadError(err.message || 'Google sign-in failed');
            }
          },
        });

        // Clear container and render official GIS button
        containerRef.current.innerHTML = '';
        google.accounts.id.renderButton(containerRef.current, {
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 384,
          logo_alignment: 'left',
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError('Failed to load Google Sign-In services');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, clientId, googleLogin, navigate, redirectTo]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center justify-center space-y-2">
      {loadError && (
        <p className="text-xs text-rose-400 text-center">{loadError}</p>
      )}
      <div
        ref={containerRef}
        className="w-full flex items-center justify-center min-h-[44px]"
        aria-label="Google Sign-In"
      />
    </div>
  );
};
