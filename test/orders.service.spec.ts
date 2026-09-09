import { OrdersService } from '../src/orders/orders.service';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { MlOrder } from '../src/mercado-livre/ml-api.types';
import { FakeRepository } from './fake-repository';

const VARIATION_ID = 'var-local-1';
const LISTING_ID = 'listing-local-1';
const ML_VARIATION_ID = '77001';
const ML_ITEM_ID = 'MLB123456789';

function pedido(status: string, quantidade = 2): MlOrder {
  return {
    id: 2000000001,
    status,
    date_created: '2026-09-01T10:00:00.000Z',
    total_amount: 199.8,
    order_items: [
      {
        item: { id: ML_ITEM_ID, title: 'Camiseta', variation_id: Number(ML_VARIATION_ID) },
        quantity: quantidade,
        unit_price: 99.9,
      },
    ],
  };
}

describe('OrdersService.sincronizarPedidos', () => {
  let ordersRepo: FakeRepository<Order>;
  let productsService: {
    baixarEstoque: jest.Mock;
    atualizarEstoque: jest.Mock;
    buscarVariacao: jest.Mock;
    acharPorMlVariationId: jest.Mock;
    acharListingPorMlItemId: jest.Mock;
    sincronizarComMl: jest.Mock;
  };
  let mlOrderService: { buscarPedidosDesde: jest.Mock };
  let service: OrdersService;

  beforeEach(() => {
    ordersRepo = new FakeRepository<Order>();
    productsService = {
      baixarEstoque: jest.fn().mockResolvedValue({ id: VARIATION_ID, estoque: 8 }),
      atualizarEstoque: jest.fn().mockResolvedValue({ id: VARIATION_ID, estoque: 10 }),
      buscarVariacao: jest.fn().mockResolvedValue({ id: VARIATION_ID, estoque: 8 }),
      acharPorMlVariationId: jest
        .fn()
        .mockResolvedValue({ id: VARIATION_ID, listingId: LISTING_ID }),
      acharListingPorMlItemId: jest.fn().mockResolvedValue({ id: LISTING_ID, variations: [] }),
      sincronizarComMl: jest.fn().mockResolvedValue(undefined),
    };
    mlOrderService = { buscarPedidosDesde: jest.fn() };

    service = new OrdersService(
      ordersRepo as never,
      mlOrderService as never,
      productsService as never,
    );
  });

  it('registra o pedido pago e da baixa no estoque uma unica vez', async () => {
    mlOrderService.buscarPedidosDesde.mockResolvedValue([pedido('paid')]);

    const resultado = await service.sincronizarPedidos();

    expect(resultado.itensNovos).toBe(1);
    expect(resultado.baixasAplicadas).toBe(1);
    expect(productsService.baixarEstoque).toHaveBeenCalledWith(VARIATION_ID, 2);
    // A baixa e espelhada no ML com o valor absoluto do banco.
    expect(productsService.sincronizarComMl).toHaveBeenCalledWith(LISTING_ID);
    expect(ordersRepo.linhas[0].estoqueBaixado).toBe(true);
  });

  it('nao desconta de novo quando o mesmo pedido volta no polling seguinte', async () => {
    mlOrderService.buscarPedidosDesde.mockResolvedValue([pedido('paid')]);

    await service.sincronizarPedidos();
    const segunda = await service.sincronizarPedidos();

    expect(segunda.itensNovos).toBe(0);
    expect(segunda.baixasAplicadas).toBe(0);
    expect(productsService.baixarEstoque).toHaveBeenCalledTimes(1);
    expect(ordersRepo.linhas).toHaveLength(1);
  });

  it('devolve o estoque quando um pedido ja descontado e cancelado', async () => {
    mlOrderService.buscarPedidosDesde.mockResolvedValue([pedido('paid')]);
    await service.sincronizarPedidos();

    mlOrderService.buscarPedidosDesde.mockResolvedValue([pedido('cancelled')]);
    const resultado = await service.sincronizarPedidos();

    expect(resultado.estornosAplicados).toBe(1);
    expect(productsService.atualizarEstoque).toHaveBeenCalledWith(VARIATION_ID, { estoque: 10 });
    expect(ordersRepo.linhas[0].status).toBe(OrderStatus.CANCELADO);
    expect(ordersRepo.linhas[0].estoqueBaixado).toBe(false);
  });

  it('nao desconta estoque enquanto o pedido nao esta pago', async () => {
    mlOrderService.buscarPedidosDesde.mockResolvedValue([pedido('payment_required')]);

    const resultado = await service.sincronizarPedidos();

    expect(resultado.itensNovos).toBe(1);
    expect(resultado.baixasAplicadas).toBe(0);
    expect(productsService.baixarEstoque).not.toHaveBeenCalled();
    expect(ordersRepo.linhas[0].status).toBe(OrderStatus.PENDENTE);
  });

  it('registra o pedido sem mexer no estoque quando o anuncio nao existe no Sincro', async () => {
    productsService.acharPorMlVariationId.mockResolvedValue(null);
    productsService.acharListingPorMlItemId.mockResolvedValue(null);
    mlOrderService.buscarPedidosDesde.mockResolvedValue([pedido('paid')]);

    const resultado = await service.sincronizarPedidos();

    expect(resultado.ignorados).toBe(1);
    expect(resultado.baixasAplicadas).toBe(0);
    expect(productsService.baixarEstoque).not.toHaveBeenCalled();
    expect(ordersRepo.linhas).toHaveLength(1);
  });
});
