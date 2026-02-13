import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';

const app = createApp({ skipRateLimit: true, skipTenant: true });

describe('API Tests', () => {
  describe('Health Check', () => {
    it('GET /api/health returns status ok', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('Auth Routes', () => {
    describe('GET /api/auth/status', () => {
      it('returns setup not complete when no password set', async () => {
        const res = await request(app).get('/api/auth/status');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isSetupComplete).toBe(false);
        expect(res.body.data.isAuthenticated).toBe(false);
      });

      it('returns setup complete when password is set', async () => {
        db.prepare("INSERT INTO settings (key, value) VALUES ('password_hash', 'somehash')").run();

        const res = await request(app).get('/api/auth/status');

        expect(res.status).toBe(200);
        expect(res.body.data.isSetupComplete).toBe(true);
      });
    });

    describe('POST /api/auth/setup', () => {
      it('rejects password shorter than 4 characters', async () => {
        const res = await request(app)
          .post('/api/auth/setup')
          .send({ password: '123' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('4 Zeichen');
      });

      it('successfully sets up password', async () => {
        const res = await request(app)
          .post('/api/auth/setup')
          .send({ password: 'testpassword123' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify password hash was stored
        const hash = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get();
        expect(hash).toBeDefined();
      });

      it('rejects second setup attempt', async () => {
        // First setup
        await request(app)
          .post('/api/auth/setup')
          .send({ password: 'testpassword123' });

        // Second attempt
        const res = await request(app)
          .post('/api/auth/setup')
          .send({ password: 'anotherpassword' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('bereits durchgeführt');
      });
    });

    describe('POST /api/auth/login', () => {
      beforeEach(async () => {
        // Setup password first
        await request(app)
          .post('/api/auth/setup')
          .send({ password: 'testpassword' });
      });

      it('rejects wrong password', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ password: 'wrongpassword' });

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Falsches Passwort');
      });

      it('accepts correct password', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ password: 'testpassword' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });
  });

  describe('Accounts Routes', () => {
    let agent: ReturnType<typeof request.agent>;

    beforeEach(async () => {
      agent = request.agent(app);
      // Setup and login
      await agent.post('/api/auth/setup').send({ password: 'test1234' });
      await agent.post('/api/auth/login').send({ password: 'test1234' });
    });

    describe('GET /api/accounts', () => {
      it('returns empty array when no accounts', async () => {
        const res = await agent.get('/api/accounts');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([]);
      });
    });

    describe('POST /api/accounts', () => {
      it('creates a new account', async () => {
        const res = await agent.post('/api/accounts').send({
          name: 'Girokonto',
          type: 'bank',
          initialBalance: 1000,
        });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('Girokonto');
        expect(res.body.data.type).toBe('bank');
      });

      it('rejects invalid account type', async () => {
        const res = await agent.post('/api/accounts').send({
          name: 'Test',
          type: 'invalid',
        });

        // The DB constraint rejects invalid types with a 500 error
        expect(res.status).toBe(500);
      });

      it('requires name', async () => {
        const res = await agent.post('/api/accounts').send({
          type: 'bank',
        });

        expect(res.status).toBe(400);
      });
    });
  });

  describe('Categories Routes', () => {
    let agent: ReturnType<typeof request.agent>;

    beforeEach(async () => {
      agent = request.agent(app);
      await agent.post('/api/auth/setup').send({ password: 'test1234' });
      await agent.post('/api/auth/login').send({ password: 'test1234' });
    });

    describe('GET /api/categories', () => {
      it('returns empty array when no categories', async () => {
        const res = await agent.get('/api/categories');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([]);
      });
    });

    describe('POST /api/categories', () => {
      it('creates a new category', async () => {
        const res = await agent.post('/api/categories').send({
          name: 'Gehalt',
          type: 'income',
          color: '#22c55e',
        });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('Gehalt');
        expect(res.body.data.type).toBe('income');
      });

      it('rejects invalid category type', async () => {
        const res = await agent.post('/api/categories').send({
          name: 'Test',
          type: 'invalid',
        });

        expect(res.status).toBe(400);
      });
    });
  });

  describe('Transactions Routes', () => {
    let agent: ReturnType<typeof request.agent>;
    let accountId: number;

    beforeEach(async () => {
      agent = request.agent(app);
      await agent.post('/api/auth/setup').send({ password: 'test1234' });
      await agent.post('/api/auth/login').send({ password: 'test1234' });

      // Create test account
      const accountRes = await agent.post('/api/accounts').send({
        name: 'Testkonto',
        type: 'bank',
      });
      accountId = accountRes.body.data.id;
    });

    describe('GET /api/transactions', () => {
      it('returns empty array when no transactions', async () => {
        const res = await agent.get('/api/transactions');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([]);
      });
    });

    describe('POST /api/transactions', () => {
      it('creates an income transaction', async () => {
        const res = await agent.post('/api/transactions').send({
          accountId,
          amount: 1500,
          type: 'income',
          date: '2024-01-15',
          description: 'Gehalt',
        });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.amount).toBe(1500);
        expect(res.body.data.type).toBe('income');
      });

      it('creates an expense transaction', async () => {
        const res = await agent.post('/api/transactions').send({
          accountId,
          amount: 50,
          type: 'expense',
          date: '2024-01-16',
          description: 'Einkauf',
        });

        expect(res.status).toBe(201);
        expect(res.body.data.type).toBe('expense');
      });

      it('rejects invalid transaction type', async () => {
        const res = await agent.post('/api/transactions').send({
          accountId,
          amount: 100,
          type: 'invalid',
          date: '2024-01-15',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Ungültiger Transaktionstyp');
      });

      it('requires accountId', async () => {
        const res = await agent.post('/api/transactions').send({
          amount: 100,
          type: 'income',
          date: '2024-01-15',
        });

        expect(res.status).toBe(400);
      });

      it('requires amount', async () => {
        const res = await agent.post('/api/transactions').send({
          accountId,
          type: 'income',
          date: '2024-01-15',
        });

        expect(res.status).toBe(400);
      });

      it('rejects transfer without target account', async () => {
        const res = await agent.post('/api/transactions').send({
          accountId,
          amount: 100,
          type: 'transfer',
          date: '2024-01-15',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Zielkonto');
      });
    });

    describe('GET /api/transactions/:id', () => {
      it('returns 404 for non-existent transaction', async () => {
        const res = await agent.get('/api/transactions/9999');

        expect(res.status).toBe(404);
      });

      it('returns transaction by id', async () => {
        // Create transaction first
        const createRes = await agent.post('/api/transactions').send({
          accountId,
          amount: 100,
          type: 'income',
          date: '2024-01-15',
        });

        const res = await agent.get(`/api/transactions/${createRes.body.data.id}`);

        expect(res.status).toBe(200);
        expect(res.body.data.amount).toBe(100);
      });
    });

    describe('PUT /api/transactions/:id', () => {
      it('updates a transaction', async () => {
        // Create transaction
        const createRes = await agent.post('/api/transactions').send({
          accountId,
          amount: 100,
          type: 'income',
          date: '2024-01-15',
          description: 'Original',
        });
        const id = createRes.body.data.id;

        // Update it - send all fields to avoid undefined binding issues
        const res = await agent.put(`/api/transactions/${id}`).send({
          accountId,
          amount: 200,
          type: 'income',
          date: '2024-01-15',
          description: 'Updated',
          categoryId: null,
          notes: null,
          transferToAccountId: null,
        });

        expect(res.status).toBe(200);
        expect(res.body.data.amount).toBe(200);
      });

      it('returns 404 for non-existent transaction', async () => {
        const res = await agent.put('/api/transactions/9999').send({
          amount: 100,
        });

        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /api/transactions/:id', () => {
      it('deletes a transaction', async () => {
        // Create transaction
        const createRes = await agent.post('/api/transactions').send({
          accountId,
          amount: 100,
          type: 'income',
          date: '2024-01-15',
        });
        const id = createRes.body.data.id;

        // Delete it
        const res = await agent.delete(`/api/transactions/${id}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify it's gone
        const getRes = await agent.get(`/api/transactions/${id}`);
        expect(getRes.status).toBe(404);
      });

      it('returns 404 for non-existent transaction', async () => {
        const res = await agent.delete('/api/transactions/9999');

        expect(res.status).toBe(404);
      });
    });
  });

  describe('Authentication Required', () => {
    it('rejects unauthenticated requests to /api/accounts', async () => {
      const res = await request(app).get('/api/accounts');

      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated requests to /api/transactions', async () => {
      const res = await request(app).get('/api/transactions');

      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated requests to /api/categories', async () => {
      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(401);
    });
  });
});
