/**
 * Repositorio em memoria com a fatia da API do TypeORM que os servicos usam.
 * Suficiente para exercitar as regras de negocio sem subir Postgres.
 */
export class FakeRepository<T extends { id?: string }> {
  readonly linhas: T[] = [];
  private sequencia = 0;

  create(dados: Partial<T>): T {
    return { ...dados } as T;
  }

  async save(entidade: T | T[]): Promise<T | T[]> {
    const lista = Array.isArray(entidade) ? entidade : [entidade];
    for (const item of lista) {
      if (!item.id) {
        item.id = `id-${++this.sequencia}`;
      }
      const indice = this.linhas.findIndex((l) => l.id === item.id);
      if (indice >= 0) {
        this.linhas[indice] = item;
      } else {
        this.linhas.push(item);
      }
    }
    return entidade;
  }

  async find(): Promise<T[]> {
    return [...this.linhas];
  }

  async findOne(opcoes: {
    where?: Record<string, unknown>;
    order?: Record<string, 'ASC' | 'DESC'>;
  }): Promise<T | null> {
    const where = opcoes.where ?? {};
    const chaves = Object.keys(where);

    let candidatos = this.linhas.filter((linha) =>
      chaves.every((chave) => (linha as Record<string, unknown>)[chave] === where[chave]),
    );

    const ordenarPor = opcoes.order ? Object.keys(opcoes.order)[0] : undefined;
    if (ordenarPor) {
      const direcao = opcoes.order?.[ordenarPor] === 'ASC' ? 1 : -1;
      candidatos = [...candidatos].sort((a, b) => {
        const va = (a as Record<string, unknown>)[ordenarPor];
        const vb = (b as Record<string, unknown>)[ordenarPor];
        return va === vb ? 0 : ((va as number) > (vb as number) ? 1 : -1) * direcao;
      });
    }

    return candidatos[0] ?? null;
  }
}
