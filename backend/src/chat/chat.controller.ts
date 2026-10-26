import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
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
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import { ChatService } from './chat.service.js';
import {
  ConversationResponseDto,
  MessageResponseDto,
} from './dto/chat-response.dto.js';
import { MarkReadDto, QueryMessagesDto, SendMessageDto } from './dto/chat.dto.js';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('me')
  @ApiOperation({ summary: 'Percakapan saya (FR-61)' })
  @ApiOkResponse({ type: ConversationResponseDto })
  getMyConversation(
    @CurrentUser() user: AuthUser,
  ): Promise<ConversationResponseDto> {
    return this.chatService.getOrCreateConversation(user.id);
  }

  @Get('me/messages')
  @ApiOperation({ summary: 'Riwayat pesan saya (FR-61)' })
  @ApiOkResponse({ type: MessageResponseDto, isArray: true })
  getMyMessages(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryMessagesDto,
  ): Promise<{ data: MessageResponseDto[]; meta: PaginationMetaDto }> {
    return this.chatService.getMyMessages(user.id, query);
  }

  @Post('me/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kirim pesan (REST fallback) (FR-63)' })
  @ApiCreatedResponse({ type: MessageResponseDto })
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.chatService.sendMessage(user.id, 'CUSTOMER', dto.body, dto.orderId);
  }

  @Post('me/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tandai pesan dibaca (FR-65)' })
  markRead(
    @CurrentUser() user: AuthUser,
    @Body() dto: MarkReadDto,
  ): Promise<{ readAt: Date; count: number }> {
    return this.chatService.markRead(user.id, dto.upToMessageId);
  }
}
