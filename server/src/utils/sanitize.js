// server/src/utils/sanitize.js

/**
 * Strips HTML tags and script/event-handler payloads to guard against stored XSS.
 */
const sanitizePlainText = (value) => {
  if (value === null || value === undefined) return value;
  return String(value)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

module.exports = {
  sanitizePlainText,
};
