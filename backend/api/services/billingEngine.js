const { calculateDeduction } = require('./walletService');

exports.runBilling = (rate, duration) => {
  let total = 0;
  for (let i = 1; i <= duration; i++) {
    total += calculateDeduction(rate, 1);
  }
  return total;
};