const store = new Map();

exports.check = (key) => {
  return store.get(key);
};

exports.save = (key, response) => {
  store.set(key, response);
};