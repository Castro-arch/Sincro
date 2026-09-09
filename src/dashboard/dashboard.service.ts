import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing, ListingStatus } from '../products/entities/listing.entity';
import { Variation } from '../products/entities/variation.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { MlAuthService, MlAuthStatus } from '../mercado-livre/auth/ml-auth.service';

export interface VariacaoResumo {
  variationId: string;
  mlVariationId: string | null;
  sku: string | null;
  descricaoAtributos: string;
  preco: number;
  estoque: number;
  estoqueBaixo: boolean;
}

export interface AnuncioResumo {
  listingId: string;
  mlItemId: string | null;
  titulo: string;
  status: ListingStatus;
  permalink: string | null;
  sku: string;
  estoqueTotal: number;
  precoMinimo: number | null;
  temEstoqueBaixo: boolean;
  semEstoque: boolean;
  sincronizadoEm: Date | null;
  ultimoErro: string | null;
  variacoes: VariacaoResumo[];
}

export interface AlertaEstoque {
  listingId: string;
  mlItemId: string | null;
  titulo: string;
  variationId: string;
  sku: string | null;
  descricaoAtributos: string;
  estoque: number;
  severidade: 'sem-estoque' | 'estoque-baixo';
}

export interface VisaoGeral {
  conexaoMl: MlAuthStatus;
  totais: {
    anuncios: number;
    anunciosAtivos: number;
    rascunhos: number;
    comErro: number;
    variacoes: number;
    estoqueTotal: number;
    pedidos30Dias: number;
    faturamento30Dias: number;
  };
  alertas: AlertaEstoque[];
}

/**
 * Leitura agregada para a tela inicial. So consulta o banco -- o dashboard
 * nunca chama o Mercado Livre, entao abrir a tela nao gasta rate limit.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Listing) private readonly listingsRepo: Repository<Listing>,
    @InjectRepository(Variation) private readonly variationsRepo: Repository<Variation>,
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    private readonly authService: MlAuthService,
    private readonly config: ConfigService,
  ) {}

  private get limiteEstoqueBaixo(): number {
    return this.config.get<number>('LOW_STOCK_THRESHOLD') ?? 3;
  }

  /** Anuncios com estoque e status, um por linha da listagem. */
  async listarAnuncios(apenasAtivos = false): Promise<AnuncioResumo[]> {
    const listings = await this.listingsRepo.find({
      relations: { product: true, variations: true },
      order: { criadoEm: 'DESC' },
      ...(apenasAtivos ? { where: { status: ListingStatus.ATIVO } } : {}),
    });

    const limite = this.limiteEstoqueBaixo;

    return listings.map((listing) => {
      const variacoes = (listing.variations ?? []).map((v) => this.resumirVariacao(v, limite));
      const estoqueTotal = variacoes.reduce((soma, v) => soma + v.estoque, 0);
      const precos = variacoes.map((v) => v.preco);

      return {
        listingId: listing.id,
        mlItemId: listing.mlItemId,
        titulo: listing.titulo,
        status: listing.status,
        permalink: listing.permalink,
        sku: listing.product?.sku ?? '',
        estoqueTotal,
        precoMinimo: precos.length ? Math.min(...precos) : null,
        temEstoqueBaixo: variacoes.some((v) => v.estoqueBaixo),
        semEstoque: estoqueTotal === 0,
        sincronizadoEm: listing.sincronizadoEm,
        ultimoErro: listing.ultimoErro,
        variacoes,
      };
    });
  }

  /** Variacoes no limite ou zeradas, das mais criticas para as menos. */
  async alertasDeEstoque(): Promise<AlertaEstoque[]> {
    const limite = this.limiteEstoqueBaixo;

    const variacoes = await this.variationsRepo
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.listing', 'listing')
      .where('v.estoque <= :limite', { limite })
      .andWhere('listing.status = :status', { status: ListingStatus.ATIVO })
      .orderBy('v.estoque', 'ASC')
      .getMany();

    return variacoes.map((v) => ({
      listingId: v.listingId,
      mlItemId: v.listing?.mlItemId ?? null,
      titulo: v.listing?.titulo ?? '',
      variationId: v.id,
      sku: v.sku,
      descricaoAtributos: this.descreverAtributos(v),
      estoque: v.estoque,
      severidade: v.estoque === 0 ? ('sem-estoque' as const) : ('estoque-baixo' as const),
    }));
  }

  /** Numeros do topo da tela + estado da conexao com o ML. */
  async visaoGeral(): Promise<VisaoGeral> {
    const [conexaoMl, listings, variacoes, alertas] = await Promise.all([
      this.authService.getStatus(),
      this.listingsRepo.find(),
      this.variationsRepo.find(),
      this.alertasDeEstoque(),
    ]);

    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pedidos = await this.ordersRepo
      .createQueryBuilder('o')
      .where('o.data_pedido >= :desde', { desde: trintaDiasAtras })
      .andWhere('o.status = :status', { status: OrderStatus.PAGO })
      .getMany();

    return {
      conexaoMl,
      totais: {
        anuncios: listings.length,
        anunciosAtivos: listings.filter((l) => l.status === ListingStatus.ATIVO).length,
        rascunhos: listings.filter((l) => l.status === ListingStatus.RASCUNHO).length,
        comErro: listings.filter((l) => l.status === ListingStatus.ERRO).length,
        variacoes: variacoes.length,
        estoqueTotal: variacoes.reduce((soma, v) => soma + v.estoque, 0),
        pedidos30Dias: pedidos.length,
        faturamento30Dias: Number(
          pedidos.reduce((soma, p) => soma + Number(p.valor), 0).toFixed(2),
        ),
      },
      alertas,
    };
  }

  private resumirVariacao(v: Variation, limite: number): VariacaoResumo {
    return {
      variationId: v.id,
      mlVariationId: v.mlVariationId,
      sku: v.sku,
      descricaoAtributos: this.descreverAtributos(v),
      preco: Number(v.preco),
      estoque: v.estoque,
      estoqueBaixo: v.estoque <= limite,
    };
  }

  /** "Cor: Azul / Tamanho: M" -- ou "unica" para anuncio sem variacoes. */
  private descreverAtributos(v: Variation): string {
    const combinacoes = (v.atributos ?? []) as Array<{ name?: string; id?: string; value_name?: string }>;
    if (combinacoes.length === 0) {
      return 'unica';
    }
    return combinacoes
      .map((c) => `${c.name ?? c.id}: ${c.value_name ?? ''}`)
      .join(' / ');
  }
}
