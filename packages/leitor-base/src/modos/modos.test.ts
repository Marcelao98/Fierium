import { describe, expect, it, vi } from 'vitest';
import type { Capacidades, Faixa, Linha, SessaoLeitura } from '../motor';
import { modoAutomatico } from './automatico';
import { duracaoDaLinha, modoGuiado, palavrasDe } from './guiado';
import { MODOS, modoPorId } from './index';
import { modoDisponivel, type Agenda } from './tipos';

/** relógio manual: cada `passo(ms)` é um quadro */
function relogio() {
  let pendente: ((t: number) => void) | null = null;
  let agora = 1000;
  const agenda: Agenda = {
    quadro(f) {
      pendente = f;
      return () => {
        if (pendente === f) pendente = null;
      };
    },
  };
  return {
    agenda,
    rodando: () => pendente !== null,
    /** anda `ms` em quadros de 16 ms */
    andar(ms: number) {
      for (let t = 0; t < ms; t += 16) {
        agora += 16;
        const f = pendente;
        pendente = null;
        f?.(agora);
      }
    },
  };
}

const TUDO: Capacidades = { paginar: true, linhas: true, rolar: true, destacar: true };

/** uma sessão falsa: 20 linhas de 20 px numa área de 200 px; `scroll` é o quanto já rolou */
function sessaoFalsa(opcoes: { linhas?: number; total?: number; capitulos?: number } = {}) {
  const n = opcoes.linhas ?? 20;
  const area = { x: 0, y: 100, largura: 400, altura: 200 };
  const total = opcoes.total ?? n * 20 - 200;
  let scroll = 0;
  let capitulo = 1;
  const rolagens: number[] = [];
  let aoInteragir: (() => void) | null = null;
  const faixas: (Faixa | null)[] = [];
  const todas = (): Linha[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `l${i}`,
      texto: 'um dois tres quatro cinco seis sete oito nove dez', // 10 palavras
      caixa: { x: 10, y: area.y + i * 20 - scroll, largura: 300, altura: 18 },
    }));
  const s: SessaoLeitura = {
    capacidades: TUDO,
    linhas: () =>
      todas().filter(
        (l) => l.caixa.y + l.caixa.altura / 2 >= area.y && l.caixa.y + l.caixa.altura / 2 <= area.y + area.altura,
      ),
    rolarPor(px) {
      rolagens.push(px);
      scroll = Math.max(0, Math.min(total, scroll + px));
    },
    rolagem: () => ({ atual: scroll, total, area }),
    paginar: vi.fn(() => {
      capitulo++;
      scroll = 0;
    }),
    paginaAtual: () => ({ atual: capitulo, total: opcoes.capitulos ?? 1 }),
    destacarTrecho: (f) => void faixas.push(f),
    aoInteragir(o) {
      aoInteragir = o;
      return () => {
        aoInteragir = null;
      };
    },
    aplicarAparencia: () => undefined,
    mostrarMarcacoes: () => undefined,
    irPara: () => undefined,
    limparSelecao: () => undefined,
    desmontar: () => undefined,
  };
  return {
    s,
    rolagens,
    faixas,
    scroll: () => scroll,
    capitulo: () => capitulo,
    tocar: () => aoInteragir?.(),
    temOuvinte: () => aoInteragir !== null,
  };
}

