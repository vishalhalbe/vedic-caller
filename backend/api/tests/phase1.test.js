test('call history add + fetch', ()=>{
  const history = [];
  history.push({user_id:1,duration:60,cost:60});
  expect(history.length).toBe(1);
});