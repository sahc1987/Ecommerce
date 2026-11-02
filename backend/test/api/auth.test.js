// Sign-in input handling: emails match regardless of case, bad input is a 400
// (not a 500), and wrong credentials are a 401.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('auth', { skip: h.skip }, () => {
  before(h.start);
  after(h.stop);

  const password = 'Passw0rd!long';

  test('emails are stored lowercase and matched ignoring case', async () => {
    const reg = await h.call(null, 'POST', '/auth/register', { name: 'Eve', email: ' Eve@Test.dev ', password });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.user.email, 'eve@test.dev');

    const login = await h.call(null, 'POST', '/auth/login', { email: 'EVE@test.DEV', password });
    assert.equal(login.status, 200);

    const dup = await h.call(null, 'POST', '/auth/register', { name: 'Eve2', email: 'eve@TEST.dev', password });
    assert.equal(dup.status, 400);
  });

  test('non-string login input is a 400', async () => {
    for (const body of [{ email: 'eve@test.dev', password: 123 }, { email: { a: 1 }, password }, {}]) {
      assert.equal((await h.call(null, 'POST', '/auth/login', body)).status, 400);
    }
  });

  test('wrong password and unknown email are the same 401', async () => {
    const wrong = await h.call(null, 'POST', '/auth/login', { email: 'eve@test.dev', password: 'nope-nope-nope' });
    const unknown = await h.call(null, 'POST', '/auth/login', { email: 'ghost@test.dev', password });
    assert.equal(wrong.status, 401);
    assert.deepEqual(unknown, wrong);
  });
});
