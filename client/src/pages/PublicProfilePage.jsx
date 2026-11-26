// client/src/pages/PublicProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, GraduationCap, BookOpen, Calendar, AlertCircle, ArrowLeft } from 'lucide-react';
import { usersApi, resolveAssetUrl } from '../services/api';
import { VerifiedBadge } from '../components/VerifiedBadge';

export const PublicProfilePage = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    usersApi
      .getPublicProfile(id)
      .then((res) => {
        if (!active) return;
        setProfile(res?.data?.profile || null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Profile could not be loaded.');
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
        <p className="text-sm text-slate-400">Loading public profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-lg mx-auto my-14 p-8 rounded-2xl bg-slate-800/80 border border-rose-500/30 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Profile Unavailable</h2>
        <p className="text-sm text-slate-400">{error || 'This user profile was not found.'}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    );
  }

  const avatarUrl = resolveAssetUrl(profile.profilePictureUrl);
  const filledStars = Math.round(profile.ratingAverage || 0);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-700/60">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={profile.name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-600 shadow-lg shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-2xl shrink-0">
              {profile.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}

          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
              {profile.isVerifiedStudent && <VerifiedBadge />}
            </div>

            {/* Rating Placeholder */}
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <div className="flex items-center gap-0.5" aria-label="User rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= filledStars
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-600'
                    }`}
                  />
                ))}
              </div>
              <span className="font-semibold text-white">
                {Number(profile.ratingAverage || 0).toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">
                ({profile.ratingCount || 0} {profile.ratingCount === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          </div>
        </div>

        {/* Academic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
              Course
            </span>
            <p className="text-sm font-medium text-slate-200">
              {profile.course || 'Not specified'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              Branch
            </span>
            <p className="text-sm font-medium text-slate-200">
              {profile.branch || 'Not specified'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Year
            </span>
            <p className="text-sm font-medium text-slate-200">
              {profile.year ? `Year ${profile.year}` : 'Not specified'}
            </p>
          </div>
        </div>

        {/* Bio */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-700/40 space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            About
          </span>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
            {profile.bio || 'This student has not added a bio yet.'}
          </p>
        </div>
      </div>
    </div>
  );
};
