import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Listing, ListingStatus } from './entities/listing.entity';
import { Variation } from './entities/variation.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateStockBatchDto, UpdateStockDto } from './dto/update-stock.dto';
import { UpdateProductDto, UpdateVariationDto } from './dto/update-product.dto';
import { StatusMl } from './dto/update-status.dto';
import { MlCategoryService } from '../mercado-livre/categories/ml-category.service';
import { MlItemService } from '../mercado-livre/items/ml-item.service';

/**
 * Dominio interno de catalogo -- a fonte de verdade.
 *
 * Regra que atravessa o arquivo inteiro: o banco decide, o Mercado Livre
 * espelha. Toda escrita de estoque no ML manda o valor ABSOLUTO (nunca um
 * delta), o que torna qualquer re-sincronizacao idempotente e segura de
 * repetir depois de uma falha.
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    @InjectRepository(Listing) private readonly listingsRepo: Repository<Listing>,
    @InjectRepository(Variation) private readonly variationsRepo: Repository<Variation>,
    private readonly dataSource: DataSource,
    private readonly categoryService: MlCategoryService,
    private readonly itemService: MlItemService,
  ) {}

  // ------------------------------------------------------------------ cadastro

  /** Cria produto + anuncio em rascunho + variacoes, tudo numa transacao. */
  async criar(dto: CreateProductDto): Promise<Listing> {
    const skuExistente = await this.productsRepo.findOne({ where: { sku: dto.sku } });
    if (skuExistente) {
      throw new ConflictException(`Ja existe um produto com o SKU "${dto.sku}".`);
    }

    this.validarCombinacoes(dto);

    // Se a categoria ja foi escolhida, checa os atributos obrigatorios agora --
    // e melhor recusar no cadastro do que descobrir na hora de publicar.
    if (dto.categoriaId) {
      await this.garantirAtributosObrigatorios(
        dto.categoriaId,
        dto.atributos ?? [],
        dto.variacoes.flatMap((v) => v.atributos.map((a) => a.id)),
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const produto = await manager.save(
        manager.create(Product, {
          sku: dto.sku,
          nome: dto.nome,
          descricao: dto.descricao ?? null,
          custoUnitario: dto.custoUnitario ?? null,
        }),
      );

      const listing = await manager.save(
        manager.create(Listing, {
          productId: produto.id,
          titulo: dto.titulo ?? dto.nome,
          status: ListingStatus.RASCUNHO,
          categoriaId: dto.categoriaId ?? null,
          listingTypeId: dto.listingTypeId ?? 'gold_special',
          condicao: dto.condicao ?? 'new',
          moeda: dto.moeda ?? 'BRL',
          descricao: dto.descricao ?? null,
          atributos: dto.atributos ?? [],
          pictureIds: dto.pictureIds ?? [],
        }),
      );

      await manager.save(
        dto.variacoes.map((v) =>
          manager.create(Variation, {
            listingId: listing.id,
            sku: v.sku ?? null,
            atributos: v.atributos,
            preco: v.preco,
            estoque: v.estoque,
            pictureIds: v.pictureIds ?? [],
          }),
        ),
      );

      this.logger.log(`Produto "${produto.sku}" criado como rascunho (listing ${listing.id}).`);
      return this.carregarListing(listing.id, manager.getRepository(Listing));
    });
  }

  // ------------------------------------------------------------------- edicao

  /**
   * Edita produto e rascunho. O que pode mudar depende do estado do anuncio:
   *
   *   campo                          rascunho/erro   publicado
   *   nome, descricao, custo         sim             sim (so no Sincro)
   *   titulo, atributos, imagens     sim             sim (reenviado ao ML)
   *   categoria                      sim             NAO
   *   combinacoes de variacao        sim             NAO (so preco/estoque)
   *
   * A categoria e bloqueada porque o ML recusa com
   * `item.category_id.not_modifiable` (verificado em 2026-09-11): em anuncio
   * publicado, mudar de categoria exige encerrar e recriar. Recusar aqui, com
   * o motivo, e melhor do que deixar o ML recusar depois sem contexto.
   */
  async atualizar(listingId: string, dto: UpdateProductDto): Promise<Listing> {
    const listing = await this.carregarListing(listingId, this.listingsRepo);
    const publicado = Boolean(listing.mlItemId);

    if (publicado && dto.categoriaId && dto.categoriaId !== listing.categoriaId) {
      throw new ConflictException(
        `A categoria de um anúncio publicado não pode ser alterada: o Mercado Livre recusa com "item.category_id.not_modifiable". Para mudar de categoria, encerre este anúncio (${listing.mlItemId}) e cadastre outro produto.`,
      );
    }

    const variacoes = await this.variacoesDo(listingId);
    if (publicado && dto.variacoes?.some((v) => !v.variationId || v.atributos)) {
      throw new ConflictException(
        'Em anúncio publicado só dá para ajustar preço e estoque das variações existentes. Criar ou recombinar variação exige um anúncio novo.',
      );
    }

    const categoriaFinal = dto.categoriaId ?? listing.categoriaId;
    const atributosFinais = dto.atributos ?? listing.atributos;

    // Mesma checagem do cadastro -- nao ha segunda copia da regra.
    if (categoriaFinal && (dto.atributos || dto.categoriaId)) {
      const combinacoes = (dto.variacoes ?? variacoes).flatMap((v) =>
        (v.atributos ?? []).map((a) => String(a.id)),
      );
      await this.garantirAtributosObrigatorios(categoriaFinal, atributosFinais, combinacoes);
    }

    await this.dataSource.transaction(async (manager) => {
      if (dto.nome !== undefined || dto.descricao !== undefined || dto.custoUnitario !== undefined) {
        const produto = await manager.findOneByOrFail(Product, { id: listing.productId });
        if (dto.nome !== undefined) produto.nome = dto.nome;
        if (dto.descricao !== undefined) produto.descricao = dto.descricao || null;
        if (dto.custoUnitario !== undefined) produto.custoUnitario = dto.custoUnitario ?? null;
        await manager.save(produto);
      }

      if (dto.titulo !== undefined) listing.titulo = dto.titulo;
      if (dto.descricao !== undefined) listing.descricao = dto.descricao || null;
      if (dto.categoriaId !== undefined) listing.categoriaId = dto.categoriaId;
      if (dto.atributos !== undefined) listing.atributos = dto.atributos;
      if (dto.pictureIds !== undefined) listing.pictureIds = dto.pictureIds;
      await manager.save(listing);

      for (const entrada of dto.variacoes ?? []) {
        await this.aplicarVariacao(manager, listing, variacoes, entrada);
      }
    });

    // O anuncio ja publicado tem que refletir a edicao no ML. Falhar aqui nao
    // desfaz a edicao local: o rascunho corrigido e o que interessa guardar, e
    // `sincronizar` pode ser repetido.
    if (publicado) {
      try {
        await this.sincronizarComMl(listingId);
      } catch (erro) {
        this.logger.error(
          `Edição salva, mas o Mercado Livre recusou a sincronização de ${listing.mlItemId}: ${
            erro instanceof Error ? erro.message : String(erro)
          }`,
        );
        throw erro;
      }
    }

    return this.carregarListing(listingId, this.listingsRepo);
  }

  /** Custo de aquisicao isolado -- alcanca produto que nem anuncio tem. */
  async atualizarCusto(productId: string, custoUnitario: number | null): Promise<Product> {
    const produto = await this.productsRepo.findOne({ where: { id: productId } });
    if (!produto) {
      throw new NotFoundException(`Produto ${productId} nao encontrado.`);
    }
    produto.custoUnitario = custoUnitario;
    return this.productsRepo.save(produto);
  }

  /**
   * Pergunta ao ML se o anuncio passaria, sem publicar.
   * Devolve a lista de causas em vez de estourar: a tela usa isso para guiar
   * a correcao campo a campo.
   */
  async validarNoMl(
    listingId: string,
    rascunho?: UpdateProductDto,
  ): Promise<{ valido: boolean; erro: string | null }> {
    const listing = await this.carregarListing(listingId, this.listingsRepo);
    let variacoes = await this.variacoesDo(listingId);

    // Aplica o que esta na TELA sobre uma copia em memoria, sem persistir.
    // Sem isto a validacao respondia sobre o rascunho salvo, e o usuario
    // corrigia o formulario para receber de volta o erro da versao antiga.
    if (rascunho) {
      if (rascunho.titulo !== undefined) listing.titulo = rascunho.titulo;
      if (rascunho.categoriaId !== undefined) listing.categoriaId = rascunho.categoriaId;
      if (rascunho.atributos !== undefined) listing.atributos = rascunho.atributos;
      if (rascunho.pictureIds !== undefined) listing.pictureIds = rascunho.pictureIds;
      if (rascunho.variacoes?.length) {
        variacoes = rascunho.variacoes.map((v, i) =>
          Object.assign(Object.create(Object.getPrototypeOf(variacoes[i] ?? {})), variacoes[i], {
            atributos: v.atributos ?? variacoes[i]?.atributos ?? [],
            preco: v.preco ?? variacoes[i]?.preco ?? 0,
            estoque: v.estoque ?? variacoes[i]?.estoque ?? 0,
            pictureIds: v.pictureIds ?? variacoes[i]?.pictureIds ?? [],
          }),
        ) as Variation[];
      }
    }

    try {
      await this.itemService.validar(listing, variacoes);
      return { valido: true, erro: null };
    } catch (erro) {
      return { valido: false, erro: erro instanceof Error ? erro.message : String(erro) };
    }
  }

  // ------------------------------------------------------------------- leitura

  async listar(): Promise<Listing[]> {
    return this.listingsRepo.find({
      relations: { product: true, variations: true },
      order: { criadoEm: 'DESC' },
    });
  }

  async buscarListing(listingId: string): Promise<Listing> {
    return this.carregarListing(listingId, this.listingsRepo);
  }

  async buscarVariacao(variationId: string): Promise<Variation> {
    const variacao = await this.variationsRepo.findOne({
      where: { id: variationId },
      relations: { listing: true },
    });
    if (!variacao) {
      throw new NotFoundException(`Variacao ${variationId} nao encontrada.`);
    }
    return variacao;
  }

  // ---------------------------------------------------------------- publicacao

  /**
   * Publica o rascunho no Mercado Livre e grava os ids devolvidos (item e
   * variacoes). Sem esses ids nao ha como sincronizar estoque depois.
   */
  async publicar(listingId: string): Promise<Listing> {
    const listing = await this.carregarListing(listingId, this.listingsRepo);

    if (listing.mlItemId) {
      throw new ConflictException(
        `Anuncio ja publicado no Mercado Livre como ${listing.mlItemId}.`,
      );
    }
    if (!listing.categoriaId) {
      throw new BadRequestException(
        'Defina a categoria antes de publicar (GET /ml/categories/predict sugere uma).',
      );
    }
    if (!listing.pictureIds?.length) {
      throw new BadRequestException(
        'O anuncio precisa de ao menos uma imagem. Envie em POST /ml/pictures/upload.',
      );
    }

    const variacoes = await this.variacoesDo(listing.id);

    await this.garantirAtributosObrigatorios(
      listing.categoriaId,
      listing.atributos,
      variacoes.flatMap((v) => v.atributos.map((a) => String(a.id))),
    );

    try {
      const item = await this.itemService.publicar(listing, variacoes);

      await this.dataSource.transaction(async (manager) => {
        listing.mlItemId = item.id;
        listing.status = ListingStatus.ATIVO;
        listing.permalink = item.permalink ?? null;
        listing.sincronizadoEm = new Date();
        listing.ultimoErro = null;
        await manager.save(listing);

        // Casa cada variacao do ML com a do banco pela combinacao de atributos.
        for (const variacaoMl of item.variations ?? []) {
          const correspondente = this.acharCorrespondente(variacoes, variacaoMl);
          if (!correspondente) {
            this.logger.warn(
              `Variacao ${variacaoMl.id} do ML nao casou com nenhuma variacao local do anuncio ${item.id}.`,
            );
            continue;
          }
          correspondente.mlVariationId = String(variacaoMl.id);
          await manager.save(correspondente);
        }

        // Anuncio sem variacoes: o proprio item faz o papel da variacao unica.
        if (!item.variations?.length && variacoes.length === 1) {
          variacoes[0].mlVariationId = item.id;
          await manager.save(variacoes[0]);
        }
      });

      this.logger.log(`Anuncio publicado: ${item.id} (${item.permalink}).`);
      return this.carregarListing(listing.id, this.listingsRepo);
    } catch (error) {
      listing.status = ListingStatus.ERRO;
      listing.ultimoErro = error instanceof Error ? error.message : String(error);
      await this.listingsRepo.save(listing);
      throw error;
    }
  }

  // --------------------------------------------------------------- estoque

  /**
   * Define o estoque (valor absoluto) de uma variacao e propaga para o ML.
   *
   * O banco so mantem a alteracao se o ML aceitar: uma divergencia silenciosa
   * entre os dois lados vende o que nao existe.
   */
  async atualizarEstoque(variationId: string, dto: UpdateStockDto): Promise<Variation> {
    const variacao = await this.buscarVariacao(variationId);
    const anterior = { estoque: variacao.estoque, preco: variacao.preco };

    variacao.estoque = dto.estoque;
    if (dto.preco !== undefined) {
      variacao.preco = dto.preco;
    }
    await this.variationsRepo.save(variacao);

    try {
      await this.sincronizarComMl(variacao.listingId);
    } catch (error) {
      variacao.estoque = anterior.estoque;
      variacao.preco = anterior.preco;
      await this.variationsRepo.save(variacao);
      this.logger.error(
        `Estoque da variacao ${variationId} revertido: o Mercado Livre recusou a atualizacao.`,
      );
      throw error;
    }

    return variacao;
  }

  /** Mesma coisa, em lote: N variacoes, um unico PUT por anuncio. */
  async atualizarEstoqueEmLote(dto: UpdateStockBatchDto): Promise<Variation[]> {
    const variacoes = await Promise.all(dto.itens.map((i) => this.buscarVariacao(i.variationId)));

    const listingIds = new Set(variacoes.map((v) => v.listingId));
    const anteriores = variacoes.map((v) => ({ estoque: v.estoque, preco: v.preco }));

    for (const [indice, variacao] of variacoes.entries()) {
      const item = dto.itens[indice];
      variacao.estoque = item.estoque;
      if (item.preco !== undefined) {
        variacao.preco = item.preco;
      }
    }
    await this.variationsRepo.save(variacoes);

    try {
      for (const listingId of listingIds) {
        await this.sincronizarComMl(listingId);
      }
    } catch (error) {
      for (const [indice, variacao] of variacoes.entries()) {
        variacao.estoque = anteriores[indice].estoque;
        variacao.preco = anteriores[indice].preco;
      }
      await this.variationsRepo.save(variacoes);
      throw error;
    }

    return variacoes;
  }

  /**
   * Baixa de estoque por venda. Diferente de `atualizarEstoque`, aqui a
   * reducao no banco NAO e revertida se o ML falhar: a venda ja aconteceu e o
   * proprio ML ja descontou a quantidade do lado dele. O push serve para
   * reconciliar os dois lados e, por mandar valor absoluto, pode ser repetido
   * a vontade sem descontar duas vezes.
   */
  async baixarEstoque(variationId: string, quantidade: number): Promise<Variation> {
    if (quantidade <= 0) {
      throw new BadRequestException('Quantidade da baixa deve ser positiva.');
    }

    // UPDATE atomico: dois pedidos concorrentes nunca leem o mesmo saldo.
    const resultado = await this.variationsRepo
      .createQueryBuilder()
      .update(Variation)
      .set({ estoque: () => `GREATEST("estoque" - ${Math.trunc(quantidade)}, 0)` })
      .where('id = :id', { id: variationId })
      .execute();

    if (!resultado.affected) {
      throw new NotFoundException(`Variacao ${variationId} nao encontrada.`);
    }

    const variacao = await this.buscarVariacao(variationId);
    this.logger.log(
      `Baixa de ${quantidade} un. na variacao ${variationId}. Estoque agora: ${variacao.estoque}.`,
    );

    return variacao;
  }

  /**
   * Pausa, reativa ou encerra o anuncio no ML e reflete o status no banco.
   *
   * Sem isto o Sincro so sabia criar anuncio: tirar do ar exigia entrar no
   * painel do ML, o que quebra a premissa de que o ciclo de vida inteiro
   * passa por aqui.
   */
  async alterarStatus(listingId: string, status: StatusMl): Promise<Listing> {
    const listing = await this.carregarListing(listingId, this.listingsRepo);

    if (!listing.mlItemId) {
      throw new BadRequestException(
        `Anuncio ${listingId} ainda e rascunho -- nao ha o que alterar no Mercado Livre.`,
      );
    }

    await this.itemService.alterarStatus(listing.mlItemId, status);

    const equivalente: Record<StatusMl, ListingStatus> = {
      active: ListingStatus.ATIVO,
      paused: ListingStatus.PAUSADO,
      closed: ListingStatus.ENCERRADO,
    };

    listing.status = equivalente[status];
    listing.sincronizadoEm = new Date();
    listing.ultimoErro = null;
    await this.listingsRepo.save(listing);

    this.logger.log(`Anuncio ${listing.mlItemId} agora esta "${listing.status}".`);
    return this.carregarListing(listing.id, this.listingsRepo);
  }

  /** Empurra estoque e preco atuais do banco para o anuncio no ML. */
  async sincronizarComMl(listingId: string): Promise<void> {
    const listing = await this.carregarListing(listingId, this.listingsRepo);

    if (!listing.mlItemId) {
      this.logger.debug(`Anuncio ${listingId} ainda e rascunho -- nada a sincronizar.`);
      return;
    }

    const variacoes = await this.variacoesDo(listingId);
    await this.itemService.sincronizarEstoqueEPreco(listing, variacoes);

    listing.sincronizadoEm = new Date();
    listing.ultimoErro = null;
    await this.listingsRepo.save(listing);
  }

  // -------------------------------------------------------------------- apoio

  async variacoesDo(listingId: string): Promise<Variation[]> {
    return this.variationsRepo.find({ where: { listingId }, order: { criadoEm: 'ASC' } });
  }

  /** Localiza a variacao local pelo id do ML (usado na baixa por pedido). */
  async acharPorMlVariationId(mlVariationId: string): Promise<Variation | null> {
    return this.variationsRepo.findOne({
      where: { mlVariationId },
      relations: { listing: true },
    });
  }

  async acharListingPorMlItemId(mlItemId: string): Promise<Listing | null> {
    return this.listingsRepo.findOne({
      where: { mlItemId },
      relations: { variations: true },
    });
  }

  /** Atualiza uma variacao existente ou cria nova (so em rascunho). */
  private async aplicarVariacao(
    manager: EntityManager,
    listing: Listing,
    existentes: Variation[],
    entrada: UpdateVariationDto,
  ): Promise<void> {
    if (entrada.variationId) {
      const atual = existentes.find((v) => v.id === entrada.variationId);
      if (!atual) {
        throw new NotFoundException(`Variacao ${entrada.variationId} nao pertence a este anuncio.`);
      }
      if (entrada.sku !== undefined) atual.sku = entrada.sku || null;
      if (entrada.atributos !== undefined) atual.atributos = entrada.atributos;
      if (entrada.preco !== undefined) atual.preco = entrada.preco;
      if (entrada.estoque !== undefined) atual.estoque = entrada.estoque;
      if (entrada.pictureIds !== undefined) atual.pictureIds = entrada.pictureIds;
      await manager.save(atual);
      return;
    }

    await manager.save(
      manager.create(Variation, {
        listingId: listing.id,
        sku: entrada.sku ?? null,
        atributos: entrada.atributos ?? [],
        preco: entrada.preco ?? 0,
        estoque: entrada.estoque ?? 0,
        pictureIds: entrada.pictureIds ?? [],
      }),
    );
  }

  private async carregarListing(listingId: string, repo: Repository<Listing>): Promise<Listing> {
    const listing = await repo.findOne({
      where: { id: listingId },
      relations: { product: true, variations: true },
    });
    if (!listing) {
      throw new NotFoundException(`Anuncio ${listingId} nao encontrado.`);
    }
    return listing;
  }

  /**
   * Duas variacoes nao podem ter a mesma combinacao de atributos -- o ML
   * rejeita, e no banco isso viraria estoque ambiguo.
   */
  private validarCombinacoes(dto: CreateProductDto): void {
    const chaves = dto.variacoes.map((v) =>
      v.atributos
        .map((a) => `${a.id}=${a.value_id ?? a.value_name ?? ''}`)
        .sort()
        .join('|'),
    );

    const duplicadas = chaves.filter((chave, indice) => chaves.indexOf(chave) !== indice);
    if (duplicadas.length > 0) {
      throw new BadRequestException(
        `Ha variacoes com a mesma combinacao de atributos: ${[...new Set(duplicadas)].join(', ')}.`,
      );
    }

    // Ou todas as variacoes tem combinacao, ou o anuncio e de item unico.
    const semAtributos = dto.variacoes.filter((v) => v.atributos.length === 0).length;
    if (semAtributos > 0 && semAtributos !== dto.variacoes.length) {
      throw new BadRequestException(
        'Ou todas as variacoes tem atributos, ou o anuncio tem uma unica variacao sem atributos.',
      );
    }
    if (semAtributos > 1) {
      throw new BadRequestException(
        'Anuncio sem variacoes deve ter exatamente uma entrada em "variacoes".',
      );
    }
  }

  /** Recusa a publicacao enquanto faltar atributo exigido pela categoria. */
  private async garantirAtributosObrigatorios(
    categoriaId: string,
    atributos: Array<{ id: string; value_name?: string; value_id?: string }>,
    idsEmVariacoes: string[],
  ): Promise<void> {
    const { valido, faltando } = await this.categoryService.validarAtributos(
      categoriaId,
      atributos,
      idsEmVariacoes,
    );

    if (!valido) {
      throw new BadRequestException({
        message: `A categoria ${categoriaId} exige atributos que nao foram preenchidos.`,
        faltando: faltando.map((a) => ({
          id: a.id,
          nome: a.nome,
          valoresPermitidos: a.valoresPermitidos,
        })),
      });
    }
  }

  /** Casa a variacao devolvida pelo ML com a local comparando as combinacoes. */
  private acharCorrespondente(
    variacoes: Variation[],
    variacaoMl: { attribute_combinations: Array<{ id: string; value_name: string }> },
  ): Variation | undefined {
    const chaveMl = this.chaveCombinacao(variacaoMl.attribute_combinations);
    return variacoes.find((v) => this.chaveCombinacao(v.atributos) === chaveMl);
  }

  private chaveCombinacao(combinacoes: Array<{ id: string; value_name?: string }>): string {
    return combinacoes
      .map((c) => `${c.id}=${(c.value_name ?? '').toLowerCase()}`)
      .sort()
      .join('|');
  }
}
