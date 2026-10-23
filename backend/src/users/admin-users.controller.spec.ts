import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { AdminUsersController } from './admin-users.controller.js';
import { UsersService } from './users.service.js';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;

  const usersService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    updateStatus: vi.fn(),
  };

  const admin: AuthUser = {
    id: 'admin-1',
    email: 'owner@achilla.id',
    role: Role.ADMIN,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();
    controller = module.get<AdminUsersController>(AdminUsersController);
  });

  it('findAll meneruskan query', async () => {
    const query = { page: 1, limit: 10 };
    await controller.findAll(query);
    expect(usersService.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne meneruskan id', async () => {
    await controller.findOne('uuid-1');
    expect(usersService.findOne).toHaveBeenCalledWith('uuid-1');
  });

  it('updateStatus meneruskan id user admin', async () => {
    const dto = { isActive: false };
    await controller.updateStatus('user-1', dto, admin);
    expect(usersService.updateStatus).toHaveBeenCalledWith('user-1', dto, 'admin-1');
  });
});
