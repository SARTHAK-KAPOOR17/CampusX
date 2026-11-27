// server/tests/health.test.js
const request = require('supertest');
const app = require('../src/app');
const cache = require('../src/services/cache');

// Mock Prisma client to avoid requiring live DB during unit tests
jest.mock('../src/config/db', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: jest.fn().mockResolvedValue(true),
  },
  checkDbConnection: jest.fn().mockResolvedValue({
    status: 'connected',
    latencyMs: 3,
  }),
}));

describe('GET /api/health', () => {
  afterAll(async () => {
    await cache.disconnect();
  });

  it('should return 200 with standard health check payload', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('statusCode', 200);
    expect(res.body).toHaveProperty('message', 'CampusX API Health Check');
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toMatchObject({
      service: 'campusx-server',
      status: 'healthy',
      version: '1.0.0',
    });
    expect(res.body.data).toHaveProperty('uptime');
    expect(typeof res.body.data.uptime).toBe('number');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data.database).toMatchObject({
      status: 'connected',
      latencyMs: expect.any(Number),
    });
    expect(res.body.data).toHaveProperty('redis');
    expect(res.body.data.redis).toMatchObject({
      status: expect.stringMatching(/^(connected|disconnected)$/),
      latencyMs: expect.any(Number),
    });
    expect(res.body).toHaveProperty('timestamp');
  });

  it('should respond to container probe at /health as well', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 for nonexistent routes with standard JSON error envelope', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('statusCode', 404);
    expect(res.body).toHaveProperty('message', "Route '/api/nonexistent-route' not found");
  });
});
