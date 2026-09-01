# Cálculos das configurações financeiras

Os valores monetários são arredondados para duas casas no resultado final; as regras de contrato ficam registradas como um *snapshot* no momento da contratação.

| Cenário | Regra | Resultado |
| --- | --- | --- |
| Juros simples | R$ 1.000 × 2% × 3 períodos | R$ 60 de juros; R$ 1.060 no total |
| Juros compostos autorizado | R$ 1.000 × ((1 + 2%)³ − 1) | R$ 61,21 de juros; R$ 1.061,21 no total |
| Atraso | Parcela R$ 500, multa 2%, juros diário 0,033%, 10 dias | Multa R$ 10; juros R$ 1,65; total R$ 511,65 |
| Carência | Carência de 3 dias, atraso de 3 dias | Sem multa e sem juros de atraso |

Casos inválidos: principal negativo, dias de atraso negativos, taxa fora dos limites e qualquer cálculo não finito são rejeitados pela API.
