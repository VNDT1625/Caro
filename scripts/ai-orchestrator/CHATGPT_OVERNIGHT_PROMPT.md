# ChatGPT Overnight Prompt - Caro Project (2025-12-04)

## Luu y bat buoc
- Luon viet tieng Viet (khong dau cung duoc), khong hoi user, tu dong lam cho den khi het viec.
- Doc code/schemas truoc khi sua, giu lai cac thay doi cua user, khong revert.
- Tu cap nhat `scripts/ai-orchestrator/gpt_status.json` va `gpt_progress.md` sau moi moc quan trong.
- Tests: uu tien chay nhanh bang cac file lien quan; neu can toan bo backend dung `./vendor/bin/phpunit`.

## Tong quan stack
- Frontend: Vite + React + TS (`frontend/`), Supabase client trong `src/lib`.
- Server realtime: Node.js Socket.IO (`server/`).
- Backend PHP: mini front controller o `backend/public/index.php`, tests PHPUnit.
- AI: FastAPI stub (`ai/`).
- DB: Supabase/PostgreSQL, schema mau xem `caro - Copy/infra/supabase_schema.sql`.

## Trang thai hien tai
- Backend phpunit: PASS (7 skipped do AI Bridge khong co service/key).
- ReportService co flag `setAutoProcessEnabled(false)` de giu status pending trong IntegrationTest.
- RoomApiTest dang fake API noi bo bang storage JSON trong `backend/storage/phpunit_rooms.json`.

## Uu tien cong viec (thu tu)
1) Ranked BO3 backend: hoan thien ScoringEngineService, RankManagerService, SeriesController + integration hooks (Phase 2-3). Doc spec `.kiro/specs/ranked-bo3-system/tasks.md`.
2) Ranked BO3 frontend (Phase 4-5) neu co thoi gian: components Series UI, rematch flow.
3) Fix AI chat dataset loading (lazy/worker/cache) theo `.kiro/specs/fix-ai-chat-dataset-loading/requirements.md`.
4) AI analysis Phase 8 tasks (mistake_analyzer, lesson_generator, alternative_lines, numba/parallel/redis, tests).

## Cach lam
1. Doc file lien quan truoc (interfaces, tests).
2. Code dung ASCII, theo style repo (2-space, single quotes cho frontend).
3. Sau khi sua: chay tests tuong ung (phpunit file don, hoac toan bo neu co thay doi lon).
4. Cap nhat `gpt_status.json` (status, current_task, last_update, completed_tasks) va ghi log session vao `gpt_progress.md`.
5. Neu gap loi do thieu service (AI), bo qua khong chan flow, ghi chu ro.

## Lenh nhanh
- Backend unit: `cd backend && ./vendor/bin/phpunit tests/<File>.php`
- Backend full: `cd backend && ./vendor/bin/phpunit`
- Frontend typecheck: `cd frontend && npx tsc --noEmit`
- Frontend test: `cd frontend && npm test -- --run`
- AI tests: `cd ai && python -m pytest tests/ -v`

## Checklist truoc khi ket thuc session
- [ ] Code pass lint/tests tuong ung
- [ ] Trang thai cap nhat vao gpt_status.json
- [ ] Them entry moi vao gpt_progress.md
- [ ] Ghi ro cac test skipped/blocker (neu co) trong message_for_kiro
