# Chave de atualização do Fierium (passo a passo)

O Fierium se atualiza sozinho: quando você publica uma Release nova, os apps abertos avisam "Versão X disponível —
Atualizar e reiniciar". Pra isso o instalador precisa ser **assinado** (decisão D11): só quem tem a chave privada
consegue publicar uma atualização que os apps aceitam. Isso é diferente do certificado pago do Windows (o aviso do
SmartScreen continua; veja `docs/INSTALAR.md`).

A chave tem duas metades:

- **privada**: nunca entra no repositório; fica só nos Secrets do GitHub (e uma cópia sua, guardada com carinho);
- **pública**: pode ficar no repositório (vai em `tauri.conf.json`).

Se a pública continuar `COLOQUE_AQUI_A_CHAVE_PUBLICA`, o atualizador fica desligado (o app funciona normal e o log
diz "atualização automática desligada").

## 1. Gerar o par (uma vez só, no seu computador)

```
pnpm tauri signer generate -w ~/.tauri/fierium.key
```

Ele pede uma senha (pode ser curta, mas anote). Cria dois arquivos: `~/.tauri/fierium.key` (**privada**) e
`~/.tauri/fierium.key.pub` (**pública**).

## 2. Guardar a privada nos Secrets do GitHub

No repositório `Marcelao98/Fierium`: **Settings → Secrets and variables → Actions → New repository secret**.

| Nome                                 | Valor                                           |
| ------------------------------------ | ----------------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | o conteúdo inteiro de `~/.tauri/fierium.key`    |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | a senha que você digitou                        |

Dica: `cat ~/.tauri/fierium.key` e copie tudo. **Nunca** cole a privada em chat, issue ou arquivo do repositório.

## 3. Colar a pública na configuração

Abra `crates/fierium-app/tauri.conf.json`, ache `plugins.updater.pubkey` e troque `COLOQUE_AQUI_A_CHAVE_PUBLICA`
pelo conteúdo de `~/.tauri/fierium.key.pub` (uma linha só). Faça commit.

## 4. Publicar uma versão

1. Suba o número da versão (`Cargo.toml`, `crates/fierium-app/tauri.conf.json`, `apps/app/package.json`) e escreva
   o `CHANGELOG.md`.
2. Crie e envie a tag: `git tag v0.5.0 && git push origin v0.5.0` (ou rode o workflow **Lançamento** à mão em
   Actions).
3. Espere o workflow terminar (Windows e Linux). Ele cria um **rascunho** de Release com os instaladores e o
   `latest.json`.
4. Abra o rascunho em Releases, confira os arquivos e clique em **Publish release**. A partir daí os apps instalados
   encontram a atualização (o endereço é `releases/latest/download/latest.json`, então só a Release publicada mais
   nova conta).

## Se perder a chave privada

Ninguém consegue publicar atualização que os apps antigos aceitem. Gere um par novo, troque a pública, e os amigos
precisam reinstalar uma vez à mão. Por isso, guarde uma cópia da privada num gerenciador de senhas.

## Build local com instalador

`createUpdaterArtifacts` está ligado, então `pnpm tauri build` pede a chave:
`TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/fierium.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD=... pnpm tauri build`.
O executável direto (`cargo build --release -p fierium-app --features tauri/custom-protocol`) não precisa de chave.
