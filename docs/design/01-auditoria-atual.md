# Auditoria atual — Pague On

**Data:** 23 de agosto de 2026  
**Escopo:** diagnóstico para o redesign dual-front. Não altera o produto nesta etapa.

## Stack encontrado

- Backend: Node.js, Express 5 e Prisma com PostgreSQL/Supabase.
- Autenticação: contas próprias, JWT e refresh token; há suporte a WebAuthn/PIN.
- Front atual: HTML, CSS e JavaScript sem framework, servido em `public/`.
- PWA: manifest, service worker, IndexedDB/offline queue e push já existem.
- Ícones: SVG local leve em `public/icons.js`; OCR é baixado somente quando solicitado.

## O que já é uma boa base

1. O backend já possui dados suficientes para o produto proposto: pessoas, cobranças, parcelas, lembretes, notificações, pagamentos e resumo.
2. O app móvel já usa cards, navegação inferior, áreas seguras e ações de swipe.
3. A página de acesso foi isolada do dashboard, reduzindo o tempo para cadastrar e entrar.
4. A PWA já tem cache, fila offline e inscrições de push como fundação técnica.

## Problemas de produto e interface

| Área | Diagnóstico | Consequência |
| --- | --- | --- |
| Identidade | Landing usa preto/verde; acesso usa azul-marinho/verde; app usa slate/verde. | A jornada parece composta por produtos diferentes. |
| Linguagem | Termos como “dívida”, “estoque” e “fluxo de caixa” dominam a experiência. | Para o usuário comum, soa corporativo e distante do objetivo “quem me deve / minhas contas”. |
| Arquitetura visual | O mesmo `index.html` concentra o app e sua lógica; desktop é hoje uma ampliação do mobile. | Não há uma experiência administrativa própria no computador. |
| Performance | O HTML principal ainda tem lógica extensa inline e diversos módulos de recursos. | O app pode perder fluidez em aparelhos modestos mesmo com OCR já adiado. |
| Navegação móvel | Há seis destinos na barra inferior em alguns estados. | Excede o foco de quatro ações principais definido para o novo produto. |
| Acessibilidade | Existem bons rótulos em botões recentes, porém o app legado ainda contém ícones em texto/emoji e textos abaixo de 14 px. | Inconsistência visual e risco de leitura/touch em telas pequenas. |

## Decisões de arquitetura recomendadas

1. Manter o backend e o schema atuais; a mudança é de camada de apresentação e vocabulário.
2. Criar dois shells independentes, compartilhando apenas API, dados, tokens e design tokens:
   - `mobile`: PWA focada em contas, lembretes e pessoas.
   - `desktop`: dashboard administrativo focado em análise, filtros e gestão em lote.
3. Usar `1024px` como ponto de entrega do shell: abaixo é mobile, a partir dele é desktop. O estado da rota deve ser comum para preservar links e notificações.
4. Trocar jargão de interface sem renomear entidades do banco: `Debt` continua interno; na tela vira “Conta”, “Cobrança” ou “Quem te deve”, conforme o tipo.

## Critérios de aceite para o redesign

- Mobile não mostra sidebar ou tabelas largas; desktop não mostra bottom tabs/FAB.
- A paleta e a tipografia são iguais nos dois fronts, mas densidade e navegação são próprias.
- A primeira pintura do login/cadastro não depende do dashboard.
- Ações principais têm alvo de toque de pelo menos 44 px, foco visível e feedback de carregamento.
- Recursos pesados permanecem sob demanda.

