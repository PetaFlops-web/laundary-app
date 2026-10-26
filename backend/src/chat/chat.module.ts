import { Module } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { AdminChatController } from './admin-chat.controller.js';
import { ChatGateway } from './chat.gateway.js';

@Module({
  controllers: [ChatController, AdminChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
