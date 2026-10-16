#!/usr/bin/env python3
"""
graph_greener.py - commits retroativos para o grafico de contribuicoes do GitHub.

Mesma tecnica do goGreen (Node) e do Graph-Greener (Python): cada commit e
criado com GIT_AUTHOR_DATE e GIT_COMMITTER_DATE apontando para o passado.
O GitHub posiciona o commit no grafico pela *author date*, entao o quadrado
aparece no dia escolhido, nao no dia do push.

Volumes gerados:
  1) 200 commits espalhados nos ultimos 6 meses
  2) 250 commits entre 01/03/2024 e 30/06/2024
  3) 150 commits concentrados em 5 dias seguidos de 2024 (inicio aleatorio)
  4) 100 commits espalhados por dezembro de 2025

Uso rapido:
  python3 graph_greener.py --dry-run          # so mostra a distribuicao
  python3 graph_greener.py --repo priv        # cria os commits em ./priv
  python3 graph_greener.py --repo priv --push # cria e ja faz o push

Requer apenas Python 3.8+ e Git. Sem dependencias externas.
"""

import argparse
import math
import os
import random
import subprocess
import sys
from collections import Counter
from datetime import date, datetime, timedelta

MARKER = ".graph-greener"
DATA_FILE = "data.txt"

# Horario "de trabalho" no fuso de Brasilia (-03:00). Entre 09:00 e 20:59
# local o horario UTC fica entre 12:00 e 23:59 do MESMO dia, entao o GitHub
# nunca empurra um commit para o dia seguinte por causa do fuso.
TZ_OFFSET = "-0300"
FIRST_HOUR, LAST_HOUR = 9, 20


# --------------------------------------------------------------------------- #
# Datas
# --------------------------------------------------------------------------- #
def days_between(start, end):
    """Lista de datas de start ate end (inclusive)."""
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def months_ago(d, months):
    y, m = d.year, d.month - months
    while m <= 0:
        m += 12
        y -= 1
    # trata dia 31 em mes de 30 dias, 29/02 etc.
    for day in (d.day, 30, 29, 28):
        try:
            return date(y, m, day)
        except ValueError:
            continue


# --------------------------------------------------------------------------- #
# Distribuicao "natural"
# --------------------------------------------------------------------------- #
def distribute(rng, total, days, zero_prob, sigma, weekend_factor,
               max_per_day=None, min_per_day=0):
    """
    Distribui `total` commits entre `days` sem padrao obvio:
      * cada dia recebe um "peso" log-normal (poucos dias muito ativos,
        muitos dias com 1-3 commits);
      * uma fracao `zero_prob` dos dias fica com peso zero (dias sem commit);
      * fins de semana tem peso reduzido;
      * os commits sao sorteados dia a dia proporcionalmente ao peso
        (amostragem multinomial), entao a soma bate exatamente com `total`.
    """
    weights = []
    for d in days:
        if rng.random() < zero_prob:
            weights.append(0.0)
            continue
        w = rng.lognormvariate(0, sigma)
        if d.weekday() >= 5:
            w *= weekend_factor
        weights.append(w)
    if not any(weights):
        weights[rng.randrange(len(weights))] = 1.0

    counts = Counter({d: min_per_day for d in days} if min_per_day else {})
    remaining = total - min_per_day * len(days) if min_per_day else total
    for d in rng.choices(days, weights=weights, k=remaining):
        counts[d] += 1

    if max_per_day:
        _apply_cap(rng, counts, days, weights, max_per_day)

    assert sum(counts.values()) == total
    return counts


def _apply_cap(rng, counts, days, weights, cap):
    """
    Move o excedente para outros dias ativos. Cada dia tem um teto proprio
    (70-100% de `cap`) para que varios dias nao fiquem com o mesmo valor maximo.
    """
    limit = {d: rng.randint(max(1, int(cap * 0.7)), cap) for d in days}
    overflow = 0
    for d in list(counts):
        if counts[d] > limit[d]:
            overflow += counts[d] - limit[d]
            counts[d] = limit[d]
    while overflow:
        candidates = [d for d, w in zip(days, weights) if w and counts[d] < limit[d]]
        if not candidates:  # todos os ativos lotados: ativa um dia "vazio"
            candidates = [d for d in days if counts[d] < limit[d]]
        counts[rng.choice(candidates)] += 1
        overflow -= 1


def times_for_day(rng, d, n):
    """n horarios aleatorios, distintos e ordenados, dentro do expediente."""
    start = FIRST_HOUR * 3600
    end = (LAST_HOUR + 1) * 3600 - 1
    secs = sorted(rng.sample(range(start, end + 1), n))
    base = datetime(d.year, d.month, d.day)
    return [base + timedelta(seconds=s) for s in secs]


