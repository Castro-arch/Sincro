import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateStockBatchDto, UpdateStockDto } from './dto/update-stock.dto';
import { Listing } from './entities/listing.entity';
import { Variation } from './entities/variation.entity';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** Cadastra o produto e o anuncio em rascunho (ainda nao vai ao ML). */
  @Post()
  async criar(@Body() dto: CreateProductDto): Promise<Listing> {
    return this.productsService.criar(dto);
  }

  @Get()
  async listar(): Promise<Listing[]> {
    return this.productsService.listar();
  }

  @Get(':listingId')
  async buscar(@Param('listingId', ParseUUIDPipe) listingId: string): Promise<Listing> {
    return this.productsService.buscarListing(listingId);
  }

  /** Publica o rascunho no Mercado Livre (POST /items). */
  @Post(':listingId/publish')
  async publicar(@Param('listingId', ParseUUIDPipe) listingId: string): Promise<Listing> {
    return this.productsService.publicar(listingId);
  }

  /** Reenvia ao ML o estoque e o preco que estao no banco. */
  @Post(':listingId/sync')
  async sincronizar(
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ): Promise<{ sincronizado: boolean }> {
    await this.productsService.sincronizarComMl(listingId);
    return { sincronizado: true };
  }

  /** Novo estoque (absoluto) de uma variacao -- reflete no ML na hora. */
  @Put('variations/:variationId/stock')
  async atualizarEstoque(
    @Param('variationId', ParseUUIDPipe) variationId: string,
    @Body() dto: UpdateStockDto,
  ): Promise<Variation> {
    return this.productsService.atualizarEstoque(variationId, dto);
  }

  /** Atualizacao de estoque em lote. */
  @Put('variations/stock')
  async atualizarEstoqueEmLote(@Body() dto: UpdateStockBatchDto): Promise<Variation[]> {
    return this.productsService.atualizarEstoqueEmLote(dto);
  }
}
