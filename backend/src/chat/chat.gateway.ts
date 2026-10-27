import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { ChatService } from './chat.service.js';

const { verify } = jwt

interface AuthPayload {
  sub: string;
  email: string;
  role: Role;
}

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    role: Role;
    conversationId?: string;
  };
}

/** Rate-limit: max pesan per menit per user. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /** userId → { count, windowStart } */
  private rateLimits = new Map<string, { count: number; windowStart: number }>();

  constructor(private readonly chatService: ChatService) {}

  // ─── Connection lifecycle ──────────────────────────────────────────

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new Error('Token tidak diberikan');
      }

      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) {
        throw new Error('JWT_ACCESS_SECRET belum dikonfigurasi');
      }

      const payload = verify(token, secret) as AuthPayload;

      client.data = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      if (payload.role === 'CUSTOMER') {
        // Customer: join room percakapan miliknya
        const conv = await this.chatService.getOrCreateConversation(payload.sub);
        client.data.conversationId = conv.id;
        await client.join(`conv:${conv.id}`);
      } else if (payload.role === 'ADMIN') {
        // Admin: join room semua percakapan aktif
        await client.join('admin');
        const { data: conversations } = await this.chatService.getAdminConversations({
          page: 1,
          limit: 1000,
        });
        for (const conv of conversations) {
          await client.join(`conv:${conv.id}`);
        }
      }
    } catch {
      client.emit('error', { code: 'AUTH_FAILED', message: 'Autentikasi gagal' });
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: AuthenticatedSocket): void {
    // Cleanup if needed
  }

  // ─── Events ────────────────────────────────────────────────────────

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { body?: string; orderId?: string; conversationId?: string },
  ): Promise<void> {
    const { userId, role } = client.data;

    if (!data?.body || typeof data.body !== 'string') {
      client.emit('error', { code: 'VALIDATION', message: 'Isi pesan wajib diisi' });
      return;
    }

    // Rate limit check
    if (!this.checkRateLimit(userId)) {
      client.emit('error', {
        code: 'RATE_LIMIT',
        message: 'Terlalu banyak pesan. Coba lagi sebentar.',
      });
      return;
    }

    try {
      let message;

      if (role === 'ADMIN') {
        // Admin harus menyertakan conversationId
        if (!data.conversationId) {
          client.emit('error', {
            code: 'VALIDATION',
            message: 'conversationId wajib untuk admin',
          });
          return;
        }
        message = await this.chatService.adminSendMessage(
          userId,
          data.conversationId,
          data.body,
          data.orderId,
        );
      } else {
        // Customer
        message = await this.chatService.sendMessage(
          userId,
          'CUSTOMER',
          data.body,
          data.orderId,
        );
      }

      // Broadcast ke room percakapan
      const roomId = `conv:${message.conversationId}`;

      // Pastikan admin juga join room ini (kalau ada customer baru)
      this.server.to('admin').socketsJoin(roomId);

      this.server.to(roomId).emit('message:new', {
        id: message.id,
        conversationId: message.conversationId,
        senderRole: message.senderRole,
        senderId: message.senderId,
        body: message.body,
        orderId: message.orderId,
        createdAt: message.createdAt,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal mengirim pesan';
      client.emit('error', { code: 'SEND_FAILED', message: msg });
    }
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId?: string; upToMessageId?: string },
  ): Promise<void> {
    const { userId, role, conversationId: myConvId } = client.data;

    if (!data?.upToMessageId) {
      client.emit('error', { code: 'VALIDATION', message: 'upToMessageId wajib' });
      return;
    }

    try {
      let result;
      let convId: string;

      if (role === 'ADMIN') {
        if (!data.conversationId) {
          client.emit('error', {
            code: 'VALIDATION',
            message: 'conversationId wajib untuk admin',
          });
          return;
        }
        convId = data.conversationId;
        result = await this.chatService.adminMarkRead(convId, data.upToMessageId);
      } else {
        if (!myConvId) {
          client.emit('error', { code: 'NOT_FOUND', message: 'Percakapan tidak ditemukan' });
          return;
        }
        convId = myConvId;
        result = await this.chatService.markRead(userId, data.upToMessageId);
      }

      // Broadcast ke room percakapan
      this.server.to(`conv:${convId}`).emit('message:read', {
        conversationId: convId,
        readAt: result.readAt,
        upToMessageId: data.upToMessageId,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal menandai dibaca';
      client.emit('error', { code: 'READ_FAILED', message: msg });
    }
  }

  // ─── Rate limiting ────────────────────────────────────────────────

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(userId);

    if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
      this.rateLimits.set(userId, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= RATE_LIMIT) {
      return false;
    }

    entry.count++;
    return true;
  }
}
