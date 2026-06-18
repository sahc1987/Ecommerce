const Redis = require('ioredis');

const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
});

client.on('connect', () => console.log('Redis connected'));
client.on('error', (err) => console.warn('Redis error (non-fatal):', err.message));

client.connect().catch(() => {});

module.exports = client;
