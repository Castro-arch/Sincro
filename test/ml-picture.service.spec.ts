import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { MlPictureService } from '../src/mercado-livre/pictures/ml-picture.service';

function arquivo(over: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: 'foto.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('conteudo-binario'),
    size: 1024,
    ...over,
  } as Express.Multer.File;
}

describe('MlPictureService', () => {
  let http: { post: jest.Mock };
  let service: MlPictureService;

  beforeEach(() => {
    http = {
      post: jest.fn().mockResolvedValue({
        id: '123-MLB456_112021',
        variations: [
          {
            size: '1920x1076',
            url: 'http://http2.mlstatic.com/D_NQ_NP_123-F.jpg',
            secure_url: 'https://http2.mlstatic.com/D_NQ_NP_123-F.jpg',
          },
        ],
      }),
    };
    service = new MlPictureService(http as never);
  });

  it('repassa o arquivo em multipart e guarda o id devolvido pelo ML', async () => {
    const resultado = await service.enviarImagem(arquivo());

    const [rota, form] = http.post.mock.calls[0];
    expect(rota).toBe('/pictures/items/upload');
    // O binario vai como multipart, sem passar por disco nem hospedagem externa.
    expect(form.getHeaders()['content-type']).toMatch(/multipart\/form-data/);
    // O id e o que importa: e ele que vai para picture_ids do anuncio.
    expect(resultado.id).toBe('123-MLB456_112021');
    expect(resultado.url).toBe('https://http2.mlstatic.com/D_NQ_NP_123-F.jpg');
  });

  it('recusa webp, que a documentacao do ML nao lista', async () => {
    await expect(
      service.enviarImagem(arquivo({ mimetype: 'image/webp', originalname: 'foto.webp' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('recusa imagem acima do limite de 10MB do ML', async () => {
    await expect(
      service.enviarImagem(arquivo({ size: 11 * 1024 * 1024 })),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('devolve url nula quando a resposta vem sem variations', async () => {
    http.post.mockResolvedValue({ id: '123-MLB456_112021' });

    const resultado = await service.enviarImagem(arquivo());

    // Sem variations o id continua valendo -- e o unico campo indispensavel.
    expect(resultado.id).toBe('123-MLB456_112021');
    expect(resultado.url).toBeNull();
  });
});
