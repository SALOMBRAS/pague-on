# Pague On — sistema de design mestre

**Status:** decisão de design para o futuro dual-front.  
**Objetivo:** uma identidade humana de cobrança e lembretes, aplicada como PWA no celular e dashboard no computador.

## Princípios

1. **Clareza antes de densidade.** A pessoa precisa saber quem deve, quanto falta e quando vence sem vocabulário bancário.
2. **Verde é ação, não decoração.** A cor primária aparece em CTA, foco, estado ativo e sucesso; não pinta a página inteira.
3. **Mesmo DNA, contextos diferentes.** Mobile é leve e guiado; desktop é denso e produtivo.
4. **Movimento explica.** Só animar `transform` e `opacity`; respeitar `prefers-reduced-motion`.

## Tokens de cor

| Papel | Light | Dark | Uso |
| --- | --- | --- | --- |
| `--color-primary` | `#00C853` | `#32D583` | CTA, item ativo, foco positivo |
| `--color-primary-strong` | `#008A39` | `#71E7A4` | Texto/ícone sobre superfícies claras ou ênfase |
| `--color-on-primary` | `#062B16` | `#062B16` | Conteúdo dentro do CTA |
| `--color-canvas` | `#F7FAF8` | `#0B1210` | Fundo da aplicação |
| `--color-surface` | `#FFFFFF` | `#121C17` | Cards, sheet, drawer |
| `--color-surface-raised` | `#F0F5F1` | `#19251E` | Hover, controles e barras |
| `--color-text` | `#152018` | `#F4FBF6` | Texto principal |
| `--color-text-muted` | `#526158` | `#B2C0B6` | Texto auxiliar, nunca único indicador |
| `--color-border` | `#DCE6DF` | `#2A3A30` | Divisórias e contornos |
| `--color-success` | `#14804A` | `#71E7A4` | Pago/concluído |
| `--color-warning` | `#B45309` | `#F7B955` | Vence hoje/próximo |
| `--color-danger` | `#C73A3A` | `#FF8D8D` | Atrasado/erro |
| `--color-info` | `#2563A8` | `#8AB4F8` | Informação neutra |

Todos os pares de texto devem atender WCAG AA. Estado nunca pode ser comunicado apenas por cor: usar texto e ícone/badge.

## Tipografia e números

- Fonte: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.
- Peso: 400 para corpo, 500 para rótulos, 600 para títulos, 700 para valores/CTA.
- Texto legível: mínimo de 14 px; campos de toque e corpo principal em 16 px.
- Escala: `12 / 14 / 16 / 20 / 24 / 32 / 40`.
- Números monetários usam `font-variant-numeric: tabular-nums`.

## Espaçamento, forma e profundidade

| Token | Valor |
| --- | --- |
| `--space-1` | 4 px |
| `--space-2` | 8 px |
| `--space-3` | 12 px |
| `--space-4` | 16 px |
| `--space-5` | 24 px |
| `--space-6` | 32 px |
| `--radius-card` | 16 px |
| `--radius-control` | 12 px |
| `--radius-pill` | 999 px |
| `--shadow-card` | `0 6px 18px rgba(21, 32, 24, .08)` |

## Componentes base

- **Botão primário:** altura mínima 48 px, raio 12 px, verde, texto escuro legível.
- **Botão secundário:** superfície elevada, borda e texto principal; nunca concorre com o CTA.
- **Ícones:** somente SVG de traço arredondado consistente (`1.8–2 px`). Todo botão somente com ícone recebe `aria-label`.
- **Status badge:** `Pago`, `Pendente`, `Vence hoje`, `Atrasado`; sempre texto + cor + ícone quando necessário.
- **Campo:** label visível, altura mínima 48 px, foco de 3 px com a cor primária; erro próximo ao campo.
- **Empty state:** ilustração SVG simples, mensagem humana e uma única ação clara.

## Regras por front

### Mobile PWA

- Quatro tabs no máximo: Início, Adicionar, Resumo, Perfil.
- Cards ocupam a largura útil, com 16 px de padding e safe areas em todos os lados fixos.
- Bottom sheet para detalhes, filtros e formulários; CTA fica acima da home indicator.
- Um número principal por tela; o restante aparece em listas de cards.

### Desktop administrativo

- Sidebar de 256 px e cabeçalho compacto; sem bottom tabs e sem FAB.
- Grade de 2–4 KPIs e tabelas com linhas arejadas, hover discreto e números alinhados à direita.
- Drawer ou modal para edição; filtros persistentes acima da tabela.

## Motion

| Contexto | Movimento | Duração |
| --- | --- | --- |
| Pressão | `scale(.98)` | 100 ms |
| Card/lista | fade + `translateY(8px)` | 180–220 ms |
| Sheet mobile | `translateY` + backdrop | 260–300 ms |
| Modal desktop | opacity + `scale(.98)` | 180–200 ms |
| Navegação | slide mobile / fade desktop | até 300 ms |

Sem animação que bloqueie input, altere `width`/`height` ou gere reflow. Sob `prefers-reduced-motion`, renderizar diretamente no estado final.

## Linguagem

| Evitar | Usar |
| --- | --- |
| Contas a receber | Quem te deve |
| Cadastrar débito | Adicionar conta |
| Devedor | Pessoa / Quem me deve |
| Valor em aberto | Ainda falta receber |
| Liquidar dívida | Marcar como pago |
| Relatório financeiro | Seu resumo do mês |

Tom: direto, calmo e humano. Exemplo: “A conta da Ana vence amanhã. Quer enviar um lembrete?”

## Nunca fazer

- Azul corporativo como cor principal, fonte monoespaçada para texto normal ou estética de banco.
- Emojis como ícones estruturais, FontAwesome ou ícones sem alternativa acessível.
- Tabelas complexas no mobile; sidebar, FAB ou bottom sheet no desktop.
- Misturar azul/verde/preto como marcas diferentes entre landing, acesso e app.

