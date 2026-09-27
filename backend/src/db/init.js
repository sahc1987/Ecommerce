require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/database');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await db.query(sql);
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database init error:', err.message);
  } finally {
    await db.end();
  }
}

init();
