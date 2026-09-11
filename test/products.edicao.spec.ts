import { ConflictException } from '@nestjs/common';
import { ProductsService } from '../src/products/products.service';
import { ListingStatus } from '../src/products/entities/listing.entity';

function servico(listing: Record<string, unknown>, extras: Record<string, unknown> = {}) {
  const listingsRepo = { findOne: jest.fn().mockResolvedValue(listing), save: jest.fn(async (l) => l) };
  const variationsRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn() };
  const itemService = { validar: jest.fn(), sincronizarEstoqueEPreco: jest.fn(), ...extras };
  const s = new ProductsService(
    { findOne: jest.fn(), save: jest.fn() } as never,
    listingsRepo as never,
    variationsRepo as never,
    { transaction: jest.fn(async (fn) => fn({ findOneByOrFail: jest.fn(), save: jest.fn(async (x) => x), create: jest.fn() })) } as never,
    { validarAtributos: jest.fn().mockResolvedValue({ valido: true, faltando: [] }) } as never,
    itemService as never,
  )
  return { s, itemService, listingsRepo }
}

const rascunho = { id: 'l1', productId: 'p1', mlItemId: null, status: ListingStatus.ERRO, categoriaId: 'MLB31447', atributos: [], pictureIds: [], variations: [] };
const publicado = { ...rascunho, mlItemId: 'MLB999', status: ListingStatus.ATIVO };

describe('ProductsService.atualizar', () => {
  it('recusa trocar a categoria de anuncio publicado, explicando o motivo', async () => {
    const { s } = servico(publicado);
    await expect(s.atualizar('l1', { categoriaId: 'MLB9206' })).rejects.toBeInstanceOf(ConflictException);
    await expect(s.atualizar('l1', { categoriaId: 'MLB9206' })).rejects.toThrow(/not_modifiable/);
  });

  it('permite trocar a categoria enquanto for rascunho', async () => {
    const { s } = servico({ ...rascunho });
    await expect(s.atualizar('l1', { categoriaId: 'MLB9206' })).resolves.toBeDefined();
  });

  it('recusa recombinar variacao em anuncio publicado', async () => {
    const { s } = servico(publicado);
    await expect(
      s.atualizar('l1', { variacoes: [{ variationId: 'v1', atributos: [{ id: 'COLOR', value_name: 'Azul' }] }] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('nao mexe no ML quando o anuncio ainda e rascunho', async () => {
    const { s, itemService } = servico({ ...rascunho });
    await s.atualizar('l1', { titulo: 'novo titulo' });
    expect(itemService.sincronizarEstoqueEPreco).not.toHaveBeenCalled();
  });
});

describe('ProductsService.validarNoMl', () => {
  it('devolve valido quando o ML aceita, sem publicar', async () => {
    const { s, itemService } = servico({ ...rascunho });
    await expect(s.validarNoMl('l1')).resolves.toEqual({ valido: true, erro: null });
    expect(itemService.validar).toHaveBeenCalled();
  });

  it('devolve a causa em vez de estourar, para a tela guiar a correcao', async () => {
    const { s } = servico({ ...rascunho }, { validar: jest.fn().mockRejectedValue(new Error('Attribute [SIZE_GRID_ID] is missing')) });
    const r = await s.validarNoMl('l1');
    expect(r.valido).toBe(false);
    expect(r.erro).toContain('SIZE_GRID_ID');
  });
});
