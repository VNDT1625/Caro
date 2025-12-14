# Caro Skill 60 - Task board

Nguon tham chieu: `docs/skill.md`, `design.md`, `requirements.md`.

## Pham vi va nhiem vu chinh
- [ ] Data skill 60: chuan hoa danh sach (id, ten, element, do hiem, mana, CD, dieu kien, hieu ung lan/counter) thanh JSON/TS/PHP seeder; tao schema Supabase/Bunke (tables: skills, skill_decks, skill_effects_log).
- [ ] Mana/retention: implement ManaService (init 5, +3/turn, cap 15), chi phi giu bai theo rarity (common 1, rare 2, ultra 3), tru mana khi dung skill.
- [ ] Deck rules: DeckService validate 15 skill/nguong rarity (>=10 thuong, 5 tay chon voi gioi han hiem/cuc hiem), luu/tao preset theo user.
- [ ] SkillEngine60: thuc thi 60 skill (dieu kien, target, board transform, buff/debuff, cooldown), tra ve SkillEffectResult; ham canUseSkill + getRandomSkills (seed theo match/turn + retainedSkills).
- [ ] Spread logic: EffectTracker/ElementService xu ly 5 skill lan (lua/bang/ri/ha thach/gam sat), random lan moi turn, ket thuc sau 5 luot; co neutralize theo ngu hanh (counter element, radius 3x3, 5-turn window).
- [ ] Cooldown handling: ghi/giarm CD (Hoi Quy, Hoi Khong, Hoi Nguyen), khong ap dung cho skill 1-lan; track per-user/per-match state.
- [ ] Socket server: su kien `skill_options`, `skill_use`, `skill_effect`, `skill_retain`, `mana_update`, `spread_tick`; verify token Supabase; dong bo voi board/moves va forfeits.
- [ ] Backend API: endpoints CRUD deck, start match with deck, ghi log skill effect; them Series/Match metadata (deck id, skill seed) de phuc vu replay/AI.
- [ ] Frontend deck builder: UI chon 15/60 skill, filter theo element/do hiem, hien ty le drop, validate gioi han hiem/cuc hiem; luu preset.
- [ ] Frontend in-match: panel 3 skill random/turn, nut dung/giu/bo qua, hien mana bar, cooldown, element indicator, overlay hieu ung (block, freeze, burn, rock, poison, swap), counter hint.
- [ ] Counter UI/logic: hien canh bao neu dang co effect khac khac hanh, nut kich hoat skill giai (5 skill neutralize) voi radius 3x3 + turn window.
- [ ] Persistence + recovery: luu state (mana, cooldowns, active effects, retained cards) de reconnect; server phat spread_tick de client dong bo.
- [ ] Tests backend: PHPUnit cho ManaService/DeckService/SkillEngine60/ElementService, property-based cho spread random, contract test socket events.
- [ ] Tests frontend: unit cho hook skill state, component tests panel/deck builder, e2e flow dung Playwright/Cypress (chon deck -> vao tran -> dung skill -> reconnect).
- [ ] Observability: log skill_use/skill_effect, metrics cho lan spread, canh bao neutralize fail; feature flag bat/tat skill 60 tren prod.
- [ ] Security/validation: saniti target input, chan skill use khi khong du mana/dieu kien board, chong spam socket (rate-limit).

## Thu tu uu tien
1) Core engine (ManaService + DeckService + SkillEngine60 + spread + cooldown).  
2) Socket contract + backend API/state persistence.  
3) Frontend in-match UI + deck builder.  
4) Counter/element logic + neutralize.  
5) Tests + observability + flag.

## Tinh trang
- Tat ca muc tren: TODO (chua implement). Hoan thanh tung muc thi cap nhat danh dau [x].
