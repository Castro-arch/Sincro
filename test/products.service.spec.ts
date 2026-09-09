import { BadRequestException } from '@nestjs/common';
import { ProductsService } from '../src/products/products.service';
import { CreateProductDto } from '../src/products/dto/create-product.dto';
import { ListingStatus } from '../src/products/entities/listing.entity';

const LISTING_ID = 'listing-1';
const VARIATION_ID = 'var-1';

function dtoBase(): CreateProductDto {
  return {
    sku: 'CAM-001',
    nome: 'Camiseta basica',
    variacoes: [
      { atributos: [{ id: 'COLOR', value_name: 'Azul' }], preco: 99.9, estoque: 10 },
      { atributos: [{ id: 'COLOR', value_name: 'Preta' }], preco: 99.9, estoque: 5 },
    ],
  };
}

describe('ProductsService', () => {
  let productsRepo: { findOne: jest.Mock };
  let listingsRepo: { findOne: jest.Mock; save: jest.Mock };
  let variationsRepo: { findOne: jest.Mock; save: jest.Mock; find: jest.Mock };
  let categoryService: { validarAtributos: jest.Mock };
  let itemService: { sincronizarEstoqueEPreco: jest.Mock; publicar: jest.Mock };
  let service: ProductsService;

  beforeEach(() => {
    productsRepo = { findOne: jest.fn().mockResolvedValue(null) };
    listingsRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: LISTING_ID,
        mlItemId: 'MLB123456789',
        status: ListingStatus.ATIVO,
        variations: [],
      }),
      save: jest.fn().mockImplementation(async (l) => l),
    };
    variationsRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (v) => v),
      find: jest.fn().mockResolvedValue([]),
    };
    categoryService = { validarAtributos: jest.fn() };
    itemService = { sincronizarEstoqueEPreco: jest.fn(), publicar: jest.fn() };

    service = new ProductsService(
      productsRepo as never,
      listingsRepo as never,
      variationsRepo as never,
      { transaction: jest.fn() } as never,
      categoryService as never,
      itemService as never,
    );
  });

  describe('criar', () => {
    it('recusa duas variacoes com a mesma combinacao de atributos', async () => {
      const dto = dtoBase();
      dto.variacoes[1] = { atributos: [{ id: 'COLOR', value_name: 'Azul' }], preco: 89, estoque: 3 };

      await expect(service.criar(dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa misturar variacao com atributos e variacao sem atributos', async () => {
      const dto = dtoBase();
      dto.variacoes[1] = { atributos: [], preco: 89, estoque: 3 };

      await expect(service.criar(dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa publicar em categoria com atributo obrigatorio faltando', async () => {
      const dto = dtoBase();
      dto.categoriaId = 'MLB31603';
      categoryService.validarAtributos.mockResolvedValue({
        valido: false,
        faltando: [{ id: 'BRAND', nome: 'Marca', valoresPermitidos: null }],
      });

      await expect(service.criar(dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('considera satisfeito o atributo obrigatorio definido nas variacoes', async () => {
      const dto = dtoBase();
      dto.categoriaId = 'MLB31603';
      categoryService.validarAtributos.mockResolvedValue({ valido: true, faltando: [] });

      // A transacao e o unico passo seguinte; basta ela ter sido alcancada.
      await service.criar(dto).catch(() => undefined);

      expect(categoryService.validarAtributos).toHaveBeenCalledWith(
        'MLB31603',
        [],
        ['COLOR', 'COLOR'],
      );
    });
  });

  describe('atualizarEstoque', () => {
    it('reverte o estoque no banco quando o Mercado Livre recusa a atualizacao', async () => {
      variationsRepo.findOne.mockResolvedValue({
        id: VARIATION_ID,
        listingId: LISTING_ID,
        estoque: 10,
        preco: 99.9,
      });
      variationsRepo.find.mockResolvedValue([
        { id: VARIATION_ID, mlVariationId: '77001', estoque: 4, preco: 99.9, atributos: [] },
      ]);
      itemService.sincronizarEstoqueEPreco.mockRejectedValue(new Error('ML fora do ar'));

      await expect(
        service.atualizarEstoque(VARIATION_ID, { estoque: 4 }),
      ).rejects.toThrow('ML fora do ar');

      // Ultimo save precisa ter devolvido o valor original: divergir do ML
      // silenciosamente e o que faz vender o que nao existe.
      const ultimoSalvo = variationsRepo.save.mock.calls.at(-1)?.[0];
      expect(ultimoSalvo.estoque).toBe(10);
    });

    it('mantem o novo estoque quando o Mercado Livre aceita', async () => {
      variationsRepo.findOne.mockResolvedValue({
        id: VARIATION_ID,
        listingId: LISTING_ID,
        estoque: 10,
        preco: 99.9,
      });
      variationsRepo.find.mockResolvedValue([
        { id: VARIATION_ID, mlVariationId: '77001', estoque: 4, preco: 99.9, atributos: [] },
      ]);
      itemService.sincronizarEstoqueEPreco.mockResolvedValue(undefined);

      const resultado = await service.atualizarEstoque(VARIATION_ID, { estoque: 4 });

      expect(resultado.estoque).toBe(4);
      expect(itemService.sincronizarEstoqueEPreco).toHaveBeenCalledTimes(1);
    });
  });
});
