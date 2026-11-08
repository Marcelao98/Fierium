// A montagem do céu do mapa, sem tela: cada área é uma região num círculo; dentro dela, as obras se espalham pelo
// ângulo de ouro (não amontoam), ordenadas por autor e título (o mesmo acervo dá sempre o mesmo céu). Obras do mesmo
// autor (ou da mesma série, em ordem de volume) ficam ligadas por um fio.
import type { Obra } from '@fierium/contratos';

const autorDe = (o: Obra) => o.criadores[0]?.nome ?? '';
/** o que liga as obras por um fio: a série (em ordem de volume) ou, sem série, o autor */
const fioDe = (o: Obra) => (o.serie ? `serie:${o.serie.nome}` : `autor:${autorDe(o)}`);

export interface Luz {
  obra: Obra;
  x: number;
  y: number;
  r: number;
}

export function montarCeu(obras: Obra[]) {
  const porArea = new Map<string, Obra[]>();
  for (const o of obras) porArea.set(o.reino, [...(porArea.get(o.reino) ?? []), o]);
  const areas = [...porArea.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const luzes: Luz[] = [];
  const regioes: { nome: string; x: number; y: number; raio: number }[] = [];
  const fios: [Luz, Luz][] = [];
  areas.forEach((area, i) => {
    const ang = (i / areas.length) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(ang) * 360;
    const cy = Math.sin(ang) * 300;
    const lista = [...porArea.get(area)!].sort(
      (a, b) =>
        fioDe(a).localeCompare(fioDe(b), 'pt-BR') ||
        (a.serie?.volume ?? 0) - (b.serie?.volume ?? 0) ||
        a.titulo.localeCompare(b.titulo, 'pt-BR'),
    );
    let raio = 40;
    const daqui: Luz[] = lista.map((o, k) => {
      const d = 26 * Math.sqrt(k + 0.6);
      const a = k * 2.39996; // ângulo de ouro: espalha sem amontoar
      raio = Math.max(raio, d + 30);
      return {
        obra: o,
        x: cx + Math.cos(a) * d,
        y: cy + Math.sin(a) * d,
        r: 2.4 + Math.min(4, (o.edicoes[0]?.paginas ?? 200) / 220),
      };
    });
    for (let k = 1; k < daqui.length; k++)
      if (fioDe(daqui[k]!.obra) === fioDe(daqui[k - 1]!.obra)) fios.push([daqui[k - 1]!, daqui[k]!]);
    luzes.push(...daqui);
    regioes.push({ nome: area, x: cx, y: cy, raio });
  });
  return { luzes, regioes, fios };
}
