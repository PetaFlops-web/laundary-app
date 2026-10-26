import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { ChatService } from './chat.service.js';
import {
  ConversationResponseDto,
  MessageResponseDto,
} from './dto/chat-response.dto.js';
import {
  AdminSendMessageDto,
  MarkReadDto,
  QueryMessagesDto,
} from './dto/chat.dto.js';

@ApiTags('Admin Chat')
@ApiBearerAuth()
@Controller('admin/chat')
@Roles(Role.ADMIN)
export class AdminChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Daftar percakapan (FR-64)' })
  @ApiOkResponse({ type: ConversationResponseDto, isArray: true })
  getConversations(
    @Query() query: QueryMessagesDto,
  ): Promise<{ data: ConversationResponseDto[]; meta: PaginationMetaDto }> {
    return this.chatService.getAdminConversations(query);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Riwayat pesan percakapan (FR-64)' })
  @ApiOkResponse({ type: MessageResponseDto, isArray: true })
  getConversationMessages(
    @Param('id') id: string,
    @Query() query: QueryMessagesDto,
  ): Promise<{ data: MessageResponseDto[]; meta: PaginationMetaDto }> {
    return this.chatService.getConversationMessages(id, query);
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admin kirim pesan ke percakapan (FR-64)' })
  @ApiCreatedResponse({ type: MessageResponseDto })
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminSendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.chatService.adminSendMessage(user.id, id, dto.body, dto.orderId);
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin tandai pesan dibaca' })
  markRead(
    @Param('id') id: string,
    @Body() dto: MarkReadDto,
  ): Promise<{ readAt: Date; count: number }> {
    return this.chatService.adminMarkRead(id, dto.upToMessageId);
  }
}
