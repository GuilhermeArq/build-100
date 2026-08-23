# Manutenção do GUIA Arquitetura Recife

## Regra de preservação visual

A introdução que desenha o **G** e apresenta **GUIA Arquitetura Recife** é parte protegida do projeto. O arquivo `js/loader.js` e a marcação/CSS que sustentam essa animação não devem ser alterados em manutenções rotineiras de dados.

## Catálogo de edifícios

Os registros oficiais usados pelas páginas de edifícios e pelo mapa ficam em `data/catalogo/`.

- `meta.json`: dicionário de logradouros e bairro.
- `01.json` a `07.json`: registros compactos, na ordem do levantamento.
- Cada registro segue a ordem: `[logradouroIndex, numero, nome, latitude, longitude, projetistas, fonte, quantidadeImagensOriginais]`.

O arquivo `data/edificios.json` foi esvaziado de propósito. O `js/main.js` monta em memória o formato que o código visual antigo espera, sem manter duas versões editáveis de endereço, projetista ou página individual.

### Campos derivados automaticamente

Os seguintes valores não são fontes de verdade e são gerados em tempo de execução:

- `id` / slug;
- `endereco`, a partir de logradouro + número;
- `arquiteto`, apenas como texto compatível, a partir de projetistas;
- `pagina`, sempre no formato `edificio.html?id=...`;
- nome de exibição dos imóveis sem denominação própria.

## Dados ainda não pesquisados

Ano, uso, tipologia e status não recebem mais valores históricos presumidos. Enquanto não houver informação confiável, o site usa explicitamente `s.d.` ou `Não informado`, evitando transformar ausência de pesquisa em dado acadêmico.

## Código legado preservado

`js/main-core.js` é uma cópia preservada do `main.js` anterior, responsável pela aparência, navegação e montagem das páginas. O novo `js/main.js` funciona apenas como camada de dados e então carrega esse núcleo. Isso reduz o risco de regressão estética durante a migração do catálogo.

## Validação

Execute, em ambiente com Node.js:

```bash
node scripts/validar-catalogo.mjs
```

O validador confere quantidade de registros, índices de logradouro, coordenadas e possíveis duplicatas. Duplicatas são apenas avisadas, nunca removidas automaticamente, pois podem representar registros distintos do levantamento.

## Mídia

As imagens de teste foram removidas. As fotografias definitivas devem ser vinculadas ao catálogo somente após serem copiadas para `midia/edificios/`, mantendo associação inequívoca com o registro correspondente.