# --------------------------------------------------------------------------- #
# Plano dos 4 volumes
# --------------------------------------------------------------------------- #
def build_plan(rng, today, burst_start=None):
    yesterday = today - timedelta(days=1)

    v1_days = days_between(months_ago(today, 6), yesterday)
    v2_days = days_between(date(2024, 3, 1), date(2024, 6, 30))
    v4_days = days_between(date(2025, 12, 1), date(2025, 12, 31))

    if burst_start is None:
        # 5 dias seguidos em 2024, fora do bloco Mar-Jun para nao "sumir" nele
        candidates = [d for d in days_between(date(2024, 1, 1), date(2024, 12, 27))
                      if not (date(2024, 2, 25) <= d <= date(2024, 6, 30))]
        burst_start = rng.choice(candidates)
    v3_days = days_between(burst_start, burst_start + timedelta(days=4))

    volumes = [
        ("Volume 1 - ultimos 6 meses", 200,
         distribute(rng, 200, v1_days, zero_prob=0.50, sigma=0.9,
                    weekend_factor=0.35, max_per_day=15)),
        ("Volume 2 - Mar a Jun/2024", 250,
         distribute(rng, 250, v2_days, zero_prob=0.38, sigma=0.9,
                    weekend_factor=0.35, max_per_day=16)),
        ("Volume 3 - 5 dias seguidos em 2024", 150,
         distribute(rng, 150, v3_days, zero_prob=0.0, sigma=0.45,
                    weekend_factor=0.8, max_per_day=50, min_per_day=8)),
        ("Volume 4 - Dez/2025", 100,
         distribute(rng, 100, v4_days, zero_prob=0.30, sigma=0.8,
                    weekend_factor=0.4, max_per_day=14)),
    ]
    return volumes


def build_custom_plan(rng, specs, today):
    """Volumes passados por --volume INICIO FIM QTD; parametros pela densidade."""
    volumes = []
    for start, end, n in specs:
        if start > end:
            sys.exit(f"ERRO: --volume {start} {end}: inicio depois do fim.")
        if end >= today:
            sys.exit(f"ERRO: --volume {start} {end}: o fim precisa ser antes de hoje.")
        days = days_between(start, end)
        avg = n / len(days)
        if avg <= 3:
            zero_prob, cap = 0.45, 15
        elif avg <= 8:
            zero_prob, cap = 0.25, max(15, round(avg * 2.5))
        else:
            zero_prob, cap = 0.10, round(avg * 2.5)
        counts = distribute(rng, n, days, zero_prob=zero_prob, sigma=0.8,
                            weekend_factor=0.4, max_per_day=cap)
        volumes.append((f"{start:%d/%m/%Y} a {end:%d/%m/%Y}", n, counts))
    return volumes


def print_plan(volumes):
    total = Counter()
    for name, n, counts in volumes:
        active = {d: c for d, c in counts.items() if c}
        days = sorted(counts) if counts else []
        print(f"\n{name}: {n} commits em {len(active)} dias ativos "
              f"(1o: {min(days)}, ultimo: {max(days)})")
        print(f"  min/dia ativo={min(active.values())}  "
              f"max/dia={max(active.values())}  "
              f"media={n / len(active):.1f}")
        hist = Counter(active.values())
        print("  commits/dia : qtd de dias -> "
              + ", ".join(f"{k}:{hist[k]}" for k in sorted(hist)))
        total.update(counts)
    print(f"\nTOTAL: {sum(total.values())} commits em "
          f"{sum(1 for c in total.values() if c)} dias distintos")
    return total


# --------------------------------------------------------------------------- #
# Git
# --------------------------------------------------------------------------- #
def git(repo, *args, env=None, check=True, capture=False):
    return subprocess.run(["git", *args], cwd=repo, env=env, check=check,
                          text=True, capture_output=capture)


def prepare_repo(repo, force, name, email, empty=False):
    if not os.path.isdir(repo):
        os.makedirs(repo)
    if not os.path.isdir(os.path.join(repo, ".git")):
        if git(repo, "init", "-b", "main", check=False, capture=True).returncode:
            git(repo, "init")                       # Git < 2.28
            git(repo, "symbolic-ref", "HEAD", "refs/heads/main")

    has_commits = git(repo, "rev-parse", "--verify", "HEAD",
                      check=False, capture=True).returncode == 0
    if has_commits and not os.path.exists(os.path.join(repo, MARKER)) and not force:
        sys.exit(f"ERRO: '{repo}' ja tem historico que nao foi criado por este "
                 "script. Use um repositorio vazio (ex.: 'priv') ou --force.")

    if name:
        git(repo, "config", "user.name", name)
    if email:
        git(repo, "config", "user.email", email)
    cfg_email = git(repo, "config", "user.email", check=False,
                    capture=True).stdout.strip()
    if not cfg_email:
        sys.exit("ERRO: user.email nao configurado. Use --email com um e-mail "
                 "verificado na sua conta GitHub (ou o noreply do GitHub).")
    print(f"Autor dos commits: {cfg_email}  (precisa estar verificado no GitHub)")

    if empty:  # projeto real: nao cria nenhum arquivo
        return
    with open(os.path.join(repo, MARKER), "w") as f:
        f.write("Repositorio gerado por graph_greener.py\n")
    git(repo, "add", MARKER)


