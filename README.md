# Calculador ACV Frontend

Calculador ACV

Esse projeto está preconfigurado com os WebComponentes do projeto de design system do GOV (DS-GOV).
Links de referência do Design System:
- [Projeto DS-GOV](https://www.gov.br/ds/home)
- [StoryBook](https://webcomponent-ds.estaleiro.serpro.gov.br/?path=/story/introdu%C3%A7%C3%A3o--page)
- [GovBR-DS Wiki](https://govbr-ds.gitlab.io/tools/govbr-ds-wiki/)

## ⚙️ Setup
Antes de rodar o projeto você deve executar o comando localmente para configurar o nexus

```
npm config set registry https://nexus.ext.serpro.gov.br/repository/sub-13698-npm-public/
npm config set "//nexus.ext.serpro.gov.br/repository/:_authToken=<npm_token>
```

## 💻 Executando em desenvolvimento

Para iniciar um servidor de desenvolvimento local, execute:

```bash
npm start
```

Uma vez que o servidor esteja em execução, abra seu navegador e navegue para `http://localhost:4200/`. A aplicação será recarregada automaticamente sempre que você modificar qualquer um dos arquivos fonte.

## ⚒️ Criação de código

Para gerar um novo componente, execute:

```bash
ng generate component component-name
```

Para uma lista completa de esquemas disponíveis (como `components`, `directives` ou `pipes`), execute:

```bash
ng generate --help
```

## 🚀 Build

Para *buildar* o projeto, execute:

```bash
ng build
```

Isso irá compilar seu projeto e armazenar os artefatos de construção no diretório `dist/`. Por padrão, a construção para produção otimiza sua aplicação para desempenho e velocidade.

## 🧪 Executando testes unitários

Para executar testes unitários com o [Karma](https://karma-runner.github.io), use o seguinte comando:

```bash
ng test
```

___
*Gerado usando o [Angular CLI](https://github.com/angular/angular-cli) versão 19.2.6.*