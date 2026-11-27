// server/src/utils/userFormatter.js
const storage = require('../services/storage');

/**
 * Resolves a computed profilePictureUrl from internal avatarKey and strips raw storage keys / passwordHash.
 */
const formatUserWithAvatar = async (user) => {
  if (!user) return null;
  const { passwordHash, avatarKey, ...rest } = user;
  const profilePictureUrl = avatarKey
    ? await storage.getSignedReadUrl(`${avatarKey}/medium.webp`)
    : null;

  return {
    ...rest,
    profilePictureUrl,
  };
};

const formatUsersWithAvatar = async (users = []) => {
  return Promise.all(users.map(formatUserWithAvatar));
};

module.exports = {
  formatUserWithAvatar,
  formatUsersWithAvatar,
};
