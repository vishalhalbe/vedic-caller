// In-memory idempotency store with TTL and size eviction.
// Keys expire after TTL_MS; when the store exceeds MAX_SIZE the oldest half is evicted.
const TTL_MS   = 60 * 60 * 1000; // 1 hour
const MAX_SIZE = 10_000;

// Map value: { body, expiresAt }
const store = new Map();

function evict() {
  const now = Date.now();
  // First pass: remove expired entries
  for (const [key, val] of store) {
    if (val.expiresAt < now) store.delete(key);
  }
  // If still over limit, remove oldest half by insertion order
  if (store.size > MAX_SIZE) {
    const toDelete = Math.floor(store.size / 2);
    let deleted = 0;
    for (const key of store.keys()) {
      store.delete(key);
      if (++deleted >= toDelete) break;
    }
  }
}

exports.check = (key) => {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { store.delete(key); return null; }
  return entry.body;
};

exports.save = (key, body) => {
  if (store.size >= MAX_SIZE) evict();
  store.set(key, { body, expiresAt: Date.now() + TTL_MS });
};
