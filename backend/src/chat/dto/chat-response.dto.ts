import type {
  Conversation,
  Message,
  User,
} from '@prisma/client';

type ConversationWithRelations = Conversation & {
  user?: User | null;
  messages?: Message[];
  _count?: { messages: number };
};

type MessageWithRelations = Message & {
  sender?: User | null;
};

export class ConversationResponseDto {
  id!: string;
  userId!: string;
  lastMessageAt!: Date;
  createdAt!: Date;
  user?: { id: string; name: string; phone: string } | null;
  unreadCount?: number;

  static from(conv: ConversationWithRelations, unreadCount?: number): ConversationResponseDto {
    return {
      id: conv.id,
      userId: conv.userId,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      user: conv.user
        ? { id: conv.user.id, name: conv.user.name, phone: conv.user.phone }
        : null,
      unreadCount: unreadCount ?? 0,
    };
  }
}

export class MessageResponseDto {
  id!: string;
  conversationId!: string;
  senderId!: string;
  senderRole!: string;
  orderId!: string | null;
  body!: string;
  readAt!: Date | null;
  createdAt!: Date;

  static from(msg: MessageWithRelations): MessageResponseDto {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderRole: msg.senderRole,
      orderId: msg.orderId,
      body: msg.body,
      readAt: msg.readAt,
      createdAt: msg.createdAt,
    };
  }
}
