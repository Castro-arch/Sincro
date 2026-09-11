import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MlHttpService } from '../ml-http.service';

interface MlListingPrice {
  listing_type_id: string;
  sale_fee_amount: number;
  sale_fee_details?: { percentage_fee?: number; fixed_fee?: number; gross_amount?: number };
}

export interface TaxaEstimada {
  valor: number;
  percentual: number | null;
  taxaFixa: number | null;
}

/**
 * Estimativa da comissao para produto que ainda nao vendeu.
 *
 * Manda SEMPRE shipping_mode e logistic_type: medido em 2026-09-11, a caneca
 * a R$ 39,90 devolve R$ 4,59 sem esses parametros e R$ 11,24 com eles (taxa
 * fixa de R$ 6,65). O ML so cobra a fixa abaixo do limite de frete gratis, e
 * a conta esta em modo `custom` -- sem os parametros a estimativa erra por
 * quase 2,5x em produto barato.
 *
 * A doc avisa que o percentual pode variar no tempo para o mesmo produto,
 * entao isto e estimativa do momento, nao contrato.
 */
@Injectable()
export class MlListingPriceService {
  private readonly logger = new Logger(MlListingPriceService.name);
  private readonly cache = new Map<string, { dados: TaxaEstimada; em: number }>();
  private static readonly TTL_MS = 60 * 60 * 1000;

  constructor(
    private readonly http: MlHttpService,
    private readonly config: ConfigService,
  ) {}

  async estimar(
    preco: number,
    categoriaId: string,
    listingTypeId: string,
    modoEnvio = 'custom',
  ): Promise<TaxaEstimada | null> {
    const siteId = this.config.getOrThrow<string>('ML_SITE_ID');
    const chave = `${siteId}|${categoriaId}|${listingTypeId}|${preco}|${modoEnvio}`;

    const guardado = this.cache.get(chave);
    if (guardado && Date.now() - guardado.em < MlListingPriceService.TTL_MS) {
      return guardado.dados;
    }

    const params = new URLSearchParams({
      price: String(preco),
      category_id: categoriaId,
      listing_type_id: listingTypeId,
      currency_id: 'BRL',
      shipping_mode: modoEnvio,
      logistic_type: modoEnvio,
    });

    try {
      const resposta = await this.http.get<MlListingPrice | MlListingPrice[]>(
        `/sites/${siteId}/listing_prices?${params.toString()}`,
      );
      const item = Array.isArray(resposta) ? resposta[0] : resposta;
      if (!item) return null;

      const dados: TaxaEstimada = {
        valor: item.sale_fee_amount,
        percentual: item.sale_fee_details?.percentage_fee ?? null,
        taxaFixa: item.sale_fee_details?.fixed_fee ?? null,
      };
      this.cache.set(chave, { dados, em: Date.now() });
      return dados;
    } catch (erro) {
      // Estimativa e acessorio: o relatorio mostra "—" em vez de quebrar.
      this.logger.warn(
        `Nao foi possivel estimar a taxa de ${categoriaId} a ${preco}: ${
          erro instanceof Error ? erro.message : String(erro)
        }`,
      );
      return null;
    }
  }
}
