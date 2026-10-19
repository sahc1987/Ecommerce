const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isUuid, pagination, uuidParam } = require('../../src/utils/validate');

test('isUuid accepts only well-formed UUIDs', () => {
  assert.equal(isUuid('d85a7e13-ede6-444a-a4e0-33f4f137dd74'), true);
  assert.equal(isUuid('D85A7E13-EDE6-444A-A4E0-33F4F137DD74'), true);
  for (const bad of ['', 'not-a-uuid', '-'.repeat(36), 'd85a7e13ede6444aa4e033f4f137dd74', null, undefined, 42])
    assert.equal(isUuid(bad), false, String(bad));
});

test('pagination defaults to page 1 of 20', () => {
  assert.deepEqual(pagination({}), { page: 1, limit: 20, offset: 0 });
});

test('pagination clamps bad page and limit values', () => {
  assert.deepEqual(pagination({ page: '0', limit: '-5' }), { page: 1, limit: 1, offset: 0 });
  assert.deepEqual(pagination({ page: 'abc', limit: 'abc' }), { page: 1, limit: 20, offset: 0 });
  assert.deepEqual(pagination({ page: '3', limit: '1000' }), { page: 3, limit: 100, offset: 200 });
  assert.deepEqual(pagination({ limit: '5' }, { maxLimit: 3 }), { page: 1, limit: 3, offset: 0 });
});

test('uuidParam answers 404 for a malformed id and passes a valid one on', () => {
  const handler = uuidParam('Thing not found');
  let sent = null;
  const res = { status: (code) => ({ json: (body) => { sent = { code, body }; } }) };

  handler({}, res, () => assert.fail('should not continue'), 'nope');
  assert.deepEqual(sent, { code: 404, body: { error: 'Thing not found' } });

  let continued = false;
  handler({}, res, () => { continued = true; }, 'd85a7e13-ede6-444a-a4e0-33f4f137dd74');
  assert.equal(continued, true);
});
