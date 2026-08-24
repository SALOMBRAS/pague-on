# Pague-On — Design System (decisões)

> Decisões de 2026-08-24. Fonte para o redesign dual-front.
> Estratégia: **SPA vanilla + breakpoint** (um código, dois padrões de interação).
> Identidade: **PicPay (verde neon) + C6 (preto de marca)** → **preto + verde**.

## Arquitetura dual-front (breakpoint)

- Um único app (SPA vanilla existente em `public/`), servido pelo mesmo backend.
- **Breakpoint estratégico: 1024px.**
  - `>= 1024px` → **Desktop**: dashboard administrativo (sidebar, tabelas ricas, KPIs, gráficos, atalhos de teclado).
  - `< 1024px` → **Mobile**: PWA fintech (bottom-tabs, cards full-width, FAB + bottom-sheet, swipe, safe-areas).
- Regra absoluta: mobile nunca é dashboard espremido; desktop nunca é app esticado.
- Ambos compartilham tokens CSS idênticos; o que muda é layout e padrão de interação.

## Design tokens (preto + verde)

Variáveis CSS em `:root` (e sob `[data-theme="dark"]`). Cores são as únicas primárias.

```css
:root {
  /* marca: verde neon (PicPay) + preto (C6) */
  --color-brand: #00C853;
  --color-brand-strong: #00B04A;
  --color-ink: #0D0D0D;          /* "preto" da marca = texto/neutro forte */

  /* primária: usada APENAS em CTA ativo, navegação ativa, status */
  --primary: var(--color-brand);
  --on-primary: #FFFFFF;

  /* backgrounds / surfaces */
  --bg: #FFFFFF;
  --surface: #F8F9FA;
  --border: #E9ECEF;

  /* status */
  --success: #00C853;
  --warning: #FFB300;
  --danger: #FF1744;

  /* texto */
  --text: #212529;
  --text-muted: #6C757D;

  /* raio / sombra / espaçamento */
  --radius-sm: 8px;
  --radius: 16px;         /* cards mobile */
  --radius-lg: 24px;
  --shadow-sm: 0 1px 2px rgba(13,13,13,.06);
  --shadow: 0 4px 16px rgba(13,13,13,.10);
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-6: 24px; --sp-8: 32px; --sp-12: 48px;

  /* tipografia */
  --font-ui: Inter, system-ui, -apple-system, sans-serif;
  --fs-display: clamp(28px, 5vw, 36px);
  --fs-h1: 24px; --fs-h2: 20px; --fs-h3: 16px;
  --fs-body: 15px; --fs-caption: 13px; --fs-label: 11px;
  --fs-money: 700 tabular-nums;   /* aplicado via font-variant-numeric */

  /* animação */
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-fast: 120ms; --dur: 220ms; --dur-slow: 320ms;
}

[data-theme="dark"] {
  --bg: #0D0D0D;
  --surface: #1A1A1A;
  --border: #2A2A2A;
  --text: #F5F5F5;
  --text-muted: #9AA0A6;
  --on-primary: #0D0D0D;   /* texto sobre verde neon: preto, para contraste */
}
```

### Regras de cor (não quebrar)

- **Primária (verde) NUNCA como background principal.** Só CTA, navegação ativa, micro-ênfase.
- **Preto** = cor de marca + neutros de texto. Na dark mode, preto é o fundo.
- Texto sobre verde usa **preto** (não branco) — garante contraste AA 4.5:1 sobre `#00C853`.
- Status: `success #00C853`, `warning #FFB300`, `danger #FF1744`. Ausência de azul corporativo.

## Tom de voz (UX writing)

Proibido vs preferido (aplicar em TUDO, mobile e desktop):

| Proibido | Preferido |
|---|---|
| Contas a Receber | Quem te deve |
| Notificação de Inadimplência | Cobrança atrasada — vamos lembrar? |
| Cadastrar Débito | Adicionar conta |
| Relatório Financeiro | Seu resumo do mês |
| Devedor | Pessoa / Quem me deve |
| Valor em Aberto | Ainda falta receber |
| Extrato | Movimentações |
| Saldo Devedor | Total a receber |
| Liquidar dívida | Marcar como pago |

## Acessibilidade

- Contraste WCAG AA (texto 4.5:1, UI 3:1).
- Focus visível: `outline: 2px solid var(--primary)` em todo elemento interativo.
- `prefers-reduced-motion`: desliga animações não essenciais.
- Fonte mínima 14px para texto corrido.
- Labels semânticos + `aria-label` em ícones sem texto.

## Micro-interações

- **Mobile**: slide horizontal entre telas (300ms, `--ease`), card fade+slide-up (200ms), tap scale 0.98 (100ms), bottom-sheet slide-up+backdrop fade (300ms), marcar-como-pago com confete sutil (400ms, spring), pull-to-refresh nativo, dark toggle fade (300ms).
- **Desktop**: fade entre páginas (200ms), hover de linha tabela (150ms), modal fade+scale (200ms), sidebar collapse width (300ms), tooltip fade (100ms), toast slide-in top-right (300ms).
