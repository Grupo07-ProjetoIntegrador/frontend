
# Frontend React/Vite

Este diretório contém o frontend da aplicação, feito em React + Vite.

## O que fica aqui

* Código do frontend
* [frontend/frontend/Prototipo-main/package.json](package.json)
* [frontend/frontend/Prototipo-main/package-lock.json](package-lock.json)
* [frontend/frontend/Prototipo-main/.env.example](.env.example)
* `node_modules/`, gerado quando você instala as dependências desta pasta

## Sobre `node_modules`

`node_modules` é a pasta onde o npm instala as dependências do frontend. Ela deve ficar dentro desta subárea, não na raiz do repositório, se o comando `npm install` for executado aqui dentro.

## Sobre `package.json` e `package-lock.json`

* `package.json` descreve os scripts e dependências do frontend.
* `package-lock.json` trava as versões instaladas para manter consistência entre máquinas.

Se aparecer um `package.json` na raiz do repositório, ele não faz parte do frontend deste diretório e normalmente indica que algum comando foi executado na pasta errada ou que sobrou um manifesto antigo.

## Configuração

1. Copie [frontend/frontend/Prototipo-main/.env.example](.env.example) para [frontend/frontend/Prototipo-main/.env](.env).
2. Preencha as variáveis com as chaves do seu projeto Supabase.

### Variáveis usadas

* `VITE_SUPABASE_URL`
* `VITE_SUPABASE_ANON_KEY`

## Instalar dependências

```bash
npm install
```

## Rodar localmente

```bash
npm run dev
```

## Observações para GitHub

Não envie para o repositório:

* `node_modules/`
* `.env`

O arquivo [frontend/frontend/Prototipo-main/.env.example](.env.example) deve ficar versionado para orientar outras máquinas.
  