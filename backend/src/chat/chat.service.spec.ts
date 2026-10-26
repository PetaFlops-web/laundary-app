import { Test, type TestingModule } from '@nestjs/testing';
import { MessageSenderRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChatService } from './chat.service.js';

describe('ChatService', () => {
  let service: ChatService;

  const prisma = {
    conversation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findFirst: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  const mockUser = {
    id: 'user-1',
    name: 'Budi',
    phone: '6281234567890',
  };

  const mockConversation = {
    id: 'conv-1',
    userId: 'user-1',
    lastMessageAt: new Date('2026-10-20T10:00:00Z'),
    createdAt: new Date('2026-10-20T09:00:00Z'),
    updatedAt: new Date('2026-10-20T10:00:00Z'),
    user: mockUser,
  };

  const mockMessage = {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    senderRole: MessageSenderRole.CUSTOMER,
    orderId: null,
    body: 'Halo, pesanan saya bagaimana?',
    readAt: null,
    createdAt: new Date('2026-10-20T10:00:00Z'),
    updatedAt: new Date('2026-10-20T10:00:00Z'),
  };

  // ─── getOrCreateConversation ────────────────────────────────────

  describe('getOrCreateConversation', () => {
    it('mengembalikan percakapan yang sudah ada', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.getOrCreateConversation('user-1');

      expect(result.id).toBe('conv-1');
      expect(result.userId).toBe('user-1');
      expect(result.user?.name).toBe('Budi');
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('membuat percakapan baru jika belum ada', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue(mockConversation);

      const result = await service.getOrCreateConversation('user-1');

      expect(result.id).toBe('conv-1');
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
        include: { user: true },
      });
    });
  });

  // ─── getMyMessages ─────────────────────────────────────────────

  describe('getMyMessages', () => {
    it('mengembalikan data kosong jika percakapan belum ada', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      const result = await service.getMyMessages('user-1', { page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('mengembalikan riwayat pesan dengan paginasi', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.$transaction.mockResolvedValue([1, [mockMessage]]);

      const result = await service.getMyMessages('user-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].body).toBe('Halo, pesanan saya bagaimana?');
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  // ─── sendMessage ───────────────────────────────────────────────

  describe('sendMessage', () => {
    it('berhasil mengirim pesan customer', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.$transaction.mockImplementation((fn) =>
        fn({
          message: { create: vi.fn().mockResolvedValue(mockMessage) },
          conversation: { update: vi.fn() },
        }),
      );

      const result = await service.sendMessage('user-1', MessageSenderRole.CUSTOMER, 'Halo admin');

      expect(result.id).toBe('msg-1');
      expect(result.senderRole).toBe('CUSTOMER');
    });

    it('membuat percakapan baru jika belum ada lalu kirim pesan', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue(mockConversation);
      prisma.$transaction.mockImplementation((fn) =>
        fn({
          message: { create: vi.fn().mockResolvedValue(mockMessage) },
          conversation: { update: vi.fn() },
        }),
      );

      const result = await service.sendMessage('user-1', MessageSenderRole.CUSTOMER, 'Halo');

      expect(prisma.conversation.create).toHaveBeenCalled();
      expect(result.id).toBe('msg-1');
    });

    it('tolak pesan kosong', async () => {
      await expect(
        service.sendMessage('user-1', MessageSenderRole.CUSTOMER, '   '),
      ).rejects.toThrow('Pesan harus 1–1000 karakter');
    });

    it('tolak pesan lebih dari 1000 karakter', async () => {
      const longMsg = 'a'.repeat(1001);
      await expect(
        service.sendMessage('user-1', MessageSenderRole.CUSTOMER, longMsg),
      ).rejects.toThrow('Pesan harus 1–1000 karakter');
    });

    it('tolak jika orderId tidak ditemukan', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.sendMessage('user-1', MessageSenderRole.CUSTOMER, 'Halo', 'order-999'),
      ).rejects.toThrow('Pesanan tidak ditemukan');
    });

    it('menerima pesan dengan orderId valid', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', userId: 'user-1' });
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const msgWithOrder = { ...mockMessage, orderId: 'order-1' };
      prisma.$transaction.mockImplementation((fn) =>
        fn({
          message: { create: vi.fn().mockResolvedValue(msgWithOrder) },
          conversation: { update: vi.fn() },
        }),
      );

      const result = await service.sendMessage('user-1', MessageSenderRole.CUSTOMER, 'Halo', 'order-1');

      expect(result.orderId).toBe('order-1');
    });
  });

  // ─── markRead ──────────────────────────────────────────────────

  describe('markRead', () => {
    it('berhasil menandai pesan dibaca', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.message.findFirst.mockResolvedValue(mockMessage);
      prisma.message.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markRead('user-1', 'msg-1');

      expect(result.count).toBe(3);
      expect(result.readAt).toBeInstanceOf(Date);
      expect(prisma.message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: 'conv-1',
            senderRole: MessageSenderRole.ADMIN,
            readAt: null,
          }),
        }),
      );
    });

    it('tolak jika percakapan tidak ditemukan', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.markRead('user-1', 'msg-1'),
      ).rejects.toThrow('Percakapan tidak ditemukan');
    });

    it('tolak jika pesan acuan tidak ditemukan', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.message.findFirst.mockResolvedValue(null);

      await expect(
        service.markRead('user-1', 'msg-999'),
      ).rejects.toThrow('Pesan tidak ditemukan');
    });
  });

  // ─── getAdminConversations ─────────────────────────────────────

  describe('getAdminConversations', () => {
    it('mengembalikan daftar percakapan dengan unreadCount', async () => {
      const convWithCount = {
        ...mockConversation,
        _count: { messages: 5 },
      };
      prisma.$transaction.mockResolvedValue([1, [convWithCount]]);

      const result = await service.getAdminConversations({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].unreadCount).toBe(5);
      expect(result.data[0].user?.name).toBe('Budi');
      expect(result.meta.total).toBe(1);
    });
  });

  // ─── getConversationMessages ───────────────────────────────────

  describe('getConversationMessages', () => {
    it('mengembalikan pesan percakapan tertentu', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.$transaction.mockResolvedValue([2, [mockMessage]]);

      const result = await service.getConversationMessages('conv-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(2);
    });

    it('tolak jika percakapan tidak ditemukan', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.getConversationMessages('conv-999', { page: 1, limit: 20 }),
      ).rejects.toThrow('Percakapan tidak ditemukan');
    });
  });

  // ─── adminSendMessage ──────────────────────────────────────────

  describe('adminSendMessage', () => {
    it('berhasil admin kirim pesan', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const adminMsg = {
        ...mockMessage,
        senderId: 'admin-1',
        senderRole: MessageSenderRole.ADMIN,
        body: 'Pesanan Anda sedang diproses',
      };
      prisma.$transaction.mockImplementation((fn) =>
        fn({
          message: { create: vi.fn().mockResolvedValue(adminMsg) },
          conversation: { update: vi.fn() },
        }),
      );

      const result = await service.adminSendMessage('admin-1', 'conv-1', 'Pesanan Anda sedang diproses');

      expect(result.senderRole).toBe('ADMIN');
      expect(result.body).toBe('Pesanan Anda sedang diproses');
    });

    it('tolak jika percakapan tidak ditemukan', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.adminSendMessage('admin-1', 'conv-999', 'Halo'),
      ).rejects.toThrow('Percakapan tidak ditemukan');
    });

    it('tolak pesan admin kosong', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(
        service.adminSendMessage('admin-1', 'conv-1', '   '),
      ).rejects.toThrow('Pesan harus 1–1000 karakter');
    });

    it('tolak jika orderId bukan milik customer percakapan', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.adminSendMessage('admin-1', 'conv-1', 'Halo', 'order-999'),
      ).rejects.toThrow('Pesanan tidak ditemukan');
    });
  });

  // ─── adminMarkRead ─────────────────────────────────────────────

  describe('adminMarkRead', () => {
    it('berhasil admin tandai pesan customer dibaca', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.message.findFirst.mockResolvedValue(mockMessage);
      prisma.message.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.adminMarkRead('conv-1', 'msg-1');

      expect(result.count).toBe(2);
      expect(prisma.message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: 'conv-1',
            senderRole: MessageSenderRole.CUSTOMER,
            readAt: null,
          }),
        }),
      );
    });

    it('tolak jika percakapan tidak ditemukan', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(
        service.adminMarkRead('conv-999', 'msg-1'),
      ).rejects.toThrow('Percakapan tidak ditemukan');
    });

    it('tolak jika pesan acuan tidak ditemukan', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.message.findFirst.mockResolvedValue(null);

      await expect(
        service.adminMarkRead('conv-1', 'msg-999'),
      ).rejects.toThrow('Pesan tidak ditemukan');
    });
  });

  // ─── sanitize ──────────────────────────────────────────────────

  describe('sanitize', () => {
    it('menghapus tag HTML', () => {
      expect(service.sanitize('<b>bold</b> text')).toBe('bold text');
    });

    it('trim spasi', () => {
      expect(service.sanitize('  halo  ')).toBe('halo');
    });

    it('menghapus tag script', () => {
      expect(service.sanitize('<script>alert("xss")</script>OK')).toBe('alert("xss")OK');
    });
  });
});
