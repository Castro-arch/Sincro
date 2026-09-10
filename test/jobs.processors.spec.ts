import { OrderPollingProcessor } from '../src/jobs/order-polling.processor';
import { TokenRefreshProcessor } from '../src/jobs/token-refresh.processor';

/**
 * O handler de falha e a unica coisa que denuncia um job quebrado: sem ele, a
 * excecao some dentro do BullMQ e o log da aplicacao fica limpo enquanto o
 * sistema para de funcionar.
 */
describe('log de falha dos processors', () => {
  function jobFalso(over: Record<string, unknown> = {}) {
    return { id: '42', attemptsMade: 0, opts: { attempts: 3 }, ...over } as never;
  }

  describe.each([
    ['OrderPollingProcessor', () => new OrderPollingProcessor({} as never, {} as never)],
    ['TokenRefreshProcessor', () => new TokenRefreshProcessor({} as never)],
  ])('%s', (_nome, criar) => {
    it('avisa que havera nova tentativa quando ainda restam tentativas', () => {
      const processor = criar();
      const erro = jest.spyOn(Reflect.get(processor, 'logger'), 'error').mockImplementation();

      processor.aoFalhar(jobFalso({ attemptsMade: 1, opts: { attempts: 3 } }), new Error('ENOTFOUND'));

      const texto = erro.mock.calls[0][0] as string;
      expect(texto).toContain('Job 42 falhou');
      expect(texto).toContain('ENOTFOUND');
      expect(texto).toContain('nova tentativa');
      expect(texto).not.toContain('ESGOTADAS');
    });

    it('grita quando as tentativas acabaram, que e quando algo de fato para', () => {
      const processor = criar();
      const erro = jest.spyOn(Reflect.get(processor, 'logger'), 'error').mockImplementation();

      processor.aoFalhar(jobFalso({ attemptsMade: 3, opts: { attempts: 3 } }), new Error('ENOTFOUND'));

      const texto = erro.mock.calls[0][0] as string;
      expect(texto).toContain('TENTATIVAS ESGOTADAS');
    });

    it('nao quebra quando o BullMQ entrega job indefinido', () => {
      const processor = criar();
      jest.spyOn(Reflect.get(processor, 'logger'), 'error').mockImplementation();

      expect(() => processor.aoFalhar(undefined, new Error('x'))).not.toThrow();
    });
  });
});
