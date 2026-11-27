// server/src/services/images/index.js
const sharp = require('sharp');
const AppError = require('../../utils/AppError');
const storage = require('../storage');

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_INPUT_PIXELS = 40_000_000; // Decompression-bomb pixel guard (~6324x6324)

const VARIANT_SPECS = [
  { name: 'thumb', width: 320 },
  { name: 'medium', width: 800 },
  { name: 'large', width: 1600 },
];

/**
 * Validates actual image binary signature (magic bytes) for JPEG, PNG, and WebP.
 */
const detectImageMagicBytes = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngSig.every((byte, idx) => buffer[idx] === byte)) {
    return 'image/png';
  }

  // WebP: "RIFF" at 0..3 and "WEBP" at 8..11
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
};

/**
 * Validates, strips EXIF/GPS metadata, auto-rotates, generates blurDataUrl + 3 WebP variants.
 * Never upscales smaller source images.
 */
const processImageVariants = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError('Image file buffer is empty.', 400);
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError('Image exceeds the 5MB maximum file size.', 400);
  }

  const detectedMime = detectImageMagicBytes(buffer);
  if (!detectedMime) {
    throw new AppError(
      'Invalid image file. Only genuine JPEG, PNG, and WebP images are allowed.',
      400
    );
  }

  let metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch (err) {
    throw new AppError(
      'Image could not be decoded or exceeds safe pixel dimension limits.',
      400
    );
  }

  if (!metadata || !metadata.width || !metadata.height) {
    throw new AppError('Invalid image dimensions.', 400);
  }

  // Auto-rotate by EXIF orientation; omitting .withMetadata() strips all EXIF/GPS tags
  const normalizedBuffer = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .toBuffer();

  // Generate ~20px wide base64 WebP blur placeholder
  const blurBuffer = await sharp(normalizedBuffer)
    .resize({ width: 20, withoutEnlargement: true })
    .webp({ quality: 45 })
    .toBuffer();
  const blurDataUrl = `data:image/webp;base64,${blurBuffer.toString('base64')}`;

  // Generate thumb (320px), medium (800px), large (1600px) WebP variants without upscaling
  const variants = {};
  let largeMeta = null;
  let totalBytes = 0;

  await Promise.all(
    VARIANT_SPECS.map(async ({ name, width }) => {
      const { data, info } = await sharp(normalizedBuffer)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });

      variants[name] = {
        buffer: data,
        width: info.width,
        height: info.height,
        sizeBytes: info.size,
      };
      totalBytes += info.size;

      if (name === 'large') {
        largeMeta = info;
      }
    })
  );

  return {
    variants,
    blurDataUrl,
    width: largeMeta.width,
    height: largeMeta.height,
    sizeBytes: totalBytes,
  };
};

const buildVariantKeys = (baseKey) => ({
  thumb: `${baseKey}/thumb.webp`,
  medium: `${baseKey}/medium.webp`,
  large: `${baseKey}/large.webp`,
});

const uploadVariants = async (baseKey, variants) => {
  const keys = buildVariantKeys(baseKey);
  await Promise.all(
    Object.entries(keys).map(([variantName, key]) =>
      storage.putObject({
        key,
        body: variants[variantName].buffer,
        contentType: 'image/webp',
      })
    )
  );
  return keys;
};

const deleteVariants = async (baseKey) => {
  if (!baseKey) return;
  const keys = Object.values(buildVariantKeys(baseKey));
  await storage.deleteObjects(keys);
};

const resolveVariantUrls = async (baseKey) => {
  if (!baseKey) {
    return { thumbUrl: null, mediumUrl: null, largeUrl: null };
  }
  const keys = buildVariantKeys(baseKey);
  const [thumbUrl, mediumUrl, largeUrl] = await Promise.all([
    storage.getSignedReadUrl(keys.thumb),
    storage.getSignedReadUrl(keys.medium),
    storage.getSignedReadUrl(keys.large),
  ]);
  return { thumbUrl, mediumUrl, largeUrl };
};

module.exports = {
  MAX_IMAGE_SIZE_BYTES,
  MAX_INPUT_PIXELS,
  VARIANT_SPECS,
  detectImageMagicBytes,
  processImageVariants,
  buildVariantKeys,
  uploadVariants,
  deleteVariants,
  resolveVariantUrls,
};
