// Estatísticas a partir das sessões (a imitação do que o Rust vai calcular no M7). Regras herdadas do KOFlibrary:
// um dia conta na sequência com 5 min ou mais; hoje sem leitura ainda não quebra a sequência.
import type { DiaDeLeitura, Meta, Obra, ResumoEstatisticas, SituacaoMeta } from '@fierium/contratos';
import { chaveDia, diaInicio, type Sessao } from './dados-exemplo';

export const MIN_DIA = 300;
const DIA = 86_400_000;

export function diasDoAno(sessoes: Sessao[], agora: number): DiaDeLeitura[] {
  const porDia = new Map<string, DiaDeLeitura>();
  for (const s of sessoes) {
    const k = chaveDia(s.inicio);
    const d = porDia.get(k) ?? { dia: k, segundos: 0, paginas: 0 };
    d.segundos += s.segundos;
    d.paginas += s.paginas;
    porDia.set(k, d);
  }
  const hoje = diaInicio(agora);
  const r: DiaDeLeitura[] = [];
  for (let i = 364; i >= 0; i--) {
    const k = chaveDia(hoje - i * DIA + 12 * 3_600_000);
    r.push(porDia.get(k) ?? { dia: k, segundos: 0, paginas: 0 });
  }
  return r;
}

/** Dias seguidos até hoje (hoje sem leitura não quebra: conta a partir de ontem). */
export function sequencia(dias: DiaDeLeitura[]): number {
  let i = dias.length - 1;
  if (i >= 0 && dias[i]!.segundos < MIN_DIA) i--;
  let n = 0;
  for (; i >= 0 && dias[i]!.segundos >= MIN_DIA; i--) n++;
  return n;
}

export function recorde(dias: DiaDeLeitura[]): number {
  let melhor = 0;
  let atual = 0;
  for (const d of dias) {
    atual = d.segundos >= MIN_DIA ? atual + 1 : 0;
    melhor = Math.max(melhor, atual);
  }
  return melhor;
}

function inicioDoPeriodo(periodo: Meta['periodo'], agora: number): number {
  const d = new Date(agora);
  d.setHours(0, 0, 0, 0);
  if (periodo === 'semana') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // segunda-feira
  if (periodo === 'mes') d.setDate(1);
  if (periodo === 'ano') d.setMonth(0, 1);
  return d.getTime();
}

export function situacaoDasMetas(metas: Meta[], sessoes: Sessao[], obras: Obra[], agora: number): SituacaoMeta[] {
  return metas.map((meta) => {
    const ini = inicioDoPeriodo(meta.periodo, agora);
    const doPeriodo = sessoes.filter((s) => s.inicio >= ini && s.inicio <= agora);
    const feito =
      meta.tipo === 'livros'
        ? obras.filter((o) => (o.relacao.terminadaEm ?? 0) >= ini).length
        : meta.tipo === 'paginas'
          ? doPeriodo.reduce((a, s) => a + s.paginas, 0)
          : Math.floor(doPeriodo.reduce((a, s) => a + s.segundos, 0) / 60);
    return { meta, feito, fracao: Math.min(1, meta.alvo > 0 ? feito / meta.alvo : 0) };
  });
}

export function resumo(sessoes: Sessao[], obras: Obra[], metas: Meta[], agora: number): ResumoEstatisticas {
  const dias = diasDoAno(sessoes, agora);
  const somar = (desde: number) => {
    const ss = sessoes.filter((s) => s.inicio >= desde && s.inicio <= agora);
    return { segundos: ss.reduce((a, s) => a + s.segundos, 0), paginas: ss.reduce((a, s) => a + s.paginas, 0) };
  };
  const horas = new Array<number>(24).fill(0);
  for (const s of sessoes) horas[new Date(s.inicio).getHours()]! += s.segundos;
  const max = Math.max(...horas);
  const reinoDe = new Map(obras.map((o) => [o.id, o.reino]));
  const porReino = new Map<string, number>();
  for (const s of sessoes) {
    const r = reinoDe.get(s.obraId) ?? 'Outros';
    porReino.set(r, (porReino.get(r) ?? 0) + s.segundos);
  }
  return {
    hoje: somar(diaInicio(agora)),
    semana: somar(inicioDoPeriodo('semana', agora)),
    sequencia: sequencia(dias),
    recorde: recorde(dias),
    terminadasNoAno: obras.filter((o) => (o.relacao.terminadaEm ?? 0) >= inicioDoPeriodo('ano', agora)).length,
    dias,
    metas: situacaoDasMetas(metas, sessoes, obras, agora),
    horaFavorita: max > 0 ? horas.indexOf(max) : null,
    porReino: [...porReino].map(([reino, segundos]) => ({ reino, segundos })).sort((a, b) => b.segundos - a.segundos),
  };
}
