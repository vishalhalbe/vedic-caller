exports.calculateDeduction = (rate, seconds) => {
  return (rate / 60) * seconds;
};