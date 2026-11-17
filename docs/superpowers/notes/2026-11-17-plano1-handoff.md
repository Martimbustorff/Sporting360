# Plano 1: passagem para o Plano 2 (extraído do ledger SDD, 17/11/2026)

## Decisões (rulings)
- Rulings:
- Ruling: Task 1 Step 1 creates `archive/v1-app` locally only; push deferred to Martim — push to shared remote — cost: none (branch recreatable from origin/main).
- Ruling: Task 2 parked until Martim authorises GCP source download; Task 7 uses live field names captured above instead — Task 2 only provides reference — cost if wrong: Plan 2 lacks legacy reference, recoverable later.
- Ruling: Task 7 adapter reads optional `status` (API-Football short code) and `finishedAt` (ISO string or Timestamp) fields that Plan 2 will add to `games`; fallback when absent: isActive true → LIVE (elapsed from elapsedTime); not active & now < startTime → NS; not active & now >= startTime & elapsedTime >= 90 → FT with finishedAt = endTime; otherwise NS. sportingSide from teamhome.api == '228'. Ratings parsed with parseFloat, NaN→null — cost if wrong: settlement timing off until Plan 2 adds status.
- Ruling: Task 3 Step 6 and Task 11 Steps 2,3,5 are stop points (production/secret/push) — executed only with Martim's explicit OK.
- Ruling: legacy predictionsSettlementScheduler (*/5) awards +3 to `rankings` + `point_events` for predictions where scored==false. Task 9 submitPrediction must NOT write a `scored` field (so legacy ignores v2027 docs) — carry into Task 9 dispatch — cost if wrong: v2027 predictions also credit the V2 board.
- Ruling (Martim): repo always private; no key rotation. Protection = keys never in new code (Secret Manager RAPIDAPI_KEY, Task 11), remove ex-dev access, monitor RapidAPI usage. README rotation notice to be softened to 'recomendado' later (minor).
- Ruling: (1) fix round on Task 9: rules predictions create adds `!('source' in request.resource.data)` + rules test; also recover participation point in already-exists branch when existing doc is source v2027 & userId==uid. (2) Task 10 settles ONLY docs with matching server-written pointEvents `{uid}_{gameId}_prediction_participation` / `_mvp_participation` (defence in depth) — carry into Task 10 dispatch — cost if wrong: farmable exact-score points.
- Ruling: Task 11 Step 3 deploy target name is `settleScheduler` (plan said functions:settle) — plan defect — cost if wrong: deploy command fails harmlessly
- Ruling: Task 11 Step 2 (RAPIDAPI_KEY secret) deferred to Plan 2 — Plan 1 code makes no API-Football calls, and Martim declined rotation — cost if wrong: none for Plan 1
- Ruling: Task 3 rules (Step 6) and Task 11 functions deploy are NOT deployed in Plan 1; both ship with Plan 2 once legacy data writers move to Admin SDK and games/players are closed — C1/I1 — cost if wrong: engine goes live ~1-2 weeks later (no user impact; v2027 app ships in Plan 4/5).
- Ruling: v2027 predictions move to a NEW collection `matchPredictions/{gameId}_{uid}` (client read-only), like mvpVotes — removes V2 doc-id collision (M1) and any legacy-scheduler interaction — cost if wrong: rename later.
- Ruling: plan cutover (Plan 5) wipes pointEvents/leaderboards/settlements/matchPredictions/mvpVotes written before go-live ("todos começam a 0") — I1 — cost if wrong: none.

## Verificações obrigatórias antes de publicar
- Task 3: minor (deferred): Step 6 smoke test must include PIN-login → gamebox edit
- Task 3: pre-deploy check (Step 6): confirm all prod rankings docs have `season` and id == userId_season, else V2 updates on them are denied
- Task 9: pre-deploy check: no prod predictions/manofmatch docs with a `source` field exist before deploying (mvpVotes already client read-only)

## Pendentes menores (para triagem no Plano 2)
- Task 3: minor (deferred→folded into fix 1): '_' in uid prefix/suffix spoof; update must check resource.data.userId == uid
- Task 3: minor (deferred): unlimited +1 inflation is accepted phase-1 risk — document in rules header
- Task 3: minor (deferred): V2 writes email as userName into public rankings — fix at cutover
- Task 3: minor (deferred): Step 6 smoke test must include PIN-login → gamebox edit
- Task 3: minor (deferred): idEndsWithUid accepts empty gameId '_uid' (harmless)
- Task 4: minor (deferred): periods test 'Monday in Lisbon' uses Nov instant (Lisbon=UTC) — add summer instant 2026-07-12T23:30Z (W29) and 2026-12-27T23:30Z/2026-12-28T00:00Z W52/W53 pair
- Task 4: minor (deferred): add winter-month season cases (Dec→2026-2027, Jan 2027→2026-2027)
- Task 4: minor (deferred): comment on toZonedTime local-getter pattern in periods.ts
- Task 4: minor (deferred): countedScore tests for PEN/AET/FT with null goals
- Task 5: minor (deferred): add LIVE elapsed 95/105 test (ET stays open)
- Task 2: minor (deferred): README should say legacy/ does not compile standalone (dangling imports to omitted firebase/config/videos)
- Task 2: minor (deferred): classify long literals in omitted firebase.ts/videos.ts before Plan 2 handoff
- Task 6: minor (deferred): add NaN rating test in mvp.test.ts
- Task 2: minor (deferred): commit msg says "redacted" but content is omission
- Task 7: minor (deferred→folded): drop 2 extra timestamp queries (prod timestamp is always Timestamp)
- Task 7: minor (deferred): header note — legacy endTime = kickoff+150min estimate, isActive window, fallback settles ~kickoff+4.5h; >7-day unsettled games never retried; Title Case only after whitespace; limit(1) on duplicate api docs
- Task 7: minor (deferred): snaps one-element array style in listFinishedUnsettled; numeric timestamp docs silently skipped
- Task 8: minor (deferred): validate uid/gameId non-empty & no '/', gameId 'none' collision; throw on periods:[]; guard NaN gameDate / unknown kind; past-period displayName not refreshed
- Task 9: minor (deferred): move validGameId to callables/validation.ts; window check outside transaction (sub-second kickoff race)
- Task 10: minor (deferred): settleGame overwrites settledAt if called directly on a settled game
- Task 10: minor (deferred): getGameState null skipped without warn
- Final fix wave: re-review clean (7/7 addressed). Parked: plan text ~line 260 still says predictions/{gameId}_{uid} (now matchPredictions) — fix when Plan 2 is written.
