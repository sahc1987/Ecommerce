const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const express = require('express');
const upload = require('../../src/middleware/upload');

// Smallest valid PNG (1x1), so the magic-byte check has real bytes to read.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const post = async (port, bytes, type) => {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type }), 'photo.png');
  const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST', body: form });
  return { status: res.status, body: await res.json() };
};

test('uploads keep real images and reject spoofed ones', async (t) => {
  const app = express();
  app.post('/', upload.single('image'), (req, res) => res.json({ url: req.file.url }));
  const server = app.listen(0);
  t.after(() => server.close());
  const { port } = server.address();

  const ok = await post(port, PNG, 'image/png');
  assert.equal(ok.status, 200);
  assert.match(ok.body.url, /^\/uploads\/[0-9a-f-]{36}\.png$/);
  fs.unlinkSync(`.${ok.body.url}`);

  const fake = await post(port, Buffer.from('not an image'), 'image/png');
  assert.equal(fake.status, 400);
});
