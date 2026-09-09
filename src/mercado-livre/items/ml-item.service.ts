import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MlHttpService } from '../ml-http.service';
import { MlItemResponse } from '../ml-api.types';
import { Listing } from '../../products/entities/listing.entity';
import { Variation } from '../../products/entities/variation.entity';
import { MlAttribute } from '../../common/ml-attribute.type';

interface MlVariationPayload {
  id?: number;
  price: number;
  available_quantity: number;
  attribute_combinations: MlAttribute[];
  picture_ids?: string[];
  attributes?: MlAttribute[];
}

interface MlItemPayload {
  title: string;
  category_id: string;
  currency_id: string;
  buying_mode: string;
  listing_type_id: string;
  condition: string;
  pictures?: Array<{ id: string }>;
  attributes?: MlAttribute[];
  price?: number;
  available_quantity?: number;
  variations?: MlVariationPayload[];
}

/**
 * Criacao e manutencao de anuncios no Mercado Livre.
 *
 * Cuidado importante: ao atualizar `variations` via PUT /items/{id}, o ML trata
 * o array como estado completo -- variacao que nao aparece no payload e
 * REMOVIDA do anuncio. Por isso toda atualizacao de estoque ou preco reenvia o
 * conjunto inteiro de variacoes, nunca apenas a que mudou.
 */
@Injectable()
export class MlItemService {
  private readonly logger = new Logger(MlItemService.name);

  constructor(private readonly http: MlHttpService) {}

  /** Publica o anuncio (POST /items) e devolve a resposta crua do ML. */
  async publicar(listing: Listing, variations: Variation[]): Promise<MlItemResponse> {
    const payload = this.montarPayload(listing, variations);

    this.logger.log(
      `Publicando "${listing.titulo}" na categoria ${listing.categoriaId} com ${variations.length} variacao(oes).`,
    );

    const item = await this.http.post<MlItemResponse>('/items', payload);

    if (listing.descricao) {
      await this.definirDescricao(item.id, listing.descricao);
    }

    return item;
  }

  /** Descricao vai em endpoint proprio, separado do item. */
  async definirDescricao(mlItemId: string, descricao: string): Promise<void> {
    await this.http.post(`/items/${mlItemId}/description`, { plain_text: descricao });
  }

  async buscarItem(mlItemId: string): Promise<MlItemResponse> {
    return this.http.get<MlItemResponse>(`/items/${mlItemId}`);
  }

  /**
   * Espelha no ML o estoque e o preco que estao no banco do Sincro.
   * Esta e a unica rota de escrita de estoque -- o banco e a fonte de verdade.
   */
  async sincronizarEstoqueEPreco(listing: Listing, variations: Variation[]): Promise<void> {
    if (!listing.mlItemId) {
      throw new BadRequestException(
        `Anuncio ${listing.id} ainda nao foi publicado no Mercado Livre.`,
      );
    }

    if (variations.length === 0) {
      throw new BadRequestException(
        `Anuncio ${listing.id} nao tem variacoes cadastradas no Sincro.`,
      );
    }

    const temVariacoesNoMl = variations.every((v) => Boolean(v.mlVariationId));

    if (!temVariacoesNoMl) {
      throw new BadRequestException(
        `Anuncio ${listing.mlItemId} tem variacoes sem ml_variation_id. Republique ou ressincronize o anuncio antes de alterar o estoque.`,
      );
    }

    // Anuncio de item unico: o Sincro guarda como uma variacao "sintetica"
    // sem combinacoes, entao preco e estoque vao direto no item.
    const itemUnico = variations.length === 1 && variations[0].atributos.length === 0;

    if (itemUnico) {
      await this.http.put(`/items/${listing.mlItemId}`, {
        available_quantity: variations[0].estoque,
        price: variations[0].preco,
      });
    } else {
      await this.http.put(`/items/${listing.mlItemId}`, {
        variations: variations.map((v) => ({
          id: Number(v.mlVariationId),
          price: Number(v.preco),
          available_quantity: v.estoque,
          attribute_combinations: v.atributos,
          picture_ids: v.pictureIds ?? [],
        })),
      });
    }

    this.logger.log(
      `Estoque/preco do anuncio ${listing.mlItemId} sincronizados (${variations.length} variacao(oes)).`,
    );
  }

  /** Altera o status do anuncio (paused / active / closed). */
  async alterarStatus(mlItemId: string, status: 'active' | 'paused' | 'closed'): Promise<void> {
    await this.http.put(`/items/${mlItemId}`, { status });
    this.logger.log(`Anuncio ${mlItemId} passou para status "${status}".`);
  }

  // ------------------------------------------------------------------ payload

  private montarPayload(listing: Listing, variations: Variation[]): MlItemPayload {
    if (!listing.categoriaId) {
      throw new BadRequestException(
        `Anuncio ${listing.id} sem categoria. Use o predictor antes de publicar.`,
      );
    }
    if (variations.length === 0) {
      throw new BadRequestException(`Anuncio ${listing.id} precisa de ao menos uma variacao.`);
    }

    const payload: MlItemPayload = {
      title: listing.titulo,
      category_id: listing.categoriaId,
      currency_id: listing.moeda,
      buying_mode: 'buy_it_now',
      listing_type_id: listing.listingTypeId,
      condition: listing.condicao,
      pictures: (listing.pictureIds ?? []).map((id) => ({ id })),
      attributes: listing.atributos ?? [],
    };

    const itemUnico = variations.length === 1 && variations[0].atributos.length === 0;

    if (itemUnico) {
      payload.price = Number(variations[0].preco);
      payload.available_quantity = variations[0].estoque;
      return payload;
    }

    payload.variations = variations.map((v) => {
      const variacao: MlVariationPayload = {
        price: Number(v.preco),
        available_quantity: v.estoque,
        attribute_combinations: v.atributos,
      };
      if (v.pictureIds?.length) {
        variacao.picture_ids = v.pictureIds;
      }
      if (v.sku) {
        variacao.attributes = [{ id: 'SELLER_SKU', value_name: v.sku }];
      }
      return variacao;
    });

    return payload;
  }
}
