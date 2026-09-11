import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { MlOrderService } from '../mercado-livre/orders/ml-order.service';
import { ProductsService } from '../products/products.service';
import { MlOrder, MlOrderItem } from '../mercado-livre/ml-api.types';

export interface ResultadoSincronizacao {
  pedidosLidos: number;
  itensNovos: number;
  baixasAplicadas: number;
  estornosAplicados: number;
  anunciosSincronizados: number;
  ignorados: number;
}

/**
 * Janela de sobreposicao do polling. Relemos um pouco do passado a cada
 * rodada para capturar pedidos que chegaram com atraso e mudancas de status
 * (pendente que virou pago, pago que foi cancelado).
 */
const SOBREPOSICAO_MS = 60 * 60 * 1000;

/** Na primeira execucao, sem historico no banco, olha os ultimos 7 dias. */
const JANELA_INICIAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Traz os pedidos do Mercado Livre para dentro do Sincro e ajusta o estoque.
 *
 * A operacao inteira e idempotente: o indice unico
 * (ml_order_id, ml_item_id, ml_variation_id) impede registrar o mesmo item
 * duas vezes, e a flag `estoque_baixado` impede descontar duas vezes o mesmo
 * item mesmo que o pedido reapareca em varias rodadas de polling.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    private readonly mlOrderService: MlOrderService,
    private readonly productsService: ProductsService,
  ) {}

  // ------------------------------------------------------------------ leitura

  async listar(limite = 100): Promise<Order[]> {
    return this.ordersRepo.find({
      relations: { variation: true, listing: true },
      order: { dataPedido: 'DESC' },
      take: limite,
    });
  }

  // ------------------------------------------------------------ sincronizacao

  /** Ponto de entrada do polling. */
  async sincronizarPedidos(): Promise<ResultadoSincronizacao> {
    const desde = await this.calcularJanela();
    const pedidos = await this.mlOrderService.buscarPedidosDesde(desde);

    const resultado: ResultadoSincronizacao = {
      pedidosLidos: pedidos.length,
      itensNovos: 0,
      baixasAplicadas: 0,
      estornosAplicados: 0,
      anunciosSincronizados: 0,
      ignorados: 0,
    };

    /** Anuncios cujo estoque mudou e precisam ser reenviados ao ML. */
    const listingsAfetados = new Set<string>();

    for (const pedido of pedidos) {
      for (const item of pedido.order_items) {
        await this.processarItem(pedido, item, resultado, listingsAfetados);
      }
    }

    for (const listingId of listingsAfetados) {
      try {
        await this.productsService.sincronizarComMl(listingId);
        resultado.anunciosSincronizados++;
      } catch (error) {
        // Nao aborta a rodada: o estoque no banco ja esta correto e a proxima
        // sincronizacao (que manda valor absoluto) reconcilia o ML.
        this.logger.error(
          `Falha ao reenviar estoque do anuncio ${listingId} ao Mercado Livre: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `Polling concluido: ${resultado.pedidosLidos} pedido(s), ${resultado.itensNovos} item(ns) novo(s), ` +
        `${resultado.baixasAplicadas} baixa(s), ${resultado.estornosAplicados} estorno(s), ` +
        `${resultado.ignorados} ignorado(s).`,
    );

    return resultado;
  }

  // -------------------------------------------------------------------- item

  private async processarItem(
    pedido: MlOrder,
    item: MlOrderItem,
    resultado: ResultadoSincronizacao,
    listingsAfetados: Set<string>,
  ): Promise<void> {
    const mlItemId = item.item.id;
    const mlVariationId = item.item.variation_id ? String(item.item.variation_id) : '';
    const status = this.traduzirStatus(pedido.status);

    const { variationId, listingId } = await this.localizarVariacao(mlItemId, mlVariationId);

    if (!variationId) {
      // Anuncio que nao nasceu no Sincro (ou ainda nao sincronizado). Registra
      // para nao perder o historico, mas sem mexer em estoque nenhum.
      this.logger.warn(
        `Pedido ${pedido.id}: item ${mlItemId}/${mlVariationId || 'sem variacao'} nao existe no Sincro -- estoque nao ajustado.`,
      );
      resultado.ignorados++;
    }

    let registro = await this.ordersRepo.findOne({
      where: { mlOrderId: String(pedido.id), mlItemId, mlVariationId },
    });

    if (!registro) {
      registro = this.ordersRepo.create({
        mlOrderId: String(pedido.id),
        mlItemId,
        mlVariationId,
        variationId,
        listingId,
        quantidade: item.quantity,
        valor: item.unit_price * item.quantity,
        // Comissao real do ML. Ja vinha na resposta e era descartada.
        taxaMl: item.sale_fee ?? null,
        status,
        statusMl: pedido.status,
        estoqueBaixado: false,
        dataPedido: new Date(pedido.date_created),
      });
      registro = await this.ordersRepo.save(registro);
      resultado.itensNovos++;
    } else if (
      registro.status !== status ||
      registro.statusMl !== pedido.status ||
      (item.sale_fee !== undefined && registro.taxaMl !== item.sale_fee)
    ) {
      registro.status = status;
      registro.statusMl = pedido.status;
      // A comissao so existe apos a acreditacao do pagamento: um pedido lido
      // antes disso volta depois ja com o valor, e e aqui que ele entra.
      if (item.sale_fee !== undefined) registro.taxaMl = item.sale_fee;
      await this.ordersRepo.save(registro);
    }

    if (!variationId) {
      return;
    }

    // Baixa: o pedido foi pago e ainda nao descontamos este item.
    if (status === OrderStatus.PAGO && !registro.estoqueBaixado) {
      await this.productsService.baixarEstoque(variationId, registro.quantidade);
      registro.estoqueBaixado = true;
      await this.ordersRepo.save(registro);
      resultado.baixasAplicadas++;
      if (listingId) {
        listingsAfetados.add(listingId);
      }
      return;
    }

    // Estorno: pedido cancelado depois de ja termos descontado.
    if (status === OrderStatus.CANCELADO && registro.estoqueBaixado) {
      await this.reporEstoque(variationId, registro.quantidade);
      registro.estoqueBaixado = false;
      await this.ordersRepo.save(registro);
      resultado.estornosAplicados++;
      if (listingId) {
        listingsAfetados.add(listingId);
      }
    }
  }

  /** Devolve ao estoque a quantidade de um pedido cancelado. */
  private async reporEstoque(variationId: string, quantidade: number): Promise<void> {
    const variacao = await this.productsService.buscarVariacao(variationId);
    await this.productsService.atualizarEstoque(variationId, {
      estoque: variacao.estoque + quantidade,
    });
    this.logger.log(`Estorno de ${quantidade} un. na variacao ${variationId} (pedido cancelado).`);
  }

  // ------------------------------------------------------------------- apoio

  /**
   * Descobre a variacao local do item vendido. Anuncio sem variacoes chega do
   * ML sem variation_id -- nesse caso a unica variacao do anuncio e a alvo.
   */
  private async localizarVariacao(
    mlItemId: string,
    mlVariationId: string,
  ): Promise<{ variationId: string | null; listingId: string | null }> {
    if (mlVariationId) {
      const variacao = await this.productsService.acharPorMlVariationId(mlVariationId);
      if (variacao) {
        return { variationId: variacao.id, listingId: variacao.listingId };
      }
    }

    const listing = await this.productsService.acharListingPorMlItemId(mlItemId);
    if (!listing) {
      return { variationId: null, listingId: null };
    }

    const variacoes = listing.variations ?? [];
    if (variacoes.length === 1) {
      return { variationId: variacoes[0].id, listingId: listing.id };
    }

    // Anuncio com varias variacoes mas sem casamento pelo id: nao da para
    // adivinhar qual delas vendeu, entao nao mexe em estoque.
    return { variationId: null, listingId: listing.id };
  }

  /**
   * A partir de quando buscar pedidos: o mais recente ja conhecido menos a
   * sobreposicao, ou a janela inicial se o banco estiver vazio.
   */
  private async calcularJanela(): Promise<Date> {
    const maisRecente = await this.ordersRepo.findOne({
      where: {},
      order: { dataPedido: 'DESC' },
    });

    if (!maisRecente?.dataPedido) {
      return new Date(Date.now() - JANELA_INICIAL_MS);
    }

    return new Date(maisRecente.dataPedido.getTime() - SOBREPOSICAO_MS);
  }

  /**
   * Status do ML -> status interno. Estoque so e descontado em "paid": e o
   * ponto em que a venda esta efetivamente confirmada.
   */
  private traduzirStatus(statusMl: string): OrderStatus {
    switch (statusMl) {
      case 'paid':
        return OrderStatus.PAGO;
      case 'cancelled':
      case 'invalid':
        return OrderStatus.CANCELADO;
      default:
        return OrderStatus.PENDENTE;
    }
  }
}
