import { Controller, Get, Post, Query } from '@nestjs/common';
import { OrdersService, ResultadoSincronizacao } from './orders.service';
import { Order } from './entities/order.entity';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async listar(@Query('limite') limite?: string): Promise<Order[]> {
    return this.ordersService.listar(Number(limite) || 100);
  }

  /** Dispara o polling na hora, sem esperar o job. */
  @Post('sync')
  async sincronizar(): Promise<ResultadoSincronizacao> {
    return this.ordersService.sincronizarPedidos();
  }
}
