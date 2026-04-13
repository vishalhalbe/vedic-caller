const { calculateDeduction } = require('../services/walletService');

test('60 sec at 60/min', () => {
  expect(calculateDeduction(60,60)).toBe(60);
});

test('30 sec at 60/min', () => {
  expect(calculateDeduction(60,30)).toBe(30);
});