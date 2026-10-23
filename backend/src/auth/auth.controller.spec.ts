import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  };

  const authUser: AuthUser = {
    id: 'uuid-1',
    email: 'budi@example.com',
    role: Role.CUSTOMER,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  it('register meneruskan dto', async () => {
    const dto = {
      name: 'Budi',
      email: 'budi@example.com',
      phone: '08123456789',
      password: 'password123',
    };
    await controller.register(dto);
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it('changePassword meneruskan id user dan dto', async () => {
    const dto = { currentPassword: 'old', newPassword: 'newpassword123' };
    await controller.changePassword(authUser, dto);
    expect(authService.changePassword).toHaveBeenCalledWith('uuid-1', dto);
  });

  it('resetPassword meneruskan dto', async () => {
    const dto = { token: 'tok', newPassword: 'newpassword123' };
    await controller.resetPassword(dto);
    expect(authService.resetPassword).toHaveBeenCalledWith(dto);
  });
});
