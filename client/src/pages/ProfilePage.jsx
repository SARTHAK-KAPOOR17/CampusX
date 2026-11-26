// client/src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  Save,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { usersApi, resolveAssetUrl } from '../services/api';
import { useAuthStore } from '../store';
import { VerifiedBadge } from '../components/VerifiedBadge';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export const ProfilePage = () => {
  const { user, accessToken, setAuth } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [course, setCourse] = useState(user?.course || '');
  const [branch, setBranch] = useState(user?.branch || '');
  const [year, setYear] = useState(user?.year ? String(user.year) : '');
  const [bio, setBio] = useState(user?.bio || '');

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [avatarError, setAvatarError] = useState('');
  const [avatarLoading, setAvatarLoading] = useState(false);

  const [formError, setFormError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    usersApi
      .getMyProfile()
      .then((res) => {
        if (!active || !res?.data?.user) return;
        const p = res.data.user;
        setAuth({ user: p, accessToken });
        setName(p.name || '');
        setCourse(p.course || '');
        setBranch(p.branch || '');
        setYear(p.year ? String(p.year) : '');
        setBio(p.bio || '');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [accessToken, setAuth]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e) => {
    setAvatarError('');
    setSaveMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAvatarError('Only JPEG, PNG, and WebP images are allowed.');
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image size must be 2MB or smaller.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!selectedFile) return;
    setAvatarError('');
    setSaveMessage('');
    setAvatarLoading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', selectedFile);
      const res = await usersApi.uploadAvatar(formData);
      if (res?.data?.user) {
        setAuth({ user: res.data.user, accessToken });
      }
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setSaveMessage('Avatar updated successfully!');
    } catch (err) {
      setAvatarError(err.message || 'Failed to upload avatar.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaveMessage('');

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setFormError('Name must be between 2 and 80 characters.');
      return;
    }
    if (year !== '' && (Number(year) < 1 || Number(year) > 6 || !Number.isInteger(Number(year)))) {
      setFormError('Academic year must be between 1 and 6.');
      return;
    }
    if (bio.length > 300) {
      setFormError('Bio must be at most 300 characters.');
      return;
    }

    setSaving(true);
    try {
      const res = await usersApi.updateMyProfile({
        name: trimmedName,
        course: course.trim() || null,
        branch: branch.trim() || null,
        year: year === '' ? null : Number(year),
        bio: bio.trim() || null,
      });
      if (res?.data?.user) {
        setAuth({ user: res.data.user, accessToken });
        setBio(res.data.user.bio || '');
      }
      setSaveMessage('Profile updated successfully!');
    } catch (err) {
      setFormError(err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const currentAvatarUrl = previewUrl || resolveAssetUrl(user?.profilePictureUrl);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-xl space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-700/60">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-white">Your Profile</h1>
              {user?.isVerifiedStudent && <VerifiedBadge compact />}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Manage your campus identity and public marketplace profile
            </p>
          </div>

          {user?.id && (
            <Link
              to={`/users/${user.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-xs sm:text-sm font-medium text-slate-200 border border-slate-600 transition self-start"
            >
              <ExternalLink className="w-4 h-4 text-blue-400" />
              View Public Profile
            </Link>
          )}
        </div>

        {/* Avatar Upload Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-5 rounded-xl bg-slate-900/60 border border-slate-700/60">
          <div className="relative shrink-0">
            {currentAvatarUrl ? (
              <img
                src={currentAvatarUrl}
                alt={user?.name || 'Profile avatar'}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-600 shadow-lg"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-2xl">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2.5">
            <div>
              <h2 className="text-sm font-semibold text-white">Profile Picture</h2>
              <p className="text-xs text-slate-400">
                JPEG, PNG, or WebP up to 2MB. Verified by file signature.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-600 transition">
                <Camera className="w-4 h-4 text-blue-400" />
                <span>Choose Image</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {selectedFile && (
                <button
                  type="button"
                  onClick={handleAvatarUpload}
                  disabled={avatarLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition"
                >
                  {avatarLoading ? 'Uploading...' : 'Upload Avatar'}
                </button>
              )}
            </div>

            {avatarError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {avatarError}
              </p>
            )}
          </div>
        </div>

        {/* Feedback Banners */}
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        {saveMessage && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{saveMessage}</span>
          </div>
        )}

        {/* Profile Form */}
        <form onSubmit={handleSaveProfile} className="space-y-5" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="profile-name"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="profile-course"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Course / Degree
              </label>
              <div className="relative">
                <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="profile-course"
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g., B.Tech, M.S., MBA"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-branch"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Branch / Major
              </label>
              <div className="relative">
                <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="profile-branch"
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g., Computer Science"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-year"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Academic Year (1–6)
              </label>
              <select
                id="profile-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Not specified</option>
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={String(y)}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile-bio"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Bio
              </label>
              <span
                className={`text-xs font-mono ${
                  bio.length > 300 ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {bio.length}/300
              </span>
            </div>
            <textarea
              id="profile-bio"
              rows={3}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell fellow students what you study or trade on campus..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/20"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};
