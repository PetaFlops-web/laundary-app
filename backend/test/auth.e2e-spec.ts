import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const ts = String(Date.now());
  const email = `e2e+${ts}@example.com`;
  const phone = '0812' + ts.slice(-8);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register → login → profil → otorisasi → refresh → logout', async () => {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'E2E User', email, phone, password: 'password123' })
      .expect(201);
    expect(register.body.role).toBe('CUSTOMER');
    expect(register.body).not.toHaveProperty('passwordHash');

    // email duplikat → 409
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'E2E User', email, phone: '0813' + ts.slice(-8), password: 'password123' })
      .expect(409);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    const accessToken: string = login.body.accessToken;
    const refreshToken: string = login.body.refreshToken;
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    // profil sendiri dengan token valid
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // tanpa token → 401
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);

    // customer mengakses endpoint admin → 403
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    // rotasi refresh token
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    // pemakaian ulang token lama dicabut → 401
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    // logout dengan token yang baru
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(204);
  });
});
