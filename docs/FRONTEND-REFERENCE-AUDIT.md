# Auditoria do front e plano de recriação — Pague On

Data: 31 de agosto de 2026  
Escopo: referência em `C:\Users\Salombras\Downloads\pagueon` e aplicação atual.

## Decisão arquitetural

O Pague On atual já possui uma aplicação funcional e integrada a um backend Express + Prisma/PostgreSQL. A recriação será **somente da camada de apresentação e interação**: não haverá substituição de banco, autenticação, permissões, rotas de API ou regras financeiras.

O breakpoint de produto será `1024px`:

| Faixa | Produto | Navegação principal |
| --- | --- | --- |
| abaixo de 1024px | PWA mobile para uso diário | Início, Adicionar, Resumo e Perfil |
| 1024px ou mais | desktop para gestão | sidebar fixa de 256px e cabeçalho |

Os dois layouts compartilham tokens, componentes e dados, mas não serão versões escaladas um do outro.

## Referência local analisada

### Estrutura e stack

`C:\Users\Salombras\Downloads\pagueon` é um protótipo estático, sem build, framework, banco, autenticação ou chamadas HTTP:

- nove documentos HTML independentes: `index`, `caixa`, `patrimonio`, `estoque`, `metas`, `cobradores`, `perfil` e `novo-produto`;
- um `styles.css` extenso, repetido inline nos documentos;
- JavaScript inline para abrir sheet, alternar tema, animações e tabs locais;
- SVGs inline para navegação, mas também emojis usados como ícones de interface;
- valores, usuário, permissões e registros fictícios fixos no HTML.

### Telas e linguagem visual aproveitável

| Arquivo | Ideia visual aproveitável | Estado funcional na referência |
| --- | --- | --- |
| `index.html` | resumo, filtros por período, grade de indicadores | demonstrativo |
| `caixa.html` | tabs de cobranças, cartões de dívida e ações | demonstrativo |
| `patrimonio.html` | patrimônio e categorias | demonstrativo |
| `estoque.html` | catálogo, filtros e cartões de produto | demonstrativo |
| `metas.html` | cartões de metas e progresso | demonstrativo |
| `cobradores.html` | vazio orientado a cadastro | demonstrativo |
| `perfil.html` | preferências agrupadas | demonstrativo |
| `novo-produto.html` | formulário visual | demonstrativo |

### O que não será copiado

- `onclick` e CSS inline;
- mudança de tema por `filter: invert()`;
- navegação entre HTMLs estáticos;
- dados falsos e estado apenas no DOM;
- emojis como ícones estruturais;
- preto puro `#000` e animações contínuas decorativas.

## Aplicação atual analisada

### Stack e entrada

- Node.js, Express 5, Prisma 6 e PostgreSQL/Supabase;
- frontend sem framework em `public/`, servido pelo Express/Vercel;
- renderização por módulos JavaScript e estado em memória/local IndexedDB;
- Inter e Space Grotesk já carregadas; o redesign normaliza a interface para Inter;
- PWA existente: `manifest.webmanifest`, `sw.js`, instalação e shell offline;
- ícones SVG locais em `public/icons.js` no estilo Lucide.

### Navegação e telas existentes

| Área atual | Módulos principais | Função que deve ser preservada |
| --- | --- | --- |
| login/cadastro | `auth.js`, `landing.js` | sessão, cadastro, recuperação e instalação PWA |
| início | `views/home.js`, `dashboard-financial.js` | resumo, dados carregados do backend e atalhos |
| caixa/cobranças | `views/caixa.js`, `views/forms.js` | criar, editar, cobrar, parcelar e marcar pagamento |
| operações rápidas | `quick-operation.js` | fluxo de produto/empréstimo |
| estoque/patrimônio/metas | módulos dedicados | produtos, compras, ativos, orçamento e metas |
| perfil/segurança | `views/perfil.js`, `security.js` | perfil, PIN, WebAuthn e preferências |
| auxiliares | scanner, export, push, people, reconciliation | OCR, exportação, notificações, pessoas e conciliação |

### APIs preservadas

O backend já expõe módulos autenticados para auth, acesso, dashboard financeiro, contas financeiras, dívidas, empréstimos, recebimentos, produtos, compras, clientes/pessoas, vendas, operações rápidas, parcelas, notificações, lembretes, relatórios, regras, backup, ativos, conciliação, orçamento, câmbio, push e metas. O redesign reutilizará estas APIs; nenhuma delas será trocada por dados locais.

### PWA e sessão existentes

- `manifest.webmanifest` e `sw.js` já oferecem modo standalone, ícones, cache e fallback offline;
- `pwa-install.js` centraliza o prompt de instalação;
- `onboarding.js` já contém um tour básico com spotlight e persistência;
- `security.js` e rotas de autenticação já cobrem PIN e WebAuthn.

Esses módulos serão evoluídos, não removidos.

## Fluxo atual versus fluxo alvo

| Aspecto | Atual | Alvo |
| --- | --- | --- |
| identidade | verde escuro com variações claras/desktop | Dark Neon único, `#0A0A0A` como canvas |
| layout mobile | dashboard reduzido com módulos do desktop | PWA próprio, cards, quatro tabs e sheet |
| layout desktop | shell híbrido | sidebar fixa, header, KPIs e tabelas/filters |
| ícones | SVGs misturados com emojis | SVG local consistente, sem Font Awesome |
| tour | básico e reaproveita textos com emoji | tour contextual por viewport, no máximo 6/8 passos |
| acessibilidade | foco e reduced-motion parciais | foco, labels, aria, contraste e alternativa a gesto |

## Sequência de PRs

1. Fundação Dark Neon: tokens, tipografia, ícones e breakpoints.
2. Componentes base: botão, campo, badge, card, skeleton e estados.
3. Shell desktop: sidebar, header, comandos e atalhos.
4. Shell mobile: bottom navigation, safe areas e camada de sheets.
5. Início desktop: KPIs, agenda e ações reais.
6. Início mobile: cartões, recebimentos e pull-to-refresh seguro.
7. Cobranças desktop: tabela, filtros persistentes, ações em lote e drawer.
8. Adicionar mobile: quick add em bottom sheet, reutilizando operação rápida.
9. Resumo nos dois layouts.
10. Perfil/configurações nos dois layouts.
11. PWA: manifest, splash, offline e atualização de cache.
12. Tour interativo, primeira execução e reabertura em ajuda.
13. Polish: estados vazios, motion reduzido, acessibilidade e performance.

Cada PR terá testes estáticos/funcionais pertinentes, passos de validação em 375px, 768px, 1024px e 1440px, e será empilhada sobre a anterior para permitir revisão e rollback incremental.

## Critérios de aceite transversais

- Nenhuma chamada de API, validação financeira, autenticação ou permissão é removida.
- Desktop não mostra bottom tabs, FAB ou bottom sheet como navegação principal.
- Mobile não mostra sidebar, tabelas largas ou ações inacessíveis pelo toque.
- Todo controle clicável tem foco visível, nome acessível e alvo mínimo adequado.
- A interface respeita `prefers-reduced-motion`, áreas seguras e não depende somente de cor para status.
- Valores usam números tabulares e dados reais retornados pelo backend.
