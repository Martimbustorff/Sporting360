# Fontes das modalidades (Task 1, Plano 2)

Investigação feita a 2026-11-17 (o ficheiro mantém o nome da calendarização). Época 2026-2027, Sporting masculino. Tudo foi lido a partir de um cliente HTTP normal; as fontes escolhidas respondem a pedidos simples (HTML ou JSON), sem JavaScript.

## Decisão

Aceite pelo Martim: futsalportugal.com; hp.fpp.pt com hoqueipatins.pt; Liga dos Campeões WSE via hoqueipatins.pt com a fonte indicada na app.

| Modalidade | Principal | Recurso | Estado |
|---|---|---|---|
| Futsal | futsalportugal.com (Zona Técnica Futsal), HTML | mesmo editor, JSON-LD de `/pt/gamesheet/{id}` | Termos não escritos, sem fonte independente de recurso |
| Hóquei em patins (nacional) | hp.fpp.pt (FPP oficial), HTML | hoqueipatins.pt, SportsPress JSON | Principal limpo; recurso exige indicar a fonte |
| Hóquei em patins (Europa) | hoqueipatins.pt, liga 1123 | Post oficial do calendário WSE (texto, sem hora) | Só existe fonte estruturada não oficial |
| Voleibol | API-Sports | n/d | Cobertura confirmada em parte |
| Andebol, basquetebol | API-Sports | federações (por avaliar) | Cobertura e ids por confirmar com chave |

## Futsal

| Fonte | Cobertura | Estabilidade | Termos e robots | Veredicto |
|---|---|---|---|---|
| futsalportugal.com | Liga Placard (22 rondas, 132 jogos), Taça de Portugal, Taça da Liga, Supertaça, UEFA Futsal Champions League; hora, local (no JSON-LD), resultado, ronda, canal, prolongamento ("a.p."), penáltis ("Penáltis 3-4"), "W.O." | Laravel com HTML no servidor, classes `sc-round`, `sc-item`, `mcm-*`. Página ~600 KB. A hora da lista segue o país de quem pede ("hora US"); o JSON-LD traz sempre `+01:00` | robots.txt permite `/`. Sem termos de uso (só privacidade e estatuto editorial; publicação com registo ERC). Reutilização não autorizada nem proibida | Principal. Pedir 1 vez por 30 min, 1 vez por 5 min só em janela de jogo |
| fpf.pt | Oficial | Devolve 403 "Your request was blocked" a clientes automáticos (WAF). Não se contornou | robots.txt permite `/` mas bloqueia muitos robôs de IA | Excluída |
| zerozero.pt | Completa | Desafio Cloudflare | Não avaliado, não se contornou | Excluída |
| sporting.pt | Calendário com modalidades | SPA, dados carregados no cliente de um Supabase privado; rotas `/agenda` redirecionam para `/`; sem ICS (só botões "adicionar ao calendário") | robots.txt com `Crawl-delay: 10`; usar o backend privado seria abusivo | Excluída |
| Sofascore, Flashscore/Livesport | Boa | 403 / termos proíbem recolha | Proíbem | Excluídas |
| UEFA.com | Só Champions de futsal | App com API não documentada | Sem termos para uso automático | Só para confirmação manual |
| TheSportsDB | Sem futsal | Chave de teste "123" | n/d | Excluída |
| Wikipedia | Sem horas | Limite de pedidos desta rede | n/d | Excluída |

