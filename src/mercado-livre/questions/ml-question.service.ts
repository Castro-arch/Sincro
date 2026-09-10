import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MlAuthService } from '../auth/ml-auth.service';
import { MlHttpService } from '../ml-http.service';
import { MlQuestion, MlQuestionSearchResponse } from '../ml-api.types';

const LIMITE_POR_PAGINA = 50;
const MAX_PAGINAS = 20;

/** Limite documentado do ML para o texto de uma resposta. */
export const TAMANHO_MAXIMO_RESPOSTA = 2000;

/**
 * Perguntas de compradores no Mercado Livre.
 *
 * Usa `seller_id` explicito (e nao /my/received_questions) porque o id ja
 * esta em ml_credentials e a chamada real mostrou o filtro ecoando em
 * `filters.seller` -- funciona. `api_version=4` e obrigatorio para a
 * estrutura nova do JSON.
 */
@Injectable()
export class MlQuestionService {
  private readonly logger = new Logger(MlQuestionService.name);

  constructor(
    private readonly http: MlHttpService,
    private readonly auth: MlAuthService,
  ) {}

  /** Todas as perguntas ainda sem resposta, da mais antiga para a mais nova. */
  async buscarNaoRespondidas(): Promise<MlQuestion[]> {
    const sellerId = await this.auth.getSellerId();
    const perguntas: MlQuestion[] = [];

    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const params = new URLSearchParams({
        seller_id: sellerId,
        api_version: '4',
        status: 'UNANSWERED',
        sort_fields: 'date_created',
        sort_types: 'ASC',
        limit: String(LIMITE_POR_PAGINA),
        offset: String(pagina * LIMITE_POR_PAGINA),
      });

      const resposta = await this.http.get<MlQuestionSearchResponse>(
        `/questions/search?${params.toString()}`,
      );
      perguntas.push(...resposta.questions);

      const lidas = (pagina + 1) * LIMITE_POR_PAGINA;
      if (resposta.questions.length < LIMITE_POR_PAGINA || lidas >= resposta.total) break;
    }

    this.logger.debug(`${perguntas.length} pergunta(s) sem resposta no ML.`);
    return perguntas;
  }

  /** Estado atual de uma pergunta -- usado para reconciliar as que sumiram de UNANSWERED. */
  async buscarPorId(mlQuestionId: string): Promise<MlQuestion> {
    return this.http.get<MlQuestion>(`/questions/${mlQuestionId}?api_version=4`);
  }

  /**
   * POST /answers. O ML devolve a pergunta inteira ja com `answer` e
   * `status: ANSWERED` (pela doc; ainda nao observado ao vivo).
   */
  async responder(mlQuestionId: string, texto: string): Promise<MlQuestion> {
    const limpo = texto.trim();
    if (!limpo) {
      throw new BadRequestException('A resposta nao pode ser vazia.');
    }
    if (limpo.length > TAMANHO_MAXIMO_RESPOSTA) {
      throw new BadRequestException(
        `A resposta tem ${limpo.length} caracteres; o Mercado Livre aceita ate ${TAMANHO_MAXIMO_RESPOSTA}.`,
      );
    }

    const resposta = await this.http.post<MlQuestion>('/answers', {
      question_id: Number(mlQuestionId),
      text: limpo,
    });

    this.logger.log(`Pergunta ${mlQuestionId} respondida no Mercado Livre.`);
    return resposta;
  }
}
