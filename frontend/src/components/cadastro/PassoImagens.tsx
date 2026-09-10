import { useRef, useState } from 'react'
import type { ImagemEnviada } from '@/api/pictures'
import { FORMATOS_ACEITOS, TAMANHO_MAXIMO_BYTES } from '@/api/pictures'
import { Button } from '@/components/ui/Button'
import { useUploadImagem } from '@/hooks/useUploadImagem'

export function PassoImagens({
  imagens,
  onMudar,
}: {
  imagens: ImagemEnviada[]
  onMudar: (imagens: ImagemEnviada[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [recusado, setRecusado] = useState<string | null>(null)
  const upload = useUploadImagem()

  async function selecionar(arquivos: FileList | null) {
    if (!arquivos?.length) return
    setRecusado(null)

    const enviadas: ImagemEnviada[] = []
    for (const arquivo of Array.from(arquivos)) {
      // Recusa aqui o que o ML recusaria depois: o erro dele chegaria só na
      // publicação, longe do momento em que o arquivo foi escolhido.
      if (!FORMATOS_ACEITOS.includes(arquivo.type)) {
        setRecusado(`"${arquivo.name}": o ML aceita apenas JPG, JPEG e PNG.`)
        continue
      }
      if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
        setRecusado(`"${arquivo.name}" passa de 10MB, o limite do ML.`)
        continue
      }
      // Sequencial de propósito, para não disparar várias chamadas ao ML.
      enviadas.push(await upload.mutateAsync(arquivo))
    }

    if (enviadas.length) onMudar([...imagens, ...enviadas])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section className="flex flex-col gap-4 cartao p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">4. Imagens</h2>
        <p className="mt-1 text-xs text-ink-faint">
          O arquivo vai direto para o Mercado Livre — o Sincro só repassa e guarda o id. Mínimo de
          500x500 px; toda variação precisa de ao menos uma imagem (herda as do anúncio se não
          tiver a sua).
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={FORMATOS_ACEITOS.join(',')}
        multiple
        hidden
        onChange={(e) => void selecionar(e.target.files)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? 'Enviando…' : 'Escolher imagens'}
        </Button>
        <span className="font-mono text-xs text-ink-faint">
          {imagens.length} enviada(s)
        </span>
      </div>

      {recusado && <p className="text-xs text-warning-ink">{recusado}</p>}
      {upload.isError && <p className="text-xs text-danger-ink">{(upload.error as Error).message}</p>}

      {imagens.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {imagens.map((img) => (
            <li key={img.id} className="flex flex-col gap-1.5">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-sm bg-surface-raised">
                {img.url ? (
                  <img src={img.url} alt={img.nomeArquivo} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-mono text-xs text-ink-faint">sem prévia</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onMudar(imagens.filter((i) => i.id !== img.id))}
                className="text-xs text-blue-ink underline decoration-1 underline-offset-2"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
