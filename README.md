# Agenda Espaco do Pensar

Agenda web temporaria para cadastro de atendimentos por paciente, psicologa, horario e sala.

## Arquivos

- `index.html`, `styles.css`, `app.js`: site estatico para GitHub Pages.
- `config.js`: URL do Google Apps Script publicado.
- `apps-script/Code.gs`: backend temporario que grava na aba `Agendamentos` da planilha Google.
- `assets/logo-espaco-do-pensar.jpeg`: logo usado no cabecalho da agenda.

## Interface

- Cores baseadas no logo da clinica: azul, ciano, roxo e magenta.
- Visual de agenda com navegacao por dia, semana, mes e salas.
- Filtro rapido por sala.
- Grade diaria com marcacoes de 1 em 1 hora.

## Compatibilidade temporaria

O frontend tambem consegue ler a implantacao antiga do Apps Script que retorna apenas `Data`, `Hora`, `Paciente` e `Sala`. Nesse modo, a tela mostra `Planilha legado` e campos como psicologa, termino real e observacoes ficam limitados ate o backend novo ser implantado.

## Configurar Google Apps Script

1. Abra a planilha: `https://docs.google.com/spreadsheets/d/1k9eaBYaArmcPfi38HaYY48FXbPkCeKy7FVKyP3m-N-Q/edit`.
2. Acesse `Extensoes > Apps Script`.
3. Cole o conteudo de `apps-script/Code.gs` no arquivo `Code.gs`.
4. Opcional, mas recomendado: em `Project Settings > Script properties`, crie `ACCESS_KEY` com uma chave combinada com as psicologas.
5. Execute a funcao `setup` uma vez e autorize o acesso. Se a aba ainda estiver no formato antigo `Data`, `Hora`, `Paciente`, `Sala`, o script migra para o formato novo automaticamente.
6. Clique em `Deploy > New deployment > Web app`.
7. Use `Execute as: Me` e `Who has access: Anyone with the link`.
8. Copie a URL final que termina em `/exec`.
9. Cole essa URL em `config.js`, no campo `apiUrl`.

## Publicar no GitHub Pages

1. Envie estes arquivos para um repositorio GitHub.
2. No repositorio, abra `Settings > Pages`.
3. Escolha a branch principal e a pasta raiz.
4. Salve e acesse a URL publicada pelo GitHub Pages.

## Observacao de privacidade

Esta versao e temporaria. Evite registrar CPF, diagnosticos, laudos ou detalhes clinicos nas observacoes. Para uso permanente com dados de saude, o ideal e autenticar usuarios, auditar acessos e usar banco de dados com regras de permissao.
