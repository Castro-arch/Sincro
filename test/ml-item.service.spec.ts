import { BadRequestException } from '@nestjs/common';
import { MlItemService } from '../src/mercado-livre/items/ml-item.service';
import { Listing, ListingStatus } from '../src/products/entities/listing.entity';
import { Variation } from '../src/products/entities/variation.entity';

function listing(extra: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    titulo: 'Camiseta basica',
    categoriaId: 'MLB31603',
    listingTypeId: 'gold_special',
    condicao: 'new',
    moeda: 'BRL',
    descricao: 'Algodao penteado.',
    atributos: [{ id: 'BRAND', value_name: 'Generica' }],
    pictureIds: ['pic-1', 'pic-2'],
    status: ListingStatus.RASCUNHO,
    mlItemId: null,
    ...extra,
  } as Listing;
}

function variacao(cor: string, estoque: number, mlVariationId: string | null = null): Variation {
  return {
    id: `var-${cor}`,
    listingId: 'listing-1',
    mlVariationId,
    sku: `SKU-${cor}`,
    atributos: [{ id: 'COLOR', name: 'Cor', value_name: cor }],
    preco: 99.9,
    estoque,
    pictureIds: ['pic-1'],
  } as Variation;
}

describe('MlItemService', () => {
  let http: { post: jest.Mock; put: jest.Mock; get: jest.Mock };
  let service: MlItemService;

  beforeEach(() => {
    http = {
      post: jest.fn().mockResolvedValue({ id: 'MLB999', permalink: 'https://x', variations: [] }),
      put: jest.fn().mockResolvedValue({}),
      get: jest.fn(),
    };
    service = new MlItemService(http as never);
  });

  describe('publicar', () => {
    it('monta o payload com variations e envia a descricao em chamada separada', async () => {
      await service.publicar(listing(), [variacao('Azul', 10), variacao('Preta', 4)]);

      const [rota, payload] = http.post.mock.calls[0];
      expect(rota).toBe('/items');
      expect(payload.title).toBe('Camiseta basica');
      expect(payload.category_id).toBe('MLB31603');
      expect(payload.pictures).toEqual([{ id: 'pic-1' }, { id: 'pic-2' }]);
      expect(payload.variations).toHaveLength(2);
      expect(payload.variations[0].attribute_combinations[0].value_name).toBe('Azul');
      expect(payload.variations[0].available_quantity).toBe(10);
      // Preco e estoque vivem nas variacoes, nao no item.
      expect(payload.price).toBeUndefined();
      expect(payload.available_quantity).toBeUndefined();

      expect(http.post.mock.calls[1][0]).toBe('/items/MLB999/description');
    });

    it('trata anuncio sem variacoes como item unico, com preco e estoque no topo', async () => {
      const unica = { ...variacao('unica', 7), atributos: [] } as Variation;

      await service.publicar(listing({ descricao: null }), [unica]);

      const payload = http.post.mock.calls[0][1];
      expect(payload.variations).toBeUndefined();
      expect(payload.price).toBe(99.9);
      expect(payload.available_quantity).toBe(7);
      // Sem descricao, sem segunda chamada.
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('recusa publicar sem categoria', async () => {
      await expect(
        service.publicar(listing({ categoriaId: null }), [variacao('Azul', 1)]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('sincronizarEstoqueEPreco', () => {
    it('reenvia TODAS as variacoes, nao apenas a que mudou', async () => {
      const publicado = listing({ mlItemId: 'MLB999', status: ListingStatus.ATIVO });
      const variacoes = [variacao('Azul', 8, '77001'), variacao('Preta', 4, '77002')];

      await service.sincronizarEstoqueEPreco(publicado, variacoes);

      const [rota, payload] = http.put.mock.calls[0];
      expect(rota).toBe('/items/MLB999');
      // Variacao ausente do payload seria REMOVIDA do anuncio pelo ML.
      expect(payload.variations).toHaveLength(2);
      expect(payload.variations.map((v: { id: number }) => v.id)).toEqual([77001, 77002]);
      expect(payload.variations[0].available_quantity).toBe(8);
    });

    it('recusa sincronizar anuncio que ainda nao foi publicado', async () => {
      await expect(
        service.sincronizarEstoqueEPreco(listing(), [variacao('Azul', 1)]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(http.put).not.toHaveBeenCalled();
    });

    it('recusa sincronizar quando falta ml_variation_id em alguma variacao', async () => {
      const publicado = listing({ mlItemId: 'MLB999' });
      const variacoes = [variacao('Azul', 8, '77001'), variacao('Preta', 4, null)];

      await expect(
        service.sincronizarEstoqueEPreco(publicado, variacoes),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(http.put).not.toHaveBeenCalled();
    });
  });
});
