### 1. Grid & Layout

- Desktop:
  - Container: max-width 1280px, margin auto.
  - Grid: 12 cột, mỗi cột ~80–96px, gutter 24px.
  - Padding ngoài (page): 24–32px.
- Tablet (≥768px < 1024px):
  - Grid 8 cột, gutter 16–20px.
- Mobile (<768px):
  - Layout 1 cột, các panel xếp dọc, priority: in-match > quick actions > chat > menu.
- Khoảng cách chuẩn (spacing scale – dùng 8px làm base):
  - 4 / 8 / 12 / 16 / 24 / 32 / 48.
  - Quy tắc: 
    - Padding trong component: 8–16px.
    - Khoảng cách giữa component: 16–24px.
    - Khoảng cách lớn đặc biệt (block lớn): 32–48px.

### 2. Typography (font chữ)

- Font: sans-serif modern, nét hơi vuông (giống game): ví dụ `Poppins`, `Inter` hoặc `Nunito`.  
- Size (desktop):
  - H1 (tiêu đề lớn, landing): 32–40px, line-height 1.2.
  - H2 (tên panel, mode): 24px, line-height 1.3.
  - H3 (subheading trong panel): 18–20px.
  - Body chính: 14–16px, line-height 1.4–1.6.
  - Caption / label nhỏ: 12–13px.
- Quy tắc:
  - Không dùng quá 3 cấp size trong 1 màn hình để tránh loạn.
  - Rank, Gem, Coin, timer dùng font số rõ ràng; có thể dùng font monospace cho timer.

### 3. Màu sắc & token

Đặt hệ màu thành token để dùng lại:

- `--color-bg` (nền chính).
- `--color-surface` (panel).
- `--color-surface-elevated` (panel nổi hơn, như quick room).
- `--color-primary` (nút chính, highlight).
- `--color-secondary` (nút phụ, chip).
- `--color-accent-spiritual` (hiệu ứng tiên hiệp: pháp trận, glow).
- `--color-danger`.
- `--color-text-main`.
- `--color-text-muted`.
- `--color-border` (border nhẹ).

Quy tắc:

- Một màn hình không dùng quá 3 màu đậm khác nhau cho component chính (primary, secondary, danger). Background, border là sắc độ của các màu này.
- Tỉ lệ contrast text với nền đạt tối thiểu 4.5:1 cho text nhỏ.

### 4. Components chuẩn

#### 4.1. Button

Loại:

1. Primary (CTA chính, ví dụ GHÉP TRẬN):
   - Height: 48–56px.
   - Full width hoặc min-width 160px.
   - Background: `--color-primary`, text trắng.
   - Radius: 999px hoặc 16px (consistent).

2. Secondary (nút trong panel, ví dụ PvP, Bot Fight):
   - Background: glass, border `--color-primary` mờ.
   - Text `--color-text-main`.

3. Ghost / Text button (link nhỏ, “Xem chi tiết”, “Hủy”):
   - Không có nền, chỉ text + icon.

State:

- Default / Hover / Pressed / Disabled:
  - Hover: tăng brightness 8–12%, shadow nhẹ.
  - Pressed: tối hơn một chút, dịch xuống 1–2px.
  - Disabled: opacity ~0.5, không shadow.

#### 4.2. Panel / Card

- Radius 16–24px.
- Padding trong: 16–24px.
- Shadow: mềm, blur 30–40, offset 0, opacity 0.25–0.3.
- Header panel có icon nhỏ bên trái tiêu đề.

#### 4.3. Input (chat, form)

- Height: 40–44px.
- Border radius: 999px (chat) hoặc 12px (form).
- Border: 1px `--color-border`; focus: border `--color-primary` + glow nhẹ.

### 5. Icon & hình ảnh

- Style: line icon + fill nhẹ, góc bo tròn, không quá chi tiết.
- Kích thước chuẩn: 20 / 24 / 32px.
- Các icon quan trọng (rank, mode) nên có illustration riêng trong style anime/tiên hiệp (vũ khí, pháp trận).

### 6. UI trong trận (2D/3D board)

- Board luôn là trung tâm, chiếm 55–65% chiều ngang container.  
- Tỷ lệ:
  - Board vuông, giữ khoảng cách an toàn 24–32px với cạnh màn hình.
- 2D mode:
  - Grid đơn giản, đường kẻ 1–2px, màu xám nhạt trên nền hơi xanh.
  - X/O hoặc quân nên có viền rõ, không hòa vào nền.
- 3D mode:
  - Dùng camera isometric, không nghiêng quá mạnh để ô vẫn dễ click.
  - Quân cờ nổi nhưng bóng đổ mềm, không che grid quá nhiều.

UX:

- Click vào ô: highlight hover (viền sáng) trước khi đặt nước.
- Nước cuối cùng: có viền/hào quang rõ, giúp người xem bắt kịp diễn biến.
- Có setting “Đơn giản hóa hiệu ứng” cho máy yếu.

### 7. Animation & âm thanh

- Animation UI:
  - Thời gian: 150–250ms (fade/slide).
  - Không dùng animation loop quá nhanh dễ mỏi mắt.
  - Popup: scale từ 0.96 → 1.0, opacity 0 → 1.

- Âm thanh:
  - Vol mặc định nhỏ, có slider chỉnh.
  - SFX: click nhẹ, không chói tai; thắng/thua có nhạc riêng nhưng không kéo dài >3–4s.

### 8. Trạng thái đặc biệt (error, loading, empty)

- Loading tìm trận: overlay mờ + spinner + text “Đang tìm đối thủ… (xxs)”.
- Empty state (chưa có bạn, chưa có event): illustration nhỏ + text hướng dẫn + CTA (ví dụ “Thêm bạn bằng ID”).

---