# Cartão m4/05-pintor · Temas que repintam a página (o Pintor)

**Estado:** a fazer
**Branch:** `agente/m4-05-pintor`, saindo de `marco/m4`
**Depende de:** 01 · **Destrava:** —

## Objetivo

Os temas do leitor (pergaminho, sépia, noite, tinta) repintam o PDF sem estragar as figuras: o texto ganha a cor do tema, as imagens continuam naturais; com brilho, contraste e luz quente.

## Leia antes

- `AGENTS.md`
- `packages/leitores/src/motor.ts` (a tomada `MotorDeLeitura`) e `packages/leitores/src/texto/` (o motor de exemplo)
- [docs/CONTRATOS.md](../../CONTRATOS.md) (`edicao.abrir` → `{tipo:'arquivo', url, tamanho}`)
- o Pintor do KOFlibrary só como ideia (não copie código): mapear o fundo branco pro papel do tema e o preto pra tinta, protegendo as regiões de imagem

## Pode mexer

- `packages/leitores/src/pdf/pintor/`
- controles de brilho/contraste/luz quente no painel de aparência

## Não mexa

- `packages/contratos/`, `pnpm-lock.yaml`, `Cargo.lock`, `packages/ui/src/tokens.css`, `docs/` (fora este cartão)
- o motor de texto

## Faça

1. Repintura por shader (WebGL) ou filtro de canvas, com as regiões de imagem do pdf.js preservadas.
2. Brilho, contraste e luz quente como ajustes contínuos; tudo desligável.

## Pronto quando

- [ ] Prints do mesmo PDF gerado (texto + foto) em cada tema: o texto muda, a foto não
- [ ] Repintar não passa de 8 ms por página (relatório)
- [ ] `pnpm check` passa (+ `pnpm e2e` se mexeu em tela)

## Relatório (o executor preenche)

- **Quem / quando:**
- **Feito:**
- **Arquivos:** (`git diff --stat`)
- **Portões:**
- **Prints:**
- **Dúvidas / o que ficou de fora:**
