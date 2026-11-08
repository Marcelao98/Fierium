// As três versões do Selo de Fieri (M1.5). Cada função devolve um <svg> 200×200; `id` deixa os gradientes únicos.
// simples = versão pra 16 px (sem os detalhes finos).

// A · Centelha e lua: a proposta do IDENTIDADE.md.
function seloA(id, simples) {
  return `<svg viewBox="0 0 200 200"><defs><radialGradient id="b${id}"><stop offset="0" stop-color="#f4dca4" stop-opacity=".6"/><stop offset="1" stop-color="#f4dca4" stop-opacity="0"/></radialGradient><mask id="m${id}"><rect width="200" height="200"/><circle cx="100" cy="112" r="46" fill="#fff"/><circle cx="100" cy="94" r="44"/></mask></defs>${simples ? '' : `<path d="M158.5 51.5A78 78 0 1 1 100 22" fill="none" stroke="#b5afcb" stroke-width="5" stroke-linecap="round"/><circle cx="158.5" cy="51.5" r="7" fill="#b7a6ff"/>`}<circle cx="100" cy="112" r="46" fill="#e8c27a" mask="url(#m${id})"/>${simples ? '' : `<circle cx="100" cy="92" r="34" fill="url(#b${id})"/>`}<path d="M100 66C102 86 104 90 124 92C104 94 102 98 100 118C98 98 96 94 76 92C96 90 98 86 100 66Z" fill="${simples ? '#e8c27a' : '#fff6df'}"/></svg>`;
}

// B · Astrolábio: gravado em ouro, com as marcas de grau.
function seloB(id, simples, cor = '#e2b866', centelha = '#efe4c8') {
  const marcas = simples
    ? ''
    : Array.from({ length: 72 }, (_, i) => {
        const a = (i * 5 * Math.PI) / 180,
          L = i % 6 ? 84 : 77,
          f = (v) => v.toFixed(1);
        return `<line x1="${f(100 + Math.cos(a) * 90)}" y1="${f(100 + Math.sin(a) * 90)}" x2="${f(100 + Math.cos(a) * L)}" y2="${f(100 + Math.sin(a) * L)}" stroke-width="${i % 6 ? 0.9 : 1.6}" stroke-opacity=".75"/>`;
      }).join('');
  return `<svg viewBox="0 0 200 200" fill="none" stroke="${cor}" stroke-linecap="round"><circle cx="100" cy="100" r="90" stroke-width="${simples ? 8 : 1.4}" stroke-opacity="${simples ? 1 : 0.6}"/>${marcas}${simples ? '' : `<path d="M155 56A70 70 0 1 1 100 30" stroke-width="2.6"/><circle cx="155" cy="56" r="4.5" fill="${cor}"/><path d="M100 42v10M100 130v10M42 92h10M148 92h10" stroke-width="1.2"/>`}<path d="M58 108A42 42 0 0 0 142 108A44 44 0 0 1 58 108Z" fill="${cor}" stroke-width="1"/><path d="M100 58L105 86L128 92L105 98L100 124L95 98L72 92L95 86Z" fill="${simples ? cor : centelha}" stroke="none"/></svg>`;
}

// C · Lua que vira órbita: a crescente, e da ponta de cima sai a órbita fina, que não fecha (o vão é o vir-a-ser).
function seloC(id, simples) {
  const R = 70,
    r = 60,
    cx = 100,
    cy = 100,
    ox = 28; // crescente = círculo (R) menos círculo deslocado (r)
  const a = (R * R - r * r + ox * ox) / (2 * ox),
    h = Math.sqrt(R * R - a * a);
  const cima = [cx + a, cy - h],
    baixo = [cx + a, cy + h];
  const f = (p) => p.map((v) => v.toFixed(1)).join(' ');
  const lua = `M${f(cima)}A${R} ${R} 0 1 0 ${f(baixo)}A${r} ${r} 0 1 1 ${f(cima)}Z`;
  const ang1 = Math.atan2(baixo[1] - cy, baixo[0] - cx) - 0.62;
  const P = (t) => [cx + R * Math.cos(t), cy + R * Math.sin(t)];
  const fim = P(ang1);
  return `<svg viewBox="0 0 200 200" fill="none" stroke-linecap="round"><defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ff0c4"/><stop offset=".55" stop-color="#9ff6ff"/><stop offset="1" stop-color="#ff8fc8"/></linearGradient></defs><path d="${lua}" fill="url(#g${id})"/>${simples ? '' : `<path d="M${f(cima)}A${R} ${R} 0 0 1 ${f(fim)}" stroke="url(#g${id})" stroke-width="3.2" stroke-opacity=".8"/><circle cx="${fim[0].toFixed(1)}" cy="${fim[1].toFixed(1)}" r="6" fill="#ff8fc8"/>`}<path d="M116 64C119 87 123 92 144 96C123 100 119 105 116 128C113 105 109 100 88 96C109 92 113 87 116 64Z" fill="#f6e7b0"/></svg>`;
}

// as páginas (prototipo.html e selos.html) usam as três pelo escopo global
Object.assign(globalThis, { seloA, seloB, seloC });