Notas para o parser (Task 17):
- Linha de jogo: `div.sc-item` com `span.sc-time`, dois `span.mcm-name`, dois `span.mcm-g` (vazios se por jogar), `onclick` com `/pt/gamesheet/{id}`. Estado: `mcm is-up` = por jogar. A ronda vem do `h3` de `article.sc-round`; o texto traz `<em>Agora</em>` na ronda corrente e tem de ser removido. O dia vem de `div.sc-day` ("Sexta-feira, 11 setembro", sem ano).
- Hora e local: pedir `/pt/gamesheet/{id}` só para os jogos do Sporting e ler o `startDate` do JSON-LD (offset explícito) e `location.name`.
- Anomalia observada: linhas da Taça da Liga datadas de 6 a 9 de janeiro de 2027 já tinham resultado na captura de 2026-11-17. Não liquidar nem marcar FT quando o `kickoff` está no futuro.
- Taça de Portugal: o Sporting ainda não aparece (só rondas anteriores à entrada). Champions: "Beitar / Sporting" nos quartos é um marcador de eliminatória, não uma equipa.
- Prolongamento e penáltis: `span.sc-extra` ("a.p.", "W.O.") e `div.mcm-note` ("Penáltis 3-4"). Estado "ao vivo" não foi observado (nenhum jogo em curso); validar na Task 21.

## Hóquei em patins

| Fonte | Cobertura | Estabilidade | Termos e robots | Veredicto |
|---|---|---|---|---|
| hp.fpp.pt (FPP) | Campeonato Placard (fase regular `/Competicao/493`, 182 jogos), Supertaça (496), Elite Cup (509), Taça de Portugal (508 e fases seguintes); data e hora, equipas, resultado, jornada, árbitros, plantéis. Sem local do jogo | ASP.NET com HTML no servidor, tabela `calendario-hp`. Uma página por fase; fases dos playoffs aparecem como novos ids (2025-26: 468, 473, 486) | Sem robots.txt (404). Rodapé "Resultados divulgados de acordo com o RGHP". Resultado marcado "provisório" (`score provisorio`) | Principal para competições nacionais |
| hoqueipatins.pt | Campeonato, Taça, Supertaça, Elite Cup e WSE (liga 1123, grupo 2026-27 com os 6 jogos do Sporting às 19:00); local via `/venues`; `date` em hora de Lisboa | WordPress SportsPress REST, paginado (`X-WP-TotalPages`), estável. Atrasa ou diverge da FPP (J3 Sporting-Benfica: dia 21 contra dia 22 na FPP) | robots.txt vazio. Termos: pode copiar e distribuir para fins informativos com indicação da fonte; reprodução comercial proibida sem autorização | Recurso e fonte da Europa |
| europe.worldskate.org (WSE) | Calendário 2026-27 em texto (post 50343); resultados em artigos | WordPress REST; sem hora | robots.txt permite | Só confirma datas |
| wse.sidgad.com (livescore oficial WSE) | Completa | App JavaScript sobre `api.sidgad.com` com credencial embutida na página | Sem termos; usar a credencial de uma página pública seria duvidoso | Não adotada |
| europe.worldskate.tv | Vídeo, época 2026-27 ainda 404 | n/d | `/api/` proibido | Excluída |
| sporting.pt, fpf.pt, rinkhockey.net | Ver futsal / site antigo sem calendário útil | n/d | n/d | Excluídas |

Notas para o parser (Task 17):
- hp.fpp.pt: linha `tr` com `p.data` (número do jogo), `p.data` com "AAAA-MM-DD<br>HH:MM", `p.visitada` (casa) e `p.visitante`, `p.resultado` ("5 - 0" ou "-"), link `/jogo/{id}` só existe depois de haver ficha. Cabeçalho `h6.titulo-jornada`. Uma jornada pode ter jogos adiados com data posterior (J1 jogada a 2026-11-10).
- Usar `jogo` com 1 pedido só para jogos terminados do Sporting se for preciso (árbitros, faltas).
- hoqueipatins: `status` "publish" com `main_results` = terminado, "future" = por jogar; `day` "0001-Jornada 1" (prefixo numérico de ordenação); `outcome` por equipa. Playoffs em séries: o mesmo adversário vários dias seguidos, ligar por `day` ou id de evento.

## API-Sports (plano gratuito)

