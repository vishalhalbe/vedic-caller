const { startCall } = require('../services/callService');

test('call billing', () => {
  const res = startCall(60,60);
  expect(res.cost).toBe(60);
});