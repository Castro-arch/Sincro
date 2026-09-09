import { Controller, Get, Query } from '@nestjs/common';
import {
  AlertaEstoque,
  AnuncioResumo,
  DashboardService,
  VisaoGeral,
} from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** Numeros gerais + estado da conexao com o ML + alertas. */
  @Get()
  async visaoGeral(): Promise<VisaoGeral> {
    return this.dashboardService.visaoGeral();
  }

  /** GET /dashboard/listings?apenasAtivos=true */
  @Get('listings')
  async anuncios(@Query('apenasAtivos') apenasAtivos?: string): Promise<AnuncioResumo[]> {
    return this.dashboardService.listarAnuncios(apenasAtivos === 'true');
  }

  @Get('alerts')
  async alertas(): Promise<AlertaEstoque[]> {
    return this.dashboardService.alertasDeEstoque();
  }
}