Lido em fontes públicas (as páginas marcadas «não reverificado» em «Fontes consultadas» foram lidas numa primeira passagem e não foram abertas de novo; confirmar na primeira resposta real):
- Hosts: a decisão é usar a RapidAPI com a mesma `RAPIDAPI_KEY`: `api-handball.p.rapidapi.com`, `api-volleyball.p.rapidapi.com`, `api-basketball.p.rapidapi.com` (cabeçalhos `x-rapidapi-key` e `x-rapidapi-host`). Estes hosts seguem o padrão `api-{modalidade}.p.rapidapi.com` e NÃO foram confirmados com uma chamada; os hosts diretos `v1.{modalidade}.api-sports.io` (o de andebol responde 403 "Missing application key") não são usados. Confirmar o host e a subscrição na primeira chamada real.
- Gratuito: 100 pedidos por dia, reposição às 00:00 UTC (páginas de preços de andebol e basquetebol). O limite de 10 por minuto não aparece nas páginas públicas.
- Época: basquetebol em intervalo ("2023-2024", artigo oficial de lançamento); andebol e voleibol em ano (`2026`), formato a confirmar na primeira resposta real.
- Voleibol, competições portuguesas na tabela de cobertura: Campeonato Nacional, Taça de Portugal, Super Cup (e femininas). Europa: Champions League, CEV Cup, Challenge Cup.

Não confirmado (a tabela de cobertura de andebol e basquetebol só mostra 15 linhas sem JavaScript; a documentação está atrás de desafio Cloudflare): ligas portuguesas e europeias cobertas, id da equipa do Sporting e ids das ligas. A listagem de voleibol parece incluir a equipa feminina e masculina; é preciso escolher o id masculino.

## Pendentes para uma chamada real (precisa de RAPIDAPI_KEY, 3 a 6 pedidos)

1. `GET /teams?search=Sporting` em cada host: preencher `teamId`.
2. `GET /leagues?country=Portugal` e `GET /leagues?team={id}&season=...`: preencher `leagues` e `covered` (campo `coverage`). Para andebol e basquetebol decidir o que entra em `API_SPORTS_GAPS`.
3. `GET /games?team={id}&season=2026` (basquetebol `2026-2027`): substituir as amostras sintéticas de `test/fixtures/api-sports/*` por respostas reais.

Em `sourcesConfig.ts`, `null` marca estes campos e as três modalidades API-Sports estão com `enabled: false`; `test/unit/sourcesConfig.test.ts` falha se alguma for ativada com ids por confirmar.

## Fontes consultadas

- https://hp.fpp.pt, https://hp.fpp.pt/Competicao/493, https://fpp.pt/robots.txt
- https://www.hoqueipatins.pt/wp-json/sportspress/v2/events, https://www.hoqueipatins.pt/termos-e-condicoes/
- https://europe.worldskate.org/the-complete-schedule-of-the-wse-rink-hockey-european-cups/ (via `wp-json/wp/v2/posts/50343`), https://wse.sidgad.com/
- https://futsalportugal.com/pt/maincompetition/26, https://futsalportugal.com/robots.txt, https://futsalportugal.com/pt/estatuto-editorial
- https://fpf.pt/robots.txt, https://www.sporting.pt/robots.txt, https://sporting.pt/termos
- https://api-sports.io/sports/handball, https://api-sports.io/sports/basketball, https://api-sports.io/sports/volleyball (não reverificado)
- https://www.api-football.com/news/post/api-basketball-new-release-available (não reverificado)

## Fixtures guardadas

`functions/test/fixtures/free/{hp_fpp,hoqueipatins,futsalportugal}` (amostras públicas truncadas, sem credenciais; a verificação usa `bearer|x-rapidapi|api[_-]?key|"token"` e UUIDs, porque `key|token` apanha `event.key` do HTML) e `functions/test/fixtures/api-sports/<sport>` (sintéticas, a substituir).
