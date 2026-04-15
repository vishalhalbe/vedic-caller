const redis = require('../config/redisClient');

exports.check = async (key) => {
  if (!redis) return null;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

exports.save = async (key, value) => {
  if (!redis) return;
  await redis.setex(key, 3600, JSON.stringify(value));
};