describe('modos de leitura', () => {
  it('lista os três modos e confere as peças que a sessão declara', () => {
    expect(MODOS.map((m) => m.id)).toEqual(['rolagem', 'automatico', 'guiado']);
    expect(modoPorId('guiado').rotulo).toBe('Guiado');
    expect(modoDisponivel(modoAutomatico, TUDO)).toBe(true);
    expect(modoDisponivel(modoGuiado, { ...TUDO, linhas: false })).toBe(false);
    expect(modoDisponivel(modoGuiado, undefined)).toBe(false);
    expect(modoDisponivel(MODOS[0]!, undefined)).toBe(true);
  });

  describe('Automático', () => {
    it('rola na velocidade pedida, mesmo com menos de 1 px por quadro', () => {
      const r = relogio();
      const f = sessaoFalsa();
      const m = modoAutomatico.iniciar(f.s, { velocidade: 30, agenda: r.agenda });
      r.andar(2000);
      expect(f.scroll()).toBeGreaterThan(55);
      expect(f.scroll()).toBeLessThan(65); // 30 px/s * 2 s
      expect(f.rolagens.every((p) => Number.isInteger(p))).toBe(true);
      m.definirVelocidade(60);
      const antes = f.scroll();
      r.andar(1000);
      expect(f.scroll() - antes).toBeGreaterThan(55);
      m.parar();
      expect(r.rodando()).toBe(false);
    });

    it('pausa quando a pessoa mexe e retoma quando pedido', () => {
      const r = relogio();
      const f = sessaoFalsa();
      const avisos: string[] = [];
      const m = modoAutomatico.iniciar(f.s, { velocidade: 60, agenda: r.agenda, aoMudar: (e) => avisos.push(e) });
      r.andar(500);
      f.tocar();
      expect(m.estado()).toBe('pausado');
      const parado = f.scroll();
      r.andar(500);
      expect(f.scroll()).toBe(parado);
      m.retomar();
      r.andar(500);
      expect(f.scroll()).toBeGreaterThan(parado);
      expect(avisos).toEqual(['pausado', 'rodando']);
      m.parar();
      expect(f.temOuvinte()).toBe(false);
    });

    it('no fim do livro para; no fim do capítulo vira o capítulo', () => {
      const r = relogio();
      const um = sessaoFalsa({ total: 100 });
      const m1 = modoAutomatico.iniciar(um.s, { velocidade: 300, agenda: r.agenda });
      r.andar(2000);
      expect(m1.estado()).toBe('fim');
      expect(r.rodando()).toBe(false);

      const r2 = relogio();
      const tres = sessaoFalsa({ total: 100, capitulos: 3 });
      const m2 = modoAutomatico.iniciar(tres.s, { velocidade: 300, agenda: r2.agenda });
      r2.andar(1500);
      expect(tres.capitulo()).toBeGreaterThan(1);
      m2.parar();
    });
  });

  describe('Guiado', () => {
    it('conta palavras e dá a duração pelo ritmo', () => {
      expect(palavrasDe('  a  b\nc ')).toBe(3);
      const l: Linha = {
        id: 'x',
        texto: 'um dois tres quatro cinco seis sete oito nove dez',
        caixa: { x: 0, y: 0, largura: 1, altura: 1 },
      };
      expect(duracaoDaLinha(l, 300)).toBeCloseTo(2, 5); // 10 palavras a 300/min
      expect(duracaoDaLinha(l, 600)).toBeCloseTo(1, 5);
      expect(duracaoDaLinha({ ...l, texto: 'a' }, 600)).toBe(0.4);
    });

    it('destaca a primeira linha e desce no ritmo (palavras por minuto)', () => {
      const r = relogio();
      const f = sessaoFalsa();
      const m = modoGuiado.iniciar(f.s, { velocidade: 300, agenda: r.agenda }); // 2 s por linha
      r.andar(100);
      expect(f.faixas.at(-1)?.caixa.y).toBe(100); // l0
      r.andar(2100);
      expect(f.faixas.at(-1)?.caixa.y).toBe(120); // l1
      r.andar(2100);
      expect(f.faixas.at(-1)?.caixa.y).toBe(140); // l2
      m.definirVelocidade(600); // 1 s por linha
      r.andar(1100);
      expect(f.faixas.at(-1)?.caixa.y).toBe(160);
      m.parar();
      expect(f.faixas.at(-1)).toBeNull();
    });

    it('desce a tela quando a linha passa da parte de baixo e segue até o fim', () => {
      const r = relogio();
      const f = sessaoFalsa({ linhas: 30 });
      const m = modoGuiado.iniciar(f.s, { velocidade: 600, agenda: r.agenda });
      r.andar(14_000); // 14 linhas de 1 s: passa da área de 200 px (10 linhas) e rola
      expect(f.scroll()).toBeGreaterThan(0);
      const ultima = f.faixas.at(-1)!;
      expect(ultima.caixa.y).toBeGreaterThanOrEqual(100);
      expect(ultima.caixa.y).toBeLessThanOrEqual(300);
      r.andar(60_000);
      expect(m.estado()).toBe('fim');
      expect(f.faixas.at(-1)).toBeNull();
    });

    it('pausa ao rolar à mão e retoma da linha de cima se a atual saiu da tela', () => {
      const r = relogio();
      const f = sessaoFalsa({ linhas: 30 });
      const m = modoGuiado.iniciar(f.s, { velocidade: 600, agenda: r.agenda });
      r.andar(2200);
      f.tocar();
      expect(m.estado()).toBe('pausado');
      f.s.rolarPor!(200); // a pessoa rolou à mão: l2 saiu da tela
      m.retomar();
      r.andar(100);
      expect(f.faixas.at(-1)?.caixa.y).toBe(100); // recomeçou da linha do alto
      m.parar();
    });

    it('sem texto nenhum, dá fim em vez de esperar pra sempre', () => {
      const r = relogio();
      const f = sessaoFalsa({ linhas: 0 });
      const m = modoGuiado.iniciar(f.s, { velocidade: 300, agenda: r.agenda });
      r.andar(5000);
      expect(m.estado()).toBe('fim');
    });
  });
});
