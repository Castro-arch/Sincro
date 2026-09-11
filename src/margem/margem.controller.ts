import { Controller, Get, Query } from '@nestjs/common';
import { MargemService, RelatorioMargem } from './margem.service';

@Controller('margem')
export class MargemController {
  constructor(private readonly margemService: MargemService) {}

  /** GET /margem?dias=30 */
  @Get()
  async relatorio(@Query('dias') dias?: string): Promise<RelatorioMargem> {
    const janela = Number(dias);
    return this.margemService.relatorio(Number.isFinite(janela) && janela > 0 ? janela : 30);
  }
}
