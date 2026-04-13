// In-memory idempotency (no Redis)
const store = new Map();

exports.check = (key) => store.get(key) || null;
exports.save = (key, value) => store.set(key, value);