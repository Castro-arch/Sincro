import { MargemService } from '../src/margem/margem.service';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';

function pedido(over: Partial<Order> = {}): Order {
  return {
    id: 'o1', mlItemId: 'MLB1', quantidade: 1, valor: 100, status: OrderStatus.PAGO,
    taxaMl: 12, dataPedido: new Date(),
    listing: {
      id: 'l1', productId: 'p1', titulo: 'Caneca', categoriaId: 'MLB9206',
      listingTypeId: 'gold_special', pictureIds: ['pic'],
      product: { sku: 'SKU-1', custoUnitario: 30 },
    },
    ...over,
  } as Order;
}

function servico(pedidos: Order[], imposto = 10, estimar = jest.fn()) {
  return new MargemService(
    { find: jest.fn().mockResolvedValue(pedidos) } as never,
    {} as never,
    { impostoPercentual: jest.fn().mockResolvedValue(imposto) } as never,
    { estimar } as never,
  );
}

describe('MargemService', () => {
  it('desconta taxa do ML, imposto e custo -- imposto sobre a receita JA liquida da taxa', async () => {
    const r = await servico([pedido()]).relatorio(30);
    const l = r.linhas[0];

    // receita 100, taxa 12 -> base do imposto 88; 10% = 8,80; custo 30
    expect(l.taxaMl).toBe(12);
    expect(l.imposto).toBe(8.8);
    expect(l.custoTotal).toBe(30);
    expect(l.lucro).toBe(49.2);
    expect(l.margemPercentual).toBe(49.2);
    expect(l.taxaReal).toBe(true);
  });

  it('agrega varios pedidos do mesmo produto numa linha', async () => {
    const r = await servico([
      pedido({ id: 'o1', quantidade: 1, valor: 100, taxaMl: 12 }),
      pedido({ id: 'o2', quantidade: 2, valor: 200, taxaMl: 24 }),
    ]).relatorio(30);

    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].unidadesVendidas).toBe(3);
    expect(r.linhas[0].receitaBruta).toBe(300);
    expect(r.linhas[0].custoTotal).toBe(90);
    expect(r.totais.receitaBruta).toBe(300);
  });

  it('sem sale_fee no pedido, estima e MARCA a linha como estimada', async () => {
    const estimar = jest.fn().mockResolvedValue({ valor: 11.24, percentual: 11.5, taxaFixa: 6.65 });
    const r = await servico([pedido({ taxaMl: null })], 0, estimar).relatorio(30);

    expect(estimar).toHaveBeenCalledWith(100, 'MLB9206', 'gold_special');
    expect(r.linhas[0].taxaMl).toBe(11.24);
    // O rotulo e o que impede um numero estimado passar por realizado.
    expect(r.linhas[0].taxaReal).toBe(false);
  });

  it('produto sem custo informado nao vira custo zero silencioso', async () => {
    const semCusto = pedido();
    (semCusto.listing as never as { product: { custoUnitario: number | null } }).product.custoUnitario = null;

    const r = await servico([semCusto]).relatorio(30);

    expect(r.linhas[0].custoInformado).toBe(false);
    expect(r.linhas[0].custoTotal).toBe(0);
    // O total conta quantos produtos estao com lucro superestimado.
    expect(r.totais.produtosSemCusto).toBe(1);
  });

  it('imposto zero nao desconta nada', async () => {
    const r = await servico([pedido()], 0).relatorio(30);
    expect(r.linhas[0].imposto).toBe(0);
    expect(r.linhas[0].lucro).toBe(58);
  });

  it('pedido de anuncio fora do Sincro nao quebra o relatorio', async () => {
    const forasteiro = pedido({ listing: null, taxaMl: 5 });
    const r = await servico([forasteiro]).relatorio(30);
    expect(r.linhas[0].sku).toBe('—');
    expect(r.linhas[0].titulo).toContain('fora do Sincro');
  });
});
