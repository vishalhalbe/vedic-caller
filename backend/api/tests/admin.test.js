/**
 * Admin access control tests
 */
const request  = require('supertest');
const app      = require('../app');
const supabase = require('../config/db');

let _seq = 0;
async function registerAndLogin() {
  const email    = `admin_test_${Date.now()}${++_seq}@example.com`;
  const password = 'TestPass99';
  await request(app).post('/auth/register').send({ email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return { token: `Bearer ${res.body.token}`, userId: res.body.user_id };
}

describe('POST /availability/toggle', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/availability/toggle').send({});
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/availability/toggle')
      .set('Authorization', token)
      .send({ astrologer_id: '00000000-0000-0000-0000-000000000000', available: true });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it('returns 404 for admin user with non-existent astrologer', async () => {
    const { userId, token } = await registerAndLogin();
    // Elevate to admin directly in DB
    await supabase.from('users').update({ is_admin: true }).eq('id', userId);
    const res = await request(app)
      .post('/availability/toggle')
      .set('Authorization', token)
      .send({ astrologer_id: '00000000-0000-0000-0000-000000000000', available: true });
    expect(res.status).toBe(404);
  });
});
