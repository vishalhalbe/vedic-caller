const redis = require('./redisClient');

exports.check = async (key) => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

exports.save = async (key, value) => {
  await redis.set(key, JSON.stringify(value), 'EX', 3600);
};