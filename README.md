# Agenda Espaco do Pensar

Agenda web para cadastro e organizacao de atendimentos por paciente, profissional, horario e sala.

## Arquivos

- `index.html`, `styles.css`, `app.js`: site estatico para GitHub Pages.
- `config.js`: URL do Google Apps Script publicado.
- `apps-script/Code.gs`: backend Google Apps Script que grava na aba `Agendamentos` da planilha Google.
- `assets/logo-espaco-do-pensar.jpeg`: logo usado no cabecalho da agenda.

## Interface

- Cores baseadas no logo da clinica: azul, ciano, roxo e magenta.
- Visual de agenda com navegacao por dia, semana, mes e salas.
- Filtro rapido por sala e profissional.
- Sugestoes de paciente e profissional com lista unica e ordenada, sem bloquear novos nomes.
- Sala sempre selecionada de lista fechada: PM - Sala 4, PM - Sala 3, PM - Sala 1 e MF - Sala 2.
- Grade diaria com marcacoes de 1 em 1 hora.
- Cadastro e edicao em painel contextual no desktop e painel inferior no mobile.
- Arrastar e soltar no desktop para reagendar por sala, dia ou semana.

## Compatibilidade com planilha antiga

O frontend tambem consegue ler a implantacao antiga do Apps Script que retorna apenas `Data`, `Hora`, `Paciente` e `Sala`. Nesse modo, a tela mostra `Planilha legado` e campos como profissional, termino real e observacoes ficam limitados ate o backend novo ser implantado.

## Cache do GitHub Pages

O `index.html` carrega `styles.css?v=3`, `directory.js?v=1` e `app.js?v=3` para forcar o navegador a buscar a versao atual dos assets apos mudancas visuais ou de comportamento. Ao publicar uma alteracao relevante em CSS ou JavaScript, incremente esse numero.

## Configurar Google Apps Script

1. Abra a planilha: `https://docs.google.com/spreadsheets/d/1k9eaBYaArmcPfi38HaYY48FXbPkCeKy7FVKyP3m-N-Q/edit`.
2. Acesse `Extensoes > Apps Script`.
3. Cole o conteudo de `apps-script/Code.gs` no arquivo `Code.gs`.
4. Opcional, mas recomendado: em `Project Settings > Script properties`, crie `ACCESS_KEY` com uma chave combinada com a equipe.
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

Evite registrar CPF, diagnosticos, laudos ou detalhes clinicos nas observacoes. Para uso permanente com dados de saude, o ideal e autenticar usuarios, auditar acessos e usar banco de dados com regras de permissao.
