# M4 · ondas e cartões

Branch do marco: `marco/m4` (a partir do M3 aprovado).

## Onda 0 (🧭 orquestrador)

- [ ] Criar `marco/m4`
- [ ] Dependência `pdfjs-dist` (versão fixa) em `packages/leitores`, com o worker e os wasm empacotados (nada de CDN)
- [ ] `edicao.abrir` devolvendo `{tipo:'arquivo', formato:'pdf', url:'fierium://arquivo/<id>', tamanho}` no Rust
- [ ] Decidir se `SessaoLeitura` ganha `sumario()`/`buscar()` agora (o cartão 03 depende)
- [ ] Gerador de PDF de teste (o do M3, cartão 07) com opção de PDF escaneado (JPEG 2000/JBIG2)

## Ondas

| Onda | Cartões |
|---|---|
| 1 | [01 motor de PDF aos pedaços](01-motor-pdf.md) |
| 2 | [02 zoom e página dupla](02-zoom-pagina-dupla.md) · [03 sumário e busca](03-sumario-busca.md) · [05 Pintor](05-pintor.md) · [07 escaneados e medição](07-escaneados-e-medicao.md) · [08 capas](08-capa-pdf.md) |
| 3 | [04 cortar margens](04-cortar-margens.md) · [06 posição exata](06-posicao-exata.md) (dependem do zoom) |
| 4 🧭 | integração, prints, pacote Linux, **CP4** |

O motor (01) é o gargalo: só ele na onda 1. Os cartões 02, 04 e 06 mexem no layout do motor: o orquestrador confere
os conflitos ao juntar (ou roda 02 → 04 → 06 em fila se preferir segurança).
