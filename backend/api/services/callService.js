const { calculateDeduction } = require('./walletService');

exports.startCall = (rate, seconds) => {
  const cost = calculateDeduction(rate, seconds);
  return { duration: seconds, cost };
};