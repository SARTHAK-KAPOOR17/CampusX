// server/src/services/storage/index.js
const s3Storage = require('./s3Storage');

/**
 * Provider-agnostic Storage Interface
 * Supports: putObject, deleteObject, deleteObjects, listObjects, getSignedReadUrl, getPublicUrl, ensureStorageReady
 */
module.exports = s3Storage;
