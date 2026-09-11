import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Listing } from '../products/entities/listing.entity';
import { ConfiguracoesService } from '../configuracoes/configuracoes.service';
import { MlListingPriceService } from '../mercado-livre/items/ml-listing-price.service';

export interface LinhaMargem {
  productId: string | null;
  listingId: string | null;
  sku: string;
  titulo: string;
  imagemId: string | null;
  unidadesVendidas: number;
  receitaBruta: number;
  taxaMl: number;
  /** true = soma de sale_fee real; false = estimativa do listing_prices. */
  taxaReal: boolean;
  imposto: number;
  custoTotal: number;
  /** false quando o produto nao tem custo unitario informado. */
  custoInformado: boolean;
  lucro: number;
  margemPercentual: number | null;
}

export interface RelatorioMargem {
  dias: number;
  impostoPercentual: number;
  totais: {
    receitaBruta: number;
    taxaMl: number;
    imposto: number;
    custoTotal: number;
    lucro: number;
    margemPercentual: number | null;
    /** Produtos vendidos sem custo informado: o lucro deles esta superestimado. */
    produtosSemCusto: number;
  };
  linhas: LinhaMargem[];
}

/**
 * Margem real por produto.
 *
 * Formula, explicitada porque a base do imposto e uma escolha de modelagem do
 * Sincro e NAO a regra fiscal do MEI (o Simples incide sobre o faturamento
 * bruto, nao sobre o valor ja liquido da comissao):
 *
 *   base do imposto = receita bruta - taxa do ML
 *   imposto         = base * percentual configurado
 *   lucro           = receita - taxa do ML - imposto - custo de aquisicao
 *
 * A taxa do ML vem de order_items[].sale_fee, a comissao efetivamente
 * cobrada. Quando o pedido nao trouxe o campo, a linha cai para a estimativa
 * do listing_prices e e marcada com `taxaReal: false` -- misturar as duas sem
 * avisar faria um numero estimado passar por realizado.
 *
 * Frete nao entra: a conta opera em modo `custom`, entao o custo real de
 * envio e externo ao ML e nao existe em nenhum dado que recebemos.
 */
@Injectable()
export class MargemService {
  constructor(
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Listing) private readonly listingsRepo: Repository<Listing>,
    private readonly configuracoes: ConfiguracoesService,
    private readonly listingPrices: MlListingPriceService,
  ) {}

  async relatorio(dias = 30): Promise<RelatorioMargem> {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const impostoPercentual = await this.configuracoes.impostoPercentual();

    const pedidos = await this.ordersRepo.find({
      where: { status: OrderStatus.PAGO, dataPedido: MoreThanOrEqual(desde) },
      relations: { listing: { product: true } },
    });

    const porProduto = new Map<string, LinhaMargem>();

    for (const pedido of pedidos) {
      const listing = pedido.listing;
      const chave = listing?.productId ?? `ml:${pedido.mlItemId}`;
      const linha = porProduto.get(chave) ?? this.linhaVazia(pedido, listing);

      linha.unidadesVendidas += pedido.quantidade;
      linha.receitaBruta += Number(pedido.valor);
      linha.taxaMl += await this.taxaDoPedido(pedido, listing, linha);

      const custoUnitario = listing?.product?.custoUnitario;
      if (custoUnitario != null) {
        linha.custoTotal += Number(custoUnitario) * pedido.quantidade;
      }

      porProduto.set(chave, linha);
    }

    const linhas = [...porProduto.values()].map((linha) =>
      this.fechar(linha, impostoPercentual),
    );
    linhas.sort((a, b) => b.receitaBruta - a.receitaBruta);

    const soma = (fn: (l: LinhaMargem) => number) =>
      this.arredondar(linhas.reduce((total, l) => total + fn(l), 0));
    const receitaBruta = soma((l) => l.receitaBruta);
    const lucro = soma((l) => l.lucro);

    return {
      dias,
      impostoPercentual,
      totais: {
        receitaBruta,
        taxaMl: soma((l) => l.taxaMl),
        imposto: soma((l) => l.imposto),
        custoTotal: soma((l) => l.custoTotal),
        lucro,
        margemPercentual: receitaBruta > 0 ? this.arredondar((lucro / receitaBruta) * 100) : null,
        produtosSemCusto: linhas.filter((l) => !l.custoInformado).length,
      },
      linhas,
    };
  }

  private linhaVazia(pedido: Order, listing: Listing | null): LinhaMargem {
    return {
      productId: listing?.productId ?? null,
      listingId: listing?.id ?? null,
      sku: listing?.product?.sku ?? '—',
      titulo: listing?.titulo ?? `Anúncio fora do Sincro (${pedido.mlItemId})`,
      imagemId: listing?.pictureIds?.[0] ?? null,
      unidadesVendidas: 0,
      receitaBruta: 0,
      taxaMl: 0,
      taxaReal: true,
      imposto: 0,
      custoTotal: 0,
      custoInformado: listing?.product?.custoUnitario != null,
      lucro: 0,
      margemPercentual: null,
    };
  }

  /** Taxa real do pedido; na falta dela, estimativa -- e a linha vira estimada. */
  private async taxaDoPedido(
    pedido: Order,
    listing: Listing | null,
    linha: LinhaMargem,
  ): Promise<number> {
    if (pedido.taxaMl != null) return Number(pedido.taxaMl);

    linha.taxaReal = false;
    if (!listing?.categoriaId) return 0;

    const unitario = Number(pedido.valor) / Math.max(pedido.quantidade, 1);
    const estimada = await this.listingPrices.estimar(
      unitario,
      listing.categoriaId,
      listing.listingTypeId,
    );
    return (estimada?.valor ?? 0) * pedido.quantidade;
  }

  private fechar(linha: LinhaMargem, impostoPercentual: number): LinhaMargem {
    linha.receitaBruta = this.arredondar(linha.receitaBruta);
    linha.taxaMl = this.arredondar(linha.taxaMl);
    linha.custoTotal = this.arredondar(linha.custoTotal);

    const base = linha.receitaBruta - linha.taxaMl;
    linha.imposto = this.arredondar((base * impostoPercentual) / 100);
    linha.lucro = this.arredondar(
      linha.receitaBruta - linha.taxaMl - linha.imposto - linha.custoTotal,
    );
    linha.margemPercentual =
      linha.receitaBruta > 0 ? this.arredondar((linha.lucro / linha.receitaBruta) * 100) : null;

    return linha;
  }

  private arredondar(valor: number): number {
    return Math.round(valor * 100) / 100;
  }
}
