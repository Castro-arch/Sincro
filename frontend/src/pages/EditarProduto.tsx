import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Listing } from '@/api/listings';
import { ErroDePublicacao } from '@/components/cadastro/ErroDePublicacao';
import { PassoAtributos } from '@/components/cadastro/PassoAtributos';
import { PassoCategoria } from '@/components/cadastro/PassoCategoria';
import { PassoImagens } from '@/components/cadastro/PassoImagens';
import { PassoVariacoes } from '@/components/cadastro/PassoVariacoes';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { AreaTexto, Campo, Entrada } from '@/components/ui/Campo';
import { useAnuncio, useAtualizarProduto, useValidarNoMl } from '@/hooks/useEdicaoProduto';
import { useFormularioProduto } from '@/hooks/useFormularioProduto';
import { lerErroMl, somenteAvisosDeEnvio } from '@/lib/erroMl';

export function EditarProduto() {
  const { listingId } = useParams<{ listingId: string }>();
  const { data: anuncio, isLoading, isError, error } = useAnuncio(listingId);

  if (isLoading) {
    return (
      <AppShell>
        <p className="p-6 text-sm text-ink-soft">Carregando anúncio…</p>
      </AppShell>
    );
  }

  if (isError || !anuncio) {
    return (
      <AppShell>
        <p className="p-6 text-sm text-danger-ink">
          Não deu pra carregar o anúncio: {(error as Error)?.message ?? 'não encontrado'}
        </p>
      </AppShell>
    );
  }

  // `key` força um formulário novo quando o anúncio muda: o hook lê o estado
  // inicial uma vez só.
  return <Formulario key={anuncio.id} anuncio={anuncio} />;
}

