import { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}

export class ForgotPasswordResponseDto {
  message: string;
}
