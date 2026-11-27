// client/src/pages/SellPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ShieldAlert,
  ArrowRight,
  Save,
  Send,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';
import { categoriesApi, productsApi } from '../services/api';
import { useAuthStore } from '../store';
import { ProductImageUploader } from '../components/ProductImageUploader';

const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'USED', label: 'Used' },
];

export const SellPage = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState('GOOD');
  const [isNegotiable, setIsNegotiable] = useState(true);
  const [tagsInput, setTagsInput] = useState('');
  const [existingStatus, setExistingStatus] = useState('DRAFT');
  const [existingImages, setExistingImages] = useState([]);
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);

  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    categoriesApi
      .list()
      .then((res) => setCategories(res?.data?.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditMode) return;
    setLoadingInitial(true);
    productsApi
      .getById(id)
      .then((res) => {
        const p = res?.data?.product;
        if (!p) return;
        setTitle(p.title || '');
        setDescription(p.description || '');
        setPrice(p.price !== null && p.price !== undefined ? String(p.price) : '');
        setCategoryId(p.categoryId || '');
        setCondition(p.condition || 'GOOD');
        setIsNegotiable(Boolean(p.isNegotiable));
        setTagsInput(Array.isArray(p.tags) ? p.tags.join(', ') : '');
        setExistingStatus(p.status);
        setExistingImages(Array.isArray(p.images) ? p.images : []);
      })
      .catch((err) => setError(err.message || 'Could not load listing.'))
      .finally(() => setLoadingInitial(false));
  }, [id, isEditMode]);

  if (!user?.isVerifiedStudent) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-amber-500/30 p-8 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Student Verification Required</h1>
          <p className="text-sm text-slate-300">
            Only verified university students can create or publish listings on CampusX. Verify your
            college email in under a minute to start selling.
          </p>
          <Link
            to="/verify"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition"
          >
            Verify College Email
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const parseTags = () =>
    tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

  const buildPayload = (saveAsDraft) => ({
    saveAsDraft,
    title: title.trim(),
    description: description.trim() || null,
    price: price === '' ? null : Number(price),
    categoryId: categoryId || null,
    condition: condition || null,
    isNegotiable,
    tags: parseTags(),
  });

  const validateForm = (saveAsDraft) => {
    if (!title.trim() || title.trim().length > 120) {
      return 'Title is required and must be at most 120 characters.';
    }
    if (description.trim().length > 2000) {
      return 'Description must be at most 2000 characters.';
    }
    if (price !== '' && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      return 'Price must be 0 or greater.';
    }
    if (!saveAsDraft) {
      if (!description.trim()) return 'Description is required to publish.';
      if (price === '') return 'Price is required to publish.';
      if (!categoryId) return 'Category is required to publish.';
      if (!condition) return 'Condition is required to publish.';
      const imageCount = isEditMode ? existingImages.length : queuedFiles.length;
      if (imageCount === 0) return 'At least 1 product photo is required to publish.';
    }
    return '';
  };

  const uploadBatches = async (productId, files) => {
    for (let i = 0; i < files.length; i += 6) {
      const batch = files.slice(i, i + 6);
      const formData = new FormData();
      batch.forEach((f) => formData.append('images', f));
      const res = await productsApi.uploadImages(productId, formData, (evt) => {
        if (evt.total) {
          setUploadProgress(Math.round((evt.loaded * 100) / evt.total));
        }
      });
      if (res?.data?.images) {
        setExistingImages(res.data.images);
      }
    }
    setUploadProgress(null);
  };

  const handleUploadExisting = async (files) => {
    setError('');
    setImageBusy(true);
    try {
      await uploadBatches(id, files);
    } catch (err) {
      setError(err.message || 'Failed to upload product images.');
    } finally {
      setUploadProgress(null);
      setImageBusy(false);
    }
  };

  const handleDeleteExisting = async (imageId) => {
    setError('');
    setImageBusy(true);
    try {
      const res = await productsApi.deleteImage(id, imageId);
      setExistingImages(res?.data?.images || []);
    } catch (err) {
      setError(err.message || 'Failed to remove image.');
    } finally {
      setImageBusy(false);
    }
  };

  const handleReorderExisting = async (imageIds) => {
    setError('');
    setImageBusy(true);
    try {
      const res = await productsApi.reorderImages(id, imageIds);
      setExistingImages(res?.data?.images || []);
    } catch (err) {
      setError(err.message || 'Failed to reorder images.');
    } finally {
      setImageBusy(false);
    }
  };

  const handleAction = async (saveAsDraft) => {
    setError('');
    const errMsg = validateForm(saveAsDraft);
    if (errMsg) {
      setError(errMsg);
      return;
    }

    setSubmitting(true);
    try {
      if (!isEditMode) {
        const res = await productsApi.create(buildPayload(true));
        const created = res?.data?.product;
        if (queuedFiles.length > 0) {
          await uploadBatches(created.id, queuedFiles);
        }
        if (!saveAsDraft) {
          await productsApi.publish(created.id);
        }
        navigate(saveAsDraft ? '/my-listings' : `/products/${created.id}`);
      } else {
        const updateData = buildPayload(saveAsDraft);
        delete updateData.saveAsDraft;
        await productsApi.update(id, updateData);
        if (!saveAsDraft && existingStatus === 'DRAFT') {
          await productsApi.publish(id);
        }
        navigate('/my-listings');
      }
    } catch (err) {
      setError(err.message || 'Could not save listing.');
    } finally {
      setUploadProgress(null);
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-300 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading listing...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-700/60">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isEditMode ? 'Edit Listing' : 'Create a Listing'}
            </h1>
            <p className="text-xs text-slate-400">
              Save as a draft with just a title, or fill all fields to publish immediately.
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
          <div>
            <label
              htmlFor="sell-title"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Title *
            </label>
            <input
              id="sell-title"
              type="text"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Engineering Mathematics Textbook (6th Ed.)"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="sell-category"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Category
              </label>
              <select
                id="sell-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sell-condition"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Condition
              </label>
              <select
                id="sell-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sell-price"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Price (₹)
              </label>
              <input
                id="sell-price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="450"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <label
                htmlFor="sell-description"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Description
              </label>
              <span className="text-xs font-mono text-slate-400">{description.length}/2000</span>
            </div>
            <textarea
              id="sell-description"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe item condition, pickup location on campus, and accessories included..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="sell-tags"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Tags (comma-separated, max 10)
            </label>
            <input
              id="sell-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="textbook, cs101, calculus"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/70 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm text-slate-200">
            <input
              type="checkbox"
              checked={isNegotiable}
              onChange={(e) => setIsNegotiable(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <span>Price is negotiable</span>
          </label>

          <ProductImageUploader
            existingImages={isEditMode ? existingImages : []}
            queuedFiles={isEditMode ? [] : queuedFiles}
            onQueueFiles={(files) => setQueuedFiles((prev) => [...prev, ...files].slice(0, 8))}
            onRemoveQueued={(idx) => setQueuedFiles((prev) => prev.filter((_, i) => i !== idx))}
            onReorderQueued={(next) => setQueuedFiles(next)}
            onUploadFiles={isEditMode ? handleUploadExisting : undefined}
            onDeleteExisting={isEditMode ? handleDeleteExisting : undefined}
            onReorderExisting={isEditMode ? handleReorderExisting : undefined}
            uploadProgress={uploadProgress}
            busy={submitting || imageBusy}
          />

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-700/60">
            {(!isEditMode || existingStatus === 'DRAFT') && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-100 font-semibold text-sm transition"
              >
                <Save className="w-4 h-4" />
                Save as Draft
              </button>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleAction(false)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/20"
            >
              <Send className="w-4 h-4" />
              {isEditMode && existingStatus !== 'DRAFT' ? 'Save Changes' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
