import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MlHttpService } from '../ml-http.service';
import { MlCategoryAttribute, MlCategoryPrediction } from '../ml-api.types';

export interface AtributoObrigatorio {
  id: string;
  nome: string;
  tipoValor: string;
  obrigatorio: boolean;
  /** Atributo que so pode ser definido na criacao do anuncio. */
  somenteNaCriacao: boolean;
  /** Atributo que deve ir em attribute_combinations, nao em attributes. */
  usadoEmVariacoes: boolean;
  valoresPermitidos: Array<{ id: string; nome: string }> | null;
  unidadesPermitidas: Array<{ id: string; nome: string }> | null;
  dica: string | null;
}

/**
 * Consultas de categoria do Mercado Livre.
 *
 * Ambos os endpoints usados aqui sao publicos: funcionam antes mesmo do OAuth,
 * o que permite montar o formulario de cadastro sem depender do token.
 */
@Injectable()
export class MlCategoryService {
  private readonly logger = new Logger(MlCategoryService.name);

  /** Cache de atributos por categoria -- mudam raramente e a listagem e grande. */
  private readonly cacheAtributos = new Map<string, { dados: MlCategoryAttribute[]; em: number }>();
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000;

  constructor(
    private readonly http: MlHttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sugere categorias a partir do titulo do produto (category_predictor).
   * Retorna as melhores apostas em ordem de confianca.
   */
  async preverCategoria(titulo: string, limite = 5): Promise<MlCategoryPrediction[]> {
    const siteId = this.config.getOrThrow<string>('ML_SITE_ID');
    const params = new URLSearchParams({ q: titulo, limit: String(limite) });

    const resultado = await this.http.getPublic<MlCategoryPrediction[]>(
      `/sites/${siteId}/domain_discovery/search?${params.toString()}`,
    );

    this.logger.debug(`Predictor sugeriu ${resultado.length} categoria(s) para "${titulo}".`);
    return resultado;
  }

  /** Lista crua de atributos da categoria, como o ML devolve. */
  async listarAtributos(categoriaId: string): Promise<MlCategoryAttribute[]> {
    const cached = this.cacheAtributos.get(categoriaId);
    if (cached && Date.now() - cached.em < MlCategoryService.CACHE_TTL_MS) {
      return cached.dados;
    }

    const atributos = await this.http.getPublic<MlCategoryAttribute[]>(
      `/categories/${categoriaId}/attributes`,
    );

    this.cacheAtributos.set(categoriaId, { dados: atributos, em: Date.now() });
    return atributos;
  }

  /**
   * Atributos da categoria em formato amigavel para montar/validar o
   * formulario de cadastro do Sincro.
   */
  async descreverAtributos(categoriaId: string): Promise<AtributoObrigatorio[]> {
    const atributos = await this.listarAtributos(categoriaId);

    return atributos.map((attr) => ({
      id: attr.id,
      nome: attr.name,
      tipoValor: attr.value_type,
      obrigatorio: Boolean(attr.tags?.required ?? attr.tags?.catalog_required),
      somenteNaCriacao: Boolean(attr.tags?.fixed),
      usadoEmVariacoes: Boolean(attr.tags?.allow_variations ?? attr.tags?.variation_attribute),
      valoresPermitidos: attr.values?.length
        ? attr.values.map((v) => ({ id: v.id, nome: v.name }))
        : null,
      unidadesPermitidas: attr.allowed_units?.length
        ? attr.allowed_units.map((u) => ({ id: u.id, nome: u.name }))
        : null,
      dica: attr.hint ?? null,
    }));
  }

  /** Somente os atributos que o ML exige para publicar nesta categoria. */
  async listarObrigatorios(categoriaId: string): Promise<AtributoObrigatorio[]> {
    const todos = await this.descreverAtributos(categoriaId);
    return todos.filter((a) => a.obrigatorio);
  }

  /**
   * Valida um conjunto de atributos preenchidos contra a categoria escolhida.
   * Chamado antes do POST /items para o erro aparecer no formulario, e nao
   * como uma rejeicao crua do Mercado Livre.
   */
  async validarAtributos(
    categoriaId: string,
    preenchidos: Array<{ id: string; value_name?: string; value_id?: string }>,
    idsDefinidosEmVariacoes: string[] = [],
  ): Promise<{ valido: boolean; faltando: AtributoObrigatorio[] }> {
    const obrigatorios = await this.listarObrigatorios(categoriaId);

    const informados = new Set(
      preenchidos
        .filter((a) => (a.value_name ?? '').toString().trim() !== '' || Boolean(a.value_id))
        .map((a) => a.id),
    );

    // Atributos como COLOR/SIZE viajam em attribute_combinations de cada
    // variacao, nao em attributes -- estao satisfeitos, ainda que ausentes ali.
    for (const id of idsDefinidosEmVariacoes) {
      informados.add(id);
    }

    const faltando = obrigatorios.filter((a) => !informados.has(a.id));
    return { valido: faltando.length === 0, faltando };
  }
}
