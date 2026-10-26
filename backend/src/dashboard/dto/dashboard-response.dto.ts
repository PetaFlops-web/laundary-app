import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardResponseDto {
  @ApiProperty({ description: 'Jumlah booking PENDING' })
  pendingBookings!: number;

  @ApiProperty({ description: 'Jumlah pesanan menunggu pembayaran' })
  awaitingPaymentOrders!: number;

  @ApiProperty({ description: 'Jumlah pesanan terbayar belum selesai' })
  paidNotCompletedOrders!: number;

  @ApiProperty({ description: 'Jumlah pesanan sedang diantar' })
  outForDeliveryOrders!: number;

  @ApiProperty({ description: 'Jumlah pesanan selesai belum diambil (self-pickup reminder)' })
  completedNotPickedUpOrders!: number;

  @ApiProperty({ description: 'Jumlah percakapan dengan pesan belum dibaca admin' })
  unreadConversations!: number;

  @ApiProperty({ description: 'Total pendapatan terbayar dalam periode (Rupiah)' })
  revenue!: string;

  @ApiPropertyOptional({ description: 'Awal periode pendapatan' })
  revenueFrom?: string | null;

  @ApiPropertyOptional({ description: 'Akhir periode pendapatan' })
  revenueTo?: string | null;
}
