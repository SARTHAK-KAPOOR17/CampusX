// client/src/components/ProductImageUploader.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  X,
  Star,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
  GripVertical,
} from 'lucide-react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 8;

/**
 * Product image gallery uploader supporting drag-and-drop file selection,
 * client-side type/size/count checks, upload progress, reordering, and cover selection.
 *
 * Supports two modes seamlessly:
 * - Server-synced items (`existingImages` from API)
 * - Pending local files (`queuedFiles` before initial listing creation)
 */
export const ProductImageUploader = ({
  existingImages = [],
  queuedFiles = [],
  onQueueFiles,
  onRemoveQueued,
  onReorderQueued,
  onUploadFiles,
  onDeleteExisting,
  onReorderExisting,
  uploadProgress = null,
  busy = false,
}) => {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [queuedPreviews, setQueuedPreviews] = useState([]);

  useEffect(() => {
    const next = queuedFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setQueuedPreviews(next);
    return () => {
      next.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [queuedFiles]);

  const totalCount = existingImages.length + queuedFiles.length;
  const remainingSlots = MAX_IMAGES - totalCount;

  const validateAndAccept = async (fileList) => {
    setLocalError('');
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    if (files.length > remainingSlots) {
      setLocalError(
        remainingSlots <= 0
          ? `Maximum ${MAX_IMAGES} images allowed per listing.`
          : `You can add at most ${remainingSlots} more image(s) (max ${MAX_IMAGES}).`
      );
      return;
    }

    const invalidType = files.find((f) => !ALLOWED_TYPES.includes(f.type));
    if (invalidType) {
      setLocalError(`"${invalidType.name}" is not supported. Only JPEG, PNG, and WebP are allowed.`);
      return;
    }

    const oversized = files.find((f) => f.size > MAX_FILE_BYTES);
    if (oversized) {
      setLocalError(`"${oversized.name}" exceeds the 5MB limit.`);
      return;
    }

    if (onUploadFiles) {
      await onUploadFiles(files);
    } else if (onQueueFiles) {
      onQueueFiles(files);
    }
  };

  const handleDropZone = async (e) => {
    e.preventDefault();
    setDragOver(false);
    if (busy || remainingSlots <= 0) return;
    await validateAndAccept(e.dataTransfer?.files);
  };

  const isExistingMode = Boolean(onUploadFiles);
  const items = isExistingMode
    ? existingImages.map((img, index) => ({
        key: img.id,
        id: img.id,
        src: img.thumbUrl || img.mediumUrl,
        blurDataUrl: img.blurDataUrl,
        isPrimary: img.isPrimary || index === 0,
      }))
    : queuedPreviews.map((entry, index) => ({
        key: `${entry.file.name}-${entry.file.size}-${index}`,
        index,
        src: entry.url,
        name: entry.file.name,
        isPrimary: index === 0,
      }));

  const moveItem = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= items.length || fromIdx === toIdx) return;
    if (isExistingMode && onReorderExisting) {
      const nextIds = items.map((i) => i.id);
      const [moved] = nextIds.splice(fromIdx, 1);
      nextIds.splice(toIdx, 0, moved);
      onReorderExisting(nextIds);
    } else if (!isExistingMode && onReorderQueued) {
      const next = [...queuedFiles];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      onReorderQueued(next);
    }
  };

  const setAsCover = (index) => {
    if (index === 0) return;
    moveItem(index, 0);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          Product Photos * ({totalCount}/{MAX_IMAGES})
        </label>
        <span className="text-[11px] text-slate-400">
          JPEG, PNG, or WebP • Max 5MB each • First photo is Cover
        </span>
      </div>

      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && remainingSlots > 0 && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !busy && remainingSlots > 0) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy && remainingSlots > 0) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDropZone}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
          dragOver
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
        } ${busy || remainingSlots <= 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy || remainingSlots <= 0}
          onChange={(e) => {
            validateAndAccept(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          {busy ? (
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8 text-blue-400" />
          )}
          <p className="text-sm font-medium text-slate-200">
            {remainingSlots <= 0
              ? 'Maximum of 8 images reached'
              : 'Drag & drop photos here, or click to browse'}
          </p>
          <p className="text-xs text-slate-400">
            {remainingSlots > 0
              ? `${remainingSlots} slot${remainingSlots === 1 ? '' : 's'} remaining • EXIF & GPS metadata stripped automatically`
              : 'Remove an image to upload another'}
          </p>
        </div>

        {uploadProgress !== null && (
          <div className="mt-4 max-w-xs mx-auto space-y-1">
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-blue-300">Uploading... {uploadProgress}%</p>
          </div>
        )}
      </div>

      {localError && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{localError}</span>
        </div>
      )}

      {/* Previews & Reorder Grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {items.map((item, idx) => (
            <div
              key={item.key}
              draggable={!busy}
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== idx) {
                  moveItem(dragIndex, idx);
                }
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`group relative rounded-xl overflow-hidden border bg-slate-900 ${
                item.isPrimary ? 'border-amber-400/70 ring-1 ring-amber-400/40' : 'border-slate-700'
              }`}
            >
              <div
                className="aspect-[4/3] bg-slate-900 overflow-hidden"
                style={
                  item.blurDataUrl
                    ? { backgroundImage: `url("${item.blurDataUrl}")`, backgroundSize: 'cover' }
                    : undefined
                }
              >
                <img
                  src={item.src}
                  alt={item.name || `Product photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Cover Badge or Set Cover Button */}
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                {item.isPrimary ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-bold text-[10px] shadow">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    Cover
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setAsCover(idx)}
                    className="px-2 py-0.5 rounded-md bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-semibold text-[10px] border border-slate-600 transition"
                  >
                    Set as Cover
                  </button>
                )}
              </div>

              {/* Remove Button */}
              <button
                type="button"
                disabled={busy}
                aria-label={`Remove photo ${idx + 1}`}
                onClick={() =>
                  isExistingMode ? onDeleteExisting?.(item.id) : onRemoveQueued?.(idx)
                }
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-950/85 hover:bg-rose-600 text-white flex items-center justify-center border border-slate-600 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Reorder Bar */}
              <div className="px-2 py-1.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-slate-400">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono">
                  <GripVertical className="w-3 h-3" />#{idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={busy || idx === 0}
                    aria-label="Move photo earlier"
                    onClick={() => moveItem(idx, idx - 1)}
                    className="p-0.5 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busy || idx === items.length - 1}
                    aria-label="Move photo later"
                    onClick={() => moveItem(idx, idx + 1)}
                    className="p-0.5 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
