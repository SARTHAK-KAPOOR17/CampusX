// server/src/services/storage/s3Storage.js
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../../config');
const logger = require('../../utils/logger');

let internalClient = null;
let signerClient = null;

const buildClient = (endpoint) => {
  const clientConfig = {
    region: config.storage.region,
    forcePathStyle: config.storage.forcePathStyle,
    credentials: {
      accessKeyId: config.storage.accessKey || 'minioadmin',
      secretAccessKey: config.storage.secretKey || 'minioadmin',
    },
  };

  if (endpoint) {
    clientConfig.endpoint = endpoint;
  }

  return new S3Client(clientConfig);
};

const getInternalClient = () => {
  if (!internalClient) {
    internalClient = buildClient(config.storage.endpoint);
  }
  return internalClient;
};

const getSignerClient = () => {
  const publicEndpoint = config.storage.publicEndpoint || config.storage.endpoint;
  if (!signerClient) {
    signerClient = buildClient(publicEndpoint);
  }
  return signerClient;
};

/**
 * Resets cached clients (useful in tests when env config changes).
 */
const resetClients = () => {
  internalClient = null;
  signerClient = null;
};

const putObject = async ({ key, body, contentType, cacheControl = 'private, max-age=31536000' }) => {
  const command = new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  await getInternalClient().send(command);
  return { key, bucket: config.storage.bucket };
};

const deleteObject = async (key) => {
  if (!key) return;
  const command = new DeleteObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
  });
  await getInternalClient().send(command);
};

const deleteObjects = async (keys = []) => {
  const validKeys = keys.filter(Boolean);
  if (validKeys.length === 0) return;

  // S3 DeleteObjects supports up to 1000 keys per call
  for (let i = 0; i < validKeys.length; i += 1000) {
    const chunk = validKeys.slice(i, i + 1000);
    const command = new DeleteObjectsCommand({
      Bucket: config.storage.bucket,
      Delete: {
        Objects: chunk.map((Key) => ({ Key })),
        Quiet: true,
      },
    });
    await getInternalClient().send(command);
  }
};

const listObjects = async (prefix = '') => {
  const keys = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.storage.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const res = await getInternalClient().send(command);
    if (Array.isArray(res.Contents)) {
      res.Contents.forEach((item) => {
        if (item.Key) keys.push(item.Key);
      });
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
};

const getPublicUrl = (key) => {
  if (!key) return null;
  if (config.storage.cdnBaseUrl) {
    return `${config.storage.cdnBaseUrl}/${key.replace(/^\/+/, '')}`;
  }
  const base = (config.storage.publicEndpoint || config.storage.endpoint).replace(/\/+$/, '');
  return `${base}/${config.storage.bucket}/${key.replace(/^\/+/, '')}`;
};

const getSignedReadUrl = async (key, expiresInSeconds = config.storage.signedUrlExpirySeconds) => {
  if (!key) return null;
  if (config.storage.cdnBaseUrl) {
    return getPublicUrl(key);
  }

  const command = new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
  });

  // Presigning is local/CPU-only HMAC-SHA256 signing (zero network calls)
  return getSignedUrl(getSignerClient(), command, { expiresIn: expiresInSeconds });
};

/**
 * Verifies object storage connectivity on startup.
 * - Production: fails fast if bucket is unreachable/missing.
 * - Non-production (dev): ensures the private bucket exists.
 */
const ensureStorageReady = async () => {
  const bucket = config.storage.bucket;
  const client = getInternalClient();

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    logger.info({ bucket }, 'Object storage bucket verified');
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    const isNotFound =
      status === 404 || err.name === 'NotFound' || err.name === 'NoSuchBucket';

    if (config.env === 'production') {
      throw new Error(
        `Object storage unavailable or bucket '${bucket}' missing in production: ${err.message}`
      );
    }

    if (isNotFound) {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      logger.info({ bucket }, 'Created private object storage bucket for development');
      return;
    }

    throw new Error(`Object storage initialization failed for bucket '${bucket}': ${err.message}`);
  }
};

module.exports = {
  putObject,
  deleteObject,
  deleteObjects,
  listObjects,
  getSignedReadUrl,
  getPublicUrl,
  ensureStorageReady,
  resetClients,
};
