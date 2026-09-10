import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Question, QuestionStatus } from './entities/question.entity';
import { MlQuestionService } from '../mercado-livre/questions/ml-question.service';
import { MlQuestion } from '../mercado-livre/ml-api.types';
import { ProductsService } from '../products/products.service';

export interface ResultadoSincronizacaoPerguntas {
  lidasNoMl: number;
  novas: number;
  atualizadas: number;
  /** Pendentes locais que sumiram de UNANSWERED no ML e tiveram o status refeito. */
  reconciliadas: number;
}

/**
 * Perguntas dentro do Sincro: historico no banco, resposta repassada ao ML.
 *
 * O ponto que mais importa e a reconciliacao: uma pergunta respondida pelo
 * painel do ML some da busca de UNANSWERED, e se o Sincro so fizesse upsert
 * do que a busca devolve, ela ficaria "pendente" aqui para sempre -- a lista
 * mentiria em silencio. Por isso cada rodada tambem consulta, uma a uma, as
 * pendentes locais que nao voltaram.
 */
@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    @InjectRepository(Question) private readonly questionsRepo: Repository<Question>,
    private readonly mlQuestionService: MlQuestionService,
    private readonly productsService: ProductsService,
  ) {}

  async listar(apenasPendentes: boolean): Promise<Question[]> {
    return this.questionsRepo.find({
      where: apenasPendentes ? { status: QuestionStatus.UNANSWERED } : {},
      relations: { listing: true },
      order: { dataPergunta: apenasPendentes ? 'ASC' : 'DESC' },
      take: 200,
    });
  }

  async contarPendentes(): Promise<number> {
    return this.questionsRepo.count({ where: { status: QuestionStatus.UNANSWERED } });
  }

  async responder(id: string, texto: string): Promise<Question> {
    const pergunta = await this.questionsRepo.findOne({ where: { id }, relations: { listing: true } });
    if (!pergunta) {
      throw new NotFoundException(`Pergunta ${id} nao encontrada.`);
    }
    if (pergunta.status !== QuestionStatus.UNANSWERED) {
      throw new ConflictException(
        `Pergunta ${pergunta.mlQuestionId} esta "${pergunta.status}" -- so perguntas sem resposta podem ser respondidas.`,
      );
    }

    const devolvida = await this.mlQuestionService.responder(pergunta.mlQuestionId, texto);

    this.aplicarDoMl(pergunta, devolvida);
    // Se a resposta cair em moderacao o ML pode devolver sem `answer`; o que
    // digitamos e o que vale mostrar de qualquer forma.
    pergunta.respostaTexto = pergunta.respostaTexto ?? texto.trim();
    pergunta.respondidaEm = pergunta.respondidaEm ?? new Date();
    pergunta.respondidaPeloSincro = true;

    return this.questionsRepo.save(pergunta);
  }

  async sincronizar(): Promise<ResultadoSincronizacaoPerguntas> {
    const remotas = await this.mlQuestionService.buscarNaoRespondidas();
    const resultado: ResultadoSincronizacaoPerguntas = {
      lidasNoMl: remotas.length,
      novas: 0,
      atualizadas: 0,
      reconciliadas: 0,
    };

    for (const remota of remotas) {
      const local = await this.questionsRepo.findOne({ where: { mlQuestionId: String(remota.id) } });
      if (local) {
        if (this.aplicarDoMl(local, remota)) {
          await this.questionsRepo.save(local);
          resultado.atualizadas++;
        }
        continue;
      }

      const listing = await this.productsService.acharListingPorMlItemId(remota.item_id);
      const nova = this.questionsRepo.create({
        mlQuestionId: String(remota.id),
        mlItemId: remota.item_id,
        listingId: listing?.id ?? null,
        fromUserId: remota.from?.id ? String(remota.from.id) : null,
        texto: remota.text,
        status: remota.status as QuestionStatus,
        dataPergunta: new Date(remota.date_created),
        respondidaPeloSincro: false,
      });
      this.aplicarDoMl(nova, remota);
      await this.questionsRepo.save(nova);
      resultado.novas++;
    }

    // Reconciliacao: pendente local que nao voltou na busca mudou de status
    // fora do Sincro (respondida pelo painel, apagada, banida...).
    const idsRemotos = remotas.map((r) => String(r.id));
    const orfas = await this.questionsRepo.find({
      where: {
        status: QuestionStatus.UNANSWERED,
        ...(idsRemotos.length ? { mlQuestionId: Not(In(idsRemotos)) } : {}),
      },
    });

    for (const orfa of orfas) {
      try {
        const atual = await this.mlQuestionService.buscarPorId(orfa.mlQuestionId);
        if (this.aplicarDoMl(orfa, atual)) {
          await this.questionsRepo.save(orfa);
          resultado.reconciliadas++;
        }
      } catch (erro) {
        // Nao aborta a rodada: as outras pendentes ainda precisam ser checadas.
        this.logger.warn(
          `Nao foi possivel reconciliar a pergunta ${orfa.mlQuestionId}: ${erro instanceof Error ? erro.message : String(erro)}`,
        );
      }
    }

    this.logger.log(
      `Perguntas: ${resultado.lidasNoMl} sem resposta no ML, ${resultado.novas} nova(s), ` +
        `${resultado.atualizadas} atualizada(s), ${resultado.reconciliadas} reconciliada(s).`,
    );
    return resultado;
  }

  /**
   * Copia para a entidade o que o ML diz sobre a pergunta. Devolve true se
   * algo mudou -- e o que decide salvar e o que os testes observam.
   */
  aplicarDoMl(pergunta: Question, remota: MlQuestion): boolean {
    const retrato = () =>
      JSON.stringify([
        pergunta.status,
        pergunta.texto,
        pergunta.respostaTexto,
        pergunta.respostaStatus,
        pergunta.respondidaEm?.toISOString() ?? null,
      ]);
    const antes = retrato();

    pergunta.status = remota.status as QuestionStatus;
    // BANNED chega com texto vazio: nao apaga o que ja tinhamos guardado.
    if (remota.text) pergunta.texto = remota.text;
    if (remota.answer) {
      pergunta.respostaTexto = remota.answer.text || pergunta.respostaTexto;
      pergunta.respostaStatus = remota.answer.status ?? null;
      pergunta.respondidaEm = remota.answer.date_created
        ? new Date(remota.answer.date_created)
        : (pergunta.respondidaEm ?? new Date());
    }

    return antes !== retrato();
  }
}
