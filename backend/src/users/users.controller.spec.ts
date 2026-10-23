import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import type { UserResponseDto } from './dto/user-response.dto.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

describe('UsersController', () => {
  let controller: UsersController;

  const usersService = {
    getMe: vi.fn(),
    updateMe: vi.fn(),
  };

  const authUser: AuthUser = {
    id: 'uuid-1',
    email: 'budi@example.com',
    role: Role.CUSTOMER,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();
    controller = module.get<UsersController>(UsersController);
  });

  it('getMe memanggil service dengan id user', async () => {
    usersService.getMe.mockResolvedValue({ id: 'uuid-1' } as UserResponseDto);
    await controller.getMe(authUser);
    expect(usersService.getMe).toHaveBeenCalledWith('uuid-1');
  });

  it('updateMe meneruskan id dan dto', async () => {
    const dto = { name: 'Budi Baru' };
    await controller.updateMe(authUser, dto);
    expect(usersService.updateMe).toHaveBeenCalledWith('uuid-1', dto);
  });
});
