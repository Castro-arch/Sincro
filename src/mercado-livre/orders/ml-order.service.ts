import { Injectable, Logger } from '@nestjs/common';
import { MlAuthService } from '../auth/ml-auth.service';
import { MlHttpService } from '../ml-http.service';
import { MlOrder, MlOrderSearchResponse } from '../ml-api.types';

const LIMITE_POR_PAGINA = 50;

/** Teto de paginas por execucao -- evita varrer o historico inteiro sem querer. */
const MAX_PAGINAS = 20;

/**
 * Leitura de pedidos no Mercado Livre.
 *
 * O Sincro usa polling (5-10 min) em vez de webhook: sem endpoint publico
 * exposto, e com menos de 20 anuncios o custo de varrer os pedidos recentes e
 * irrelevante.
 */
@Injectable()
export class MlOrderService {
  private readonly logger = new Logger(MlOrderService.name);

  constructor(
    private readonly http: MlHttpService,
    private readonly auth: MlAuthService,
  ) {}

  /**
   * Pedidos criados a partir de `desde`, do mais antigo para o mais novo.
   * Pagina ate acabar (ou ate o teto de seguranca).
   */
  async buscarPedidosDesde(desde: Date): Promise<MlOrder[]> {
    const sellerId = await this.auth.getSellerId();
    const pedidos: MlOrder[] = [];

    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const params = new URLSearchParams({
        seller: sellerId,
        'order.date_created.from': desde.toISOString(),
        sort: 'date_asc',
        limit: String(LIMITE_POR_PAGINA),
        offset: String(pagina * LIMITE_POR_PAGINA),
      });

      const resposta = await this.http.get<MlOrderSearchResponse>(
        `/orders/search?${params.toString()}`,
      );

      pedidos.push(...resposta.results);

      const jaLidos = (pagina + 1) * LIMITE_POR_PAGINA;
      if (resposta.results.length < LIMITE_POR_PAGINA || jaLidos >= resposta.paging.total) {
        break;
      }

      if (pagina === MAX_PAGINAS - 1) {
        this.logger.warn(
          `Teto de ${MAX_PAGINAS} paginas atingido buscando pedidos desde ${desde.toISOString()}. Restam pedidos nao lidos nesta rodada.`,
        );
      }
    }

    this.logger.debug(`${pedidos.length} pedido(s) retornados desde ${desde.toISOString()}.`);
    return pedidos;
  }

  async buscarPedido(mlOrderId: string): Promise<MlOrder> {
    return this.http.get<MlOrder>(`/orders/${mlOrderId}`);
  }
}