function Formulario({ anuncio }: { anuncio: Listing }) {
  const navigate = useNavigate();
  const form = useFormularioProduto(anuncio);
  const atualizar = useAtualizarProduto();
  const validar = useValidarNoMl();

  const publicado = Boolean(anuncio.mlItemId);
  const faltando = form.faltando(false);
  const resultado = validar.data;
  const causas = resultado?.erro ? lerErroMl(resultado.erro) : null;

  /** Mesmo payload para salvar e para validar -- uma fonte, sem divergir. */
  function montarDados() {
    return {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || undefined,
      custoUnitario: form.custoUnitario.trim() === '' ? null : Number(form.custoUnitario),
      titulo: form.titulo.trim(),
      // Categoria só viaja em rascunho; o backend recusa com 409 se publicado.
      categoriaId: publicado ? undefined : form.categoria?.category_id,
      atributos: form.atributosParaEnvio(),
      pictureIds: form.imagens.map((i) => i.id),
      variacoes: form.montarVariacoes().map((v, i) => ({
        variationId: anuncio.variations?.[i]?.id,
        sku: v.sku,
        atributos: publicado ? undefined : v.atributos,
        preco: v.preco,
        estoque: v.estoque,
      })),
    };
  }

  async function salvar() {
    await atualizar.mutateAsync({ listingId: anuncio.id, dados: montarDados() });
    navigate('/anuncios');
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Editar produto</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {publicado
              ? 'Anúncio publicado: título, atributos, imagens, preço e estoque são reenviados ao Mercado Livre ao salvar. Categoria e combinações de variação não podem mudar — para isso é preciso encerrar e cadastrar outro.'
              : 'Rascunho: tudo é editável, inclusive categoria e variações. Nada foi enviado ao Mercado Livre ainda.'}
          </p>
        </div>

        {anuncio.ultimoErro && <ErroDePublicacao bruto={anuncio.ultimoErro} />}

        <section className="cartao flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-ink">1. Identificação</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Nome interno">
              <Entrada value={form.nome} onChange={(e) => form.setNome(e.target.value)} />
            </Campo>
            <Campo
              label="Custo de aquisição (R$ por unidade)"
              dica="Alimenta o relatório de Margem. Sem isso, o lucro aparece superestimado."
            >
              <Entrada
                type="number"
                min="0"
                step="0.01"
                value={form.custoUnitario}
                onChange={(e) => form.setCustoUnitario(e.target.value)}
                placeholder="não informado"
              />
            </Campo>
          </div>
          <Campo label="Título do anúncio">
            <Entrada
              value={form.titulo}
              maxLength={200}
              onChange={(e) => form.setTitulo(e.target.value)}
            />
          </Campo>
          <Campo label="Descrição">
            <AreaTexto value={form.descricao} onChange={(e) => form.setDescricao(e.target.value)} />
          </Campo>
        </section>

        {publicado ? (
          <section className="cartao p-5">
            <h2 className="text-sm font-semibold text-ink">2. Categoria</h2>
            <p className="mt-1 text-sm text-ink-soft">
              <span className="font-mono">{anuncio.categoriaId}</span> — fixa neste anúncio. O
              Mercado Livre recusa alterar categoria de item publicado (
              <span className="font-mono">item.category_id.not_modifiable</span>).
            </p>
          </section>
        ) : (
          <PassoCategoria
            titulo={form.titulo}
            categoriaId={form.categoria?.category_id ?? null}
            categoriaNome={form.categoria?.category_name ?? null}
            onEscolher={form.escolherCategoria}
          />
        )}

        <PassoAtributos
          categoriaId={form.categoria?.category_id ?? null}
          valores={form.atributos}
          eixosDeVariacao={form.eixos}
          onMudar={(id, valor) => form.setAtributos((prev) => ({ ...prev, [id]: valor }))}
        />

        <PassoImagens imagens={form.imagens} onMudar={form.setImagens} />

        <PassoVariacoes
          categoriaId={form.categoria?.category_id ?? null}
          eixos={form.eixos}
          variacoes={form.variacoes}
          onMudarEixos={form.setEixos}
          onMudarVariacoes={form.setVariacoes}
        />

        {atualizar.isError && (
          <p className="border border-danger bg-danger-tint px-5 py-3 text-sm text-danger-ink">
            {(atualizar.error as Error).message}
          </p>
        )}

        {resultado?.valido && (
          <p className="border border-success bg-success-tint px-5 py-3 text-sm text-success-ink">
            <strong>O Mercado Livre aceitaria este anúncio.</strong> Pode publicar pela lista de
            anúncios.
          </p>
        )}

        {resultado && !resultado.valido && causas && (
          <div className="border border-warning bg-warning-tint px-5 py-3 text-sm text-warning-ink">
            <strong>
              {somenteAvisosDeEnvio(causas)
                ? 'Só restam pendências de Mercado Envios'
                : `Ainda não passaria: ${causas.resumo}`}
            </strong>
            {causas.causas.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {/* índice na key: o ML repete a mesma causa em respostas distintas */}
                {causas.causas.map((c, i) => (
                  <li key={`${i}-${c}`}>{c}</li>
                ))}
              </ul>
            )}
            {somenteAvisosDeEnvio(causas) && (
              <p className="mt-2 text-ink-soft">
                Isso é configuração da conta, não do anúncio. O validador é mais rigoroso que a
                publicação: um anúncio já foi publicado com esses mesmos avisos, então vale tentar
                publicar mesmo assim.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <Button
            disabled={faltando.length > 0 || atualizar.isPending}
            onClick={() => void salvar()}
          >
            {atualizar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button
            variant="secondary"
            disabled={validar.isPending}
            onClick={() => validar.mutate({ listingId: anuncio.id, rascunho: montarDados() })}
          >
            {validar.isPending ? 'Validando…' : 'Validar no ML'}
          </Button>
          <Link
            to="/anuncios"
            className="text-sm text-blue-ink underline decoration-1 underline-offset-2"
          >
            cancelar
          </Link>
          {faltando.length > 0 && (
            <span className="text-xs text-ink-faint">Falta preencher: {faltando.join(', ')}.</span>
          )}
        </div>
      </div>
    </AppShell>
  );
}
