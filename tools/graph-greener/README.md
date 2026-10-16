# graph-greener

Script em Python (sem dependências) que cria **commits retroativos** num
repositório privado para preencher o gráfico de contribuições do GitHub.
É a mesma técnica do [goGreen](https://github.com/fenrir2608/goGreen) e do
[Graph-Greener](https://github.com/sakshamrma/Graph-Greener), com uma
distribuição mais natural e volumes fixos.

| Volume | Commits | Período |
|---|---|---|
| 1 | 200 | últimos 6 meses (até ontem) |
| 2 | 250 | 01/03/2024 – 30/06/2024 |
| 3 | 150 | 5 dias seguidos de 2024 (início aleatório, fora de Mar–Jun) |
| 4 | 100 | 01/12/2025 – 31/12/2025 |

## Como funciona

1. **Datas retroativas.** Todo commit é criado com as variáveis de ambiente
   `GIT_AUTHOR_DATE` e `GIT_COMMITTER_DATE` apontando para o passado
   (ex.: `2024-03-05T14:22:10-0300`). O GitHub posiciona o commit no gráfico
   pela *author date*, não pela data do push.
2. **Distribuição natural.** Cada dia recebe um peso log-normal (muitos dias
   com 1–3 commits, poucos com 10–16), ~30–50% dos dias ficam vazios, fins de
   semana pesam menos e os commits são sorteados proporcionalmente ao peso.
   Nenhum dia tem quantidade fixa. O Volume 3 tem ~15–45 commits/dia.
3. **Horários.** Entre 09:00 e 20:59 no fuso `-03:00` (12:00–23:59 UTC), para
   o commit nunca “pular” para o dia seguinte por causa do fuso.
4. **Segurança.** O script se recusa a rodar num repositório que já tenha
   histórico não criado por ele (evita sujar um projeto real). Use `--force`
   só se souber o que está fazendo.

## Passo a passo

### 1. Criar o repositório privado `priv`

No navegador: <https://github.com/new> → nome `priv` → **Private** → **não**
marque README/.gitignore/licença → *Create repository*.

Ou pelo GitHub CLI:

```bash
gh repo create SALOMBRAS/priv --private
```

### 2. Garantir que o GitHub vai contar os commits

- O e-mail do autor precisa ser um e-mail **verificado** na sua conta
  (Settings → Emails). Se usa e-mail privado, use o noreply exibido lá
  (formato `ID+SALOMBRAS@users.noreply.github.com`).
- Os commits precisam estar no branch padrão (`main`) — o script já usa `main`.
- Como o repositório é privado, ative no seu perfil:
  *Contribution settings* (acima do gráfico) → **Private contributions**.
  Contribuições privadas aparecem como quadrados verdes, sem detalhes.

### 3. Rodar o script

```bash
# veja a distribuição antes (não cria nada)
python3 graph_greener.py --dry-run

# gostou? fixe a semente mostrada para reproduzir exatamente o mesmo resultado
python3 graph_greener.py --repo priv --seed 123456 \
  --name "SALOMBRAS" --email "SEU_EMAIL_VERIFICADO"
```

No Windows use `python` em vez de `python3`. Opções úteis:
`--burst-start 2024-10-14` (escolhe os 5 dias do Volume 3), `--push`.
Os 700 commits levam cerca de 1 minuto.

### 4. Push

```bash
cd priv
git remote add origin https://github.com/SALOMBRAS/priv.git
git push -u origin main
```

O gráfico costuma atualizar em minutos (às vezes até 24 h). Os anos de 2024 e
2025 aparecem ao selecionar o ano ao lado do gráfico.

## Desfazer

`git revert` **não** resolve: ele cria commits novos, e os antigos continuam
no histórico contando no gráfico. É preciso que os commits deixem de existir
no branch padrão. Opções, da mais radical para a mais leve:

```bash
# A) apagar o repositório inteiro (remove todas as contribuições dele)
gh auth refresh -h github.com -s delete_repo   # só na 1ª vez
gh repo delete SALOMBRAS/priv --yes
#    (ou: github.com/SALOMBRAS/priv → Settings → Danger Zone → Delete this repository)

# B) manter o repositório, mas zerar o histórico
cd priv
git checkout --orphan limpo
git rm -rf --cached . && rm -f data.txt .graph-greener
git commit --allow-empty -m "reset"
git branch -D main && git branch -m main
git push --force origin main

# C) só esconder (reversível): desmarque "Private contributions"
#    em Contribution settings no seu perfil
```

Depois de A ou B, apague a pasta local (`rm -rf priv`) se quiser recomeçar.
