exports.log = (level, message, meta = {}) => {
  console.log(JSON.stringify({
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString()
  }));
};