def make_commits(rng, repo, total, empty=False):
    stamps = []
    for d, n in sorted(total.items()):
        if n:
            stamps.extend(times_for_day(rng, d, n))
    stamps.sort()

    data_path = os.path.join(repo, DATA_FILE)
    env = os.environ.copy()
    width = len(str(len(stamps)))
    for i, ts in enumerate(stamps, 1):
        git_date = ts.strftime("%Y-%m-%dT%H:%M:%S") + TZ_OFFSET
        env["GIT_AUTHOR_DATE"] = git_date
        env["GIT_COMMITTER_DATE"] = git_date
        if empty:
            git(repo, "commit", "-q", "--allow-empty", "-m",
                f"update {ts:%Y-%m-%d}", env=env)
        else:
            with open(data_path, "a") as f:
                f.write(f"{git_date}\n")
            git(repo, "add", DATA_FILE)
            git(repo, "commit", "-q", "-m", f"update {ts:%Y-%m-%d}", env=env)
        if i % 50 == 0 or i == len(stamps):
            print(f"  [{i:>{width}}/{len(stamps)}] {git_date}")


# --------------------------------------------------------------------------- #
def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--repo", default="priv",
                   help="pasta do repositorio local (default: ./priv)")
    p.add_argument("--dry-run", action="store_true",
                   help="so mostra a distribuicao, nao cria commits")
    p.add_argument("--seed", type=int,
                   help="semente aleatoria (mesma semente = mesmo resultado)")
    p.add_argument("--burst-start", type=date.fromisoformat,
                   help="1o dia do Volume 3 (AAAA-MM-DD, em 2024); default aleatorio")
    p.add_argument("--name", help="git user.name para este repositorio")
    p.add_argument("--email", help="git user.email (verificado no GitHub)")
    p.add_argument("--push", action="store_true",
                   help="faz 'git push -u origin main' ao final")
    p.add_argument("--force", action="store_true",
                   help="permite usar um repositorio que ja tem historico")
    p.add_argument("--volume", nargs=3, action="append",
                   metavar=("INICIO", "FIM", "QTD"),
                   help="volume customizado (AAAA-MM-DD AAAA-MM-DD N); pode repetir. "
                        "Se usado, substitui os 4 volumes padrao")
    p.add_argument("--empty", action="store_true",
                   help="commits vazios (--allow-empty), sem criar arquivos; "
                        "para usar em um projeto real junto com --force")
    args = p.parse_args()

    if args.burst_start and not (date(2024, 1, 1) <= args.burst_start <= date(2024, 12, 27)):
        sys.exit("ERRO: --burst-start precisa estar entre 2024-01-01 e 2024-12-27.")

    seed = args.seed if args.seed is not None else random.randrange(1_000_000)
    rng = random.Random(seed)
    print(f"Semente: {seed}  (repita com --seed {seed} para o mesmo resultado)")

    if args.volume:
        try:
            specs = [(date.fromisoformat(a), date.fromisoformat(b), int(n))
                     for a, b, n in args.volume]
        except ValueError:
            sys.exit("ERRO: use --volume AAAA-MM-DD AAAA-MM-DD QTD")
        volumes = build_custom_plan(rng, specs, date.today())
    else:
        volumes = build_plan(rng, date.today(), args.burst_start)
    total = print_plan(volumes)

    if args.dry_run:
        print("\n--dry-run: nenhum commit criado.")
        return

    repo = os.path.abspath(args.repo)
    print(f"\nRepositorio: {repo}")
    prepare_repo(repo, args.force, args.name, args.email, args.empty)
    make_commits(rng, repo, total, args.empty)
    print(f"\n{sum(total.values())} commits criados.")

    if args.push:
        print("Enviando para o GitHub...")
        git(repo, "push", "-u", "origin", "main")
        print("Push concluido. O grafico pode levar alguns minutos para atualizar.")
    else:
        print(f"Proximo passo:  cd {args.repo} && git push -u origin main")


if __name__ == "__main__":
    main()
