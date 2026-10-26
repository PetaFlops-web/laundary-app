import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageSenderRole, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationMetaDto } from '../common/dto/pagination.dto.js';
import {
  ConversationResponseDto,
  MessageResponseDto,
} from './dto/chat-response.dto.js';
import type { QueryMessagesDto } from './dto/chat.dto.js';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Customer: get or create conversation (FR-60) ─────────────────

  async getOrCreateConversation(userId: string): Promise<ConversationResponseDto> {
    let conv = await this.prisma.conversation.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: { userId },
        include: { user: true },
      });
    }

    return ConversationResponseDto.from(conv);
  }

  // ─── Customer: riwayat pesan (FR-61) ──────────────────────────────

  async getMyMessages(
    userId: string,
    query: QueryMessagesDto,
  ): Promise<{ data: MessageResponseDto[]; meta: PaginationMetaDto }> {
    const conv = await this.prisma.conversation.findUnique({
      where: { userId },
    });

    if (!conv) {
      return {
        data: [],
        meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 0 },
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MessageWhereInput = { conversationId: conv.id };

    const [total, messages] = await this.prisma.$transaction([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: messages.map((m) => MessageResponseDto.from(m)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Customer: kirim pesan (FR-63) ────────────────────────────────

  async sendMessage(
    userId: string,
    senderRole: MessageSenderRole,
    body: string,
    orderId?: string,
  ): Promise<MessageResponseDto> {
    const trimmed = this.sanitize(body);
    if (trimmed.length < 1 || trimmed.length > 1000) {
      throw new BadRequestException('Pesan harus 1–1000 karakter');
    }

    // Validasi orderId milik customer jika disertakan
    if (orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, userId },
      });
      if (!order) {
        throw new NotFoundException('Pesanan tidak ditemukan');
      }
    }

    // Get or create conversation
    let conv = await this.prisma.conversation.findUnique({
      where: { userId },
    });
    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: { userId },
      });
    }

    const now = new Date();

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId: conv.id,
          senderId: userId,
          senderRole,
          orderId: orderId || null,
          body: trimmed,
        },
      });

      await tx.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: now },
      });

      return msg;
    });

    return MessageResponseDto.from(message);
  }

  // ─── Customer: tandai dibaca ──────────────────────────────────────

  async markRead(
    userId: string,
    upToMessageId: string,
  ): Promise<{ readAt: Date; count: number }> {
    const conv = await this.prisma.conversation.findUnique({
      where: { userId },
    });
    if (!conv) {
      throw new NotFoundException('Percakapan tidak ditemukan');
    }

    // Cari pesan acuan
    const upToMessage = await this.prisma.message.findFirst({
      where: { id: upToMessageId, conversationId: conv.id },
    });
    if (!upToMessage) {
      throw new NotFoundException('Pesan tidak ditemukan');
    }

    const now = new Date();

    // Tandai semua pesan ADMIN yang belum dibaca sampai pesan tersebut
    const result = await this.prisma.message.updateMany({
      where: {
        conversationId: conv.id,
        senderRole: MessageSenderRole.ADMIN,
        readAt: null,
        createdAt: { lte: upToMessage.createdAt },
      },
      data: { readAt: now },
    });

    return { readAt: now, count: result.count };
  }

  // ─── Admin: daftar percakapan (FR-64) ─────────────────────────────

  async getAdminConversations(
    query: QueryMessagesDto,
  ): Promise<{ data: ConversationResponseDto[]; meta: PaginationMetaDto }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, conversations] = await this.prisma.$transaction([
      this.prisma.conversation.count(),
      this.prisma.conversation.findMany({
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: true,
          _count: {
            select: {
              messages: {
                where: {
                  readAt: null,
                  senderRole: MessageSenderRole.CUSTOMER,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: conversations.map((c) =>
        ConversationResponseDto.from(c, c._count.messages),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Admin: pesan percakapan tertentu (FR-64) ─────────────────────

  async getConversationMessages(
    conversationId: string,
    query: QueryMessagesDto,
  ): Promise<{ data: MessageResponseDto[]; meta: PaginationMetaDto }> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) {
      throw new NotFoundException('Percakapan tidak ditemukan');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MessageWhereInput = { conversationId };

    const [total, messages] = await this.prisma.$transaction([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: messages.map((m) => MessageResponseDto.from(m)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Admin: kirim pesan (FR-64) ───────────────────────────────────

  async adminSendMessage(
    adminId: string,
    conversationId: string,
    body: string,
    orderId?: string,
  ): Promise<MessageResponseDto> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) {
      throw new NotFoundException('Percakapan tidak ditemukan');
    }

    const trimmed = this.sanitize(body);
    if (trimmed.length < 1 || trimmed.length > 1000) {
      throw new BadRequestException('Pesan harus 1–1000 karakter');
    }

    // Validasi orderId milik customer percakapan jika disertakan
    if (orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, userId: conv.userId },
      });
      if (!order) {
        throw new NotFoundException('Pesanan tidak ditemukan');
      }
    }

    const now = new Date();

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          senderId: adminId,
          senderRole: MessageSenderRole.ADMIN,
          orderId: orderId || null,
          body: trimmed,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });

      return msg;
    });

    return MessageResponseDto.from(message);
  }

  // ─── Admin: tandai dibaca ─────────────────────────────────────────

  async adminMarkRead(
    conversationId: string,
    upToMessageId: string,
  ): Promise<{ readAt: Date; count: number }> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) {
      throw new NotFoundException('Percakapan tidak ditemukan');
    }

    const upToMessage = await this.prisma.message.findFirst({
      where: { id: upToMessageId, conversationId },
    });
    if (!upToMessage) {
      throw new NotFoundException('Pesan tidak ditemukan');
    }

    const now = new Date();

    // Admin menandai pesan CUSTOMER sebagai dibaca
    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderRole: MessageSenderRole.CUSTOMER,
        readAt: null,
        createdAt: { lte: upToMessage.createdAt },
      },
      data: { readAt: now },
    });

    return { readAt: now, count: result.count };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  /** Sanitasi sederhana: trim + hapus tag HTML dasar. */
  sanitize(text: string): string {
    return text
      .trim()
      .replace(/<[^>]*>/g, '')
      .trim();
  }
}
