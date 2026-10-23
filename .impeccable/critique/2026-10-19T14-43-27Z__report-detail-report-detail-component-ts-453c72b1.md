---
target: report detail plan 5 additions
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:D:\\Project\\Jaeng\\apps\\web\\src\\app\\features\\report-detail\\report-detail.component.ts"
target_fingerprint: "sha256:1d6d790361711720723f2dce797050587acf144e941cc30aca1d3722a20158cf"
target_path: "D:\\Project\\Jaeng\\apps\\web\\src\\app\\features\\report-detail\\report-detail.component.ts"
timestamp: 2026-10-19T14-43-27Z
slug: report-detail-report-detail-component-ts-453c72b1
---
⚠️ DEGRADED: single-context (owner instruction 2026-10-19: the controller does the work itself to save tokens and asks no questions mid-plan)

Target: report detail, plan 5 additions (fix claim, ⋯ menu, content reports). Checked at 375×812 and 1440×900 through DOM measurements, two screenshots, psql and the detector.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | role=status thanks lines; fix_claimed waiting line with icon |
| 2 | Match system / real world | 4 | neighbour voice, plain reasons |
| 3 | User control and freedom | 3 | cancel restores the row and focus; Escape on the panel still closes everything, including a half-written claim |
| 4 | Consistency and standards | 3 | menu reuses the account-menu grammar; forms reuse the report-flow photo buttons |
| 5 | Error prevention | 3 | reason required, 500 cap, one send |
| 6 | Recognition rather than recall | 3 | copy link now one tap deeper in ⋯ |
| 7 | Flexibility and efficiency | 2 | no shortcuts beyond keyboard order |
| 8 | Aesthetic and minimalist design | 3 | me-too keeps a full line; second line fix + ⋯ |
| 9 | Error recovery | 3 | API messages in role=alert inside the form; stale claims reload the report |
| 10 | Help and documentation | 2 | captions only |
| **Total** | | **29/40** | Good |

Design specificity: inside the incumbent world (Card White, Trust Blue, Lucide, 14 px radii); the Cream inset for inline forms matches the composer. Detector: source scan 3 `broken-image` hits, all Angular `[src]` bindings (false positives); page scan 1 `dark-glow` = the beacon Glow (allowed by DESIGN.md One Light rule).

Priority issues
- [P1, fixed] At 375 px "เจอเหมือนกัน · N" wrapped onto two lines beside "แจ้งว่าแก้แล้ว". Me-too now keeps a full line; fix + ⋯ share the second.
- [P2, fixed] For fix_claimed the ⋯ button sat alone above the waiting caption; the caption now shares its line.
- [P2, fixed] After an admin hid a report the map said "ไม่พบเรื่องนี้…"; the panel now passes "ซ่อนเรื่องนี้แล้ว".
- [P2, fixed] Focus fell to <body> after a successful claim (the fix button disappears); it now falls back to ⋯.
- [P3, deferred] On a level-3 report the action rows sit below the 64% sheet edge (pre-existing, roadmap plan 8 item). The ⋯ popover then opens at the bottom edge until the sheet is scrolled.

Questions skipped: owner instruction (no questions mid-plan); fixes applied directly.
