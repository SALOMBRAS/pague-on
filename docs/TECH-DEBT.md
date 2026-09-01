# Débito técnico — models grandes (Prisma)

> Registrado em 2026-09-01 durante a auditoria completa (P6).

## Contexto

`prisma/schema.prisma` tem alguns models que acumulam muitas responsabilidades:

| Model | Campos | Responsabilidades misturadas |
| --- | --- | --- |
| `User` | 75 | perfil, preferências (tema/moeda/notificações), segurança (PIN/WebAuthn), plano |
| `Debt` | 48 | dívida base, parcelamento, recorrência, cobrança, vínculos (produto/cliente) |
| `Customer` | 49 | dados cadastrais, classificação, documentos, consentimento LGPD |

## Decisão

**NÃO fazer o split agora.** O risco de regressão é alto (as queries, controllers e
services tocam esses models em dezenas de pontos) e o valor imediato é baixo —
não há gargalo de performance nem dificuldade de manutenção que justifique a
migração neste momento.

## Caminho de split futuro (quando doer)

- `User` → `User` (auth/identidade) + `UserProfile` (dados pessoais) +
  `UserPreferences` (tema, moeda, notificações) + `UserSecurity` (PIN, WebAuthn).
- `Debt` → `Debt` (núcleo) + `DebtPaymentPlan` (parcelamento/recorrência) +
  `DebtCollection` (cobrança/lembretes).
- `Customer` → `Customer` (cadastro) + `CustomerConsent`/`CustomerDocument`
  (já separados) — avaliar extrair `CustomerClassification` (já separado).

## Gatilhos para revisitar

- Queries ficarem largas/lentas por colunas desnecessárias.
- Dificuldade real de manutenção (muitas mudanças colidindo no mesmo model).
- Necessidade de permissões/visibilidade por coluna (ex.: PII em `User`).
