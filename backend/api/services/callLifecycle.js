const { atomicDeduct } = require('./walletEngine');

exports.startCall = async (userId, rate) => {
  return {
    userId,
    rate,
    startTime: Date.now(),
    status: 'ACTIVE'
  };
};

exports.endCall = async (session) => {
  const duration = Math.floor((Date.now() - session.startTime) / 1000);
  const cost = (session.rate / 60) * duration;

  await atomicDeduct(session.userId, cost);

  return { duration, cost };
};