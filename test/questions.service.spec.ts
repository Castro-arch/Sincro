import { BadRequestException, ConflictException } from '@nestjs/common';
import { QuestionsService } from '../src/questions/questions.service';
import { Question, QuestionStatus } from '../src/questions/entities/question.entity';
import { MlQuestionService } from '../src/mercado-livre/questions/ml-question.service';
import { QuestionPollingProcessor } from '../src/jobs/question-polling.processor';
import type { MlQuestion } from '../src/mercado-livre/ml-api.types';

function remota(id: number, over: Partial<MlQuestion> = {}): MlQuestion {
  return {
    id, item_id: 'MLB7614128174', seller_id: 1824267052, status: 'UNANSWERED',
    text: 'Tem na cor preta?', date_created: '2026-09-10T12:00:00.000Z', answer: null,
    from: { id: 555 }, ...over,
  };
}

/** Repositorio em memoria com a fatia que o servico usa; `find` e injetavel por teste. */
function repoFalso() {
  const linhas: Question[] = [];
  return {
    linhas,
    create: jest.fn((d: Partial<Question>) => ({ id: `id-${linhas.length + 1}`, ...d }) as Question),
    save: jest.fn(async (q: Question) => { const i = linhas.findIndex((l) => l.id === q.id); if (i >= 0) linhas[i] = q; else linhas.push(q); return q; }),
    findOne: jest.fn(async ({ where }: { where: Partial<Question> }) =>
      linhas.find((l) => Object.entries(where).every(([k, v]) => (l as never)[k] === v)) ?? null),
    find: jest.fn(async () => [] as Question[]),
    count: jest.fn(async () => linhas.filter((l) => l.status === QuestionStatus.UNANSWERED).length),
  };
}

describe('QuestionsService.sincronizar', () => {
  it('a mesma pergunta em duas rodadas vira uma linha so', async () => {
    const repo = repoFalso();
    const ml = { buscarNaoRespondidas: jest.fn().mockResolvedValue([remota(1)]), buscarPorId: jest.fn() };
    const produtos = { acharListingPorMlItemId: jest.fn().mockResolvedValue({ id: 'listing-1' }) };
    const s = new QuestionsService(repo as never, ml as never, produtos as never);

    const primeira = await s.sincronizar();
    const segunda = await s.sincronizar();

    expect(primeira.novas).toBe(1);
    expect(segunda.novas).toBe(0);
    expect(repo.linhas).toHaveLength(1);
    expect(repo.linhas[0].listingId).toBe('listing-1');
  });

  it('reconcilia a pendente que sumiu de UNANSWERED: foi respondida pelo painel do ML', async () => {
    const repo = repoFalso();
    const pendente = { id: 'q1', mlQuestionId: '1', status: QuestionStatus.UNANSWERED, texto: 'x', respondidaPeloSincro: false } as Question;
    repo.linhas.push(pendente);
    repo.find.mockResolvedValue([pendente]); // orfa: nao voltou na busca
    const ml = {
      buscarNaoRespondidas: jest.fn().mockResolvedValue([]),
      buscarPorId: jest.fn().mockResolvedValue(remota(1, {
        status: 'ANSWERED', answer: { text: 'Temos sim', status: 'ACTIVE', date_created: '2026-09-10T13:00:00.000Z' },
      })),
    };
    const s = new QuestionsService(repo as never, ml as never, { acharListingPorMlItemId: jest.fn() } as never);

    const r = await s.sincronizar();

    expect(r.reconciliadas).toBe(1);
    expect(pendente.status).toBe(QuestionStatus.ANSWERED);
    expect(pendente.respostaTexto).toBe('Temos sim');
    // Respondida la, nao aqui: a flag continua falsa.
    expect(pendente.respondidaPeloSincro).toBe(false);
  });

  it('pergunta BANNED chega com texto vazio e nao apaga o texto guardado', () => {
    const s = new QuestionsService({} as never, {} as never, {} as never);
    const q = { texto: 'pergunta original', status: QuestionStatus.UNANSWERED } as Question;
    const mudou = s.aplicarDoMl(q, remota(1, { status: 'BANNED', text: '' }));
    expect(mudou).toBe(true);
    expect(q.status).toBe(QuestionStatus.BANNED);
    expect(q.texto).toBe('pergunta original');
  });
});

describe('QuestionsService.responder', () => {
  it('recusa responder pergunta que nao esta pendente', async () => {
    const repo = repoFalso();
    repo.linhas.push({ id: 'q1', mlQuestionId: '1', status: QuestionStatus.ANSWERED } as Question);
    const s = new QuestionsService(repo as never, { responder: jest.fn() } as never, {} as never);
    await expect(s.responder('q1', 'oi')).rejects.toBeInstanceOf(ConflictException);
  });

  it('marca como respondida pelo Sincro com o que o ML devolveu', async () => {
    const repo = repoFalso();
    repo.linhas.push({ id: 'q1', mlQuestionId: '1', status: QuestionStatus.UNANSWERED, texto: 'x' } as Question);
    const ml = { responder: jest.fn().mockResolvedValue(remota(1, {
      status: 'ANSWERED', answer: { text: 'Temos sim', status: 'ACTIVE', date_created: '2026-09-10T13:00:00.000Z' },
    })) };
    const s = new QuestionsService(repo as never, ml as never, {} as never);

    const q = await s.responder('q1', 'Temos sim');

    expect(ml.responder).toHaveBeenCalledWith('1', 'Temos sim');
    expect(q.status).toBe(QuestionStatus.ANSWERED);
    expect(q.respondidaPeloSincro).toBe(true);
    expect(q.respostaTexto).toBe('Temos sim');
  });
});

describe('MlQuestionService.responder', () => {
  it('recusa vazio e acima de 2000 caracteres sem chamar o ML', async () => {
    const http = { post: jest.fn() };
    const s = new MlQuestionService(http as never, {} as never);
    await expect(s.responder('1', '   ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.responder('1', 'a'.repeat(2001))).rejects.toBeInstanceOf(BadRequestException);
    expect(http.post).not.toHaveBeenCalled();
  });
});

describe('QuestionPollingProcessor.aoFalhar', () => {
  it('grita quando as tentativas acabam', () => {
    const p = new QuestionPollingProcessor({} as never, {} as never);
    const erro = jest.spyOn(Reflect.get(p, 'logger'), 'error').mockImplementation();
    p.aoFalhar({ id: '7', attemptsMade: 3, opts: { attempts: 3 } } as never, new Error('ENOTFOUND'));
    expect(erro.mock.calls[0][0]).toContain('TENTATIVAS ESGOTADAS');
  });
});
