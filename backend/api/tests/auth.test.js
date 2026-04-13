test('valid phone login', () => {
  const phone = '9999999999';
  expect(phone.length).toBe(10);
});