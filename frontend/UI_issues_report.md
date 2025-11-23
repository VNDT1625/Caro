**Tổng quan**

- **Mục tiêu:** Đọc mã frontend và nêu các vấn đề UI hiện tại, nguyên nhân gốc, và hướng khắc phục tiếp theo.
- **Vị trí file chính đã kiểm tra:** `src/App.tsx`, `src/pages/*` (Home, Lobby, Room, Shop), `src/components/*` (Board, ShopGrid), `styles.css`, `public/index.html`, `package.json`, `src/main.tsx`.

**Các lỗi / vấn đề UI chính (kèm file tham chiếu)**

- **1) Thừa lớp `app-container` (lồng lặp layout):**
  - File tham chiếu: `src/App.tsx` và nhiều trang (`src/pages/Home.tsx`, `Lobby.tsx`, `Room.tsx`, `Shop.tsx`).
  - Mô tả: `App.tsx` đã bọc toàn bộ UI bằng `<div className="app-container">` trong khi mỗi trang lại cũng bắt đầu bằng `<div className="app-container">`. Kết quả là padding/margin bị nhân đôi, layout bị canh lệch, chiều rộng tối đa và căn giữa bị ảnh hưởng.
  - Hậu quả: header và phần nội dung không đồng nhất; khó điều chỉnh spacing toàn cục; khi thử responsive sẽ thấy khoảng trắng lớn dư thừa.

- **2) Cấu trúc layout không tách rõ "shell" và "page content":**
  - File tham chiếu: `src/App.tsx`, nhiều trang.
  - Mô tả: header, nav được đặt trong `App`, nhưng pages cũng tự bọc lại container; nên không dễ để thay đổi bố cục (ví dụ muốn header full-width, content constrained). Thiếu một vùng `main`/`page-inner` tiêu chuẩn.

- **3) `.panel` có `min-height: 520px` cứng (styles.css):**
  - File: `styles.css`.
  - Mô tả: Khối `.panel` đặt `min-height: 520px` gây ra chiều cao quá lớn trên màn hình nhỏ (mobile) hoặc khi nội dung ít. Điều này khiến layout trông cồng kềnh trên nhiều viewport.

- **4) Bảng cờ (`Board`) không responsive / kích thước cố định:**
  - File: `src/components/Board.tsx`, `styles.css` (board-grid/cell).
  - Mô tả: Grid cố định `grid-template-columns:repeat(15,28px)` và ô `28px` — sẽ tràn màn hình nhỏ. Không có điều chỉnh kích thước ô theo chiều rộng thiết bị.
  - Hậu quả: trên mobile, bảng sẽ bị overflow ra ngoài hoặc lộ scrollbar, trải nghiệm chơi kém.

- **5) Thẻ `Card` trong `ShopGrid` dùng `width: 220px` cố định:**
  - File: `src/components/ShopGrid.tsx`.
  - Mô tả: Card rộng cố định sẽ làm layout không linh hoạt; khi thu nhỏ màn hình, wrapping có thể không đẹp. Dùng `flex` + `min-width`/`flex-basis` sẽ tốt hơn.

- **6) Nhiều inline styles rải rác — khó bảo trì & inconsistent theme:**
  - File: `ShopGrid.tsx`, các trang khác, `App.tsx` header wallet styling là inline.
  - Mô tả: Dễ dẫn tới style không nhất quán, khó sửa khi muốn đổi màu chủ đề. Nên dùng class + biến CSS (`--color-*`) đã có.

- **7) Navigation dựa vào `window.location.hash` (brittle):**
  - File: `src/App.tsx`.
  - Mô tả: Điều hướng bằng hash đơn giản nhưng code hiện tại lẫn lộn giữa state và hash (double-sourced). Đây không phải lỗi UI trực tiếp nhưng gây UI inconsistent khi hash và state không đồng bộ.

- **8) Truyền dữ liệu & trạng thái (UX):**
  - File: `Lobby.tsx`, `Room.tsx`.
  - Mô tả: Khi thực hiện fetch API, không có spinner hoặc trạng thái loading rõ ràng (chỉ text tĩnh), khiến người dùng không biết tiến trình. Ngoài ra, các thông báo lỗi hiện dưới dạng `message` text màu muted — cần hiển thị rõ hơn.

- **9) Accessibility / a11y:**
  - Nhiều nút và avatar không có `aria-label`/`alt`. Keyboard focus không rõ ràng. Các vùng `role="button"` nhưng thiếu `onKeyDown` cho Enter/Space.

**Ưu tiên khắc phục (Prio + hành động cụ thể)**

- **Ưu tiên Cao (hotfix, test ngay):**
  - A1: Xóa/làm mới lớp `app-container` trên các trang (Home/Lobby/Room/Shop). Thay thế bằng `className="page-inner"` hoặc không bọc nếu không cần. (Files: `src/pages/*.tsx`)
    - Lý do: sửa ngay lỗi spacing/căn giữa, dễ test.
    - Gợi ý sửa nhanh: Trong mỗi trang, thay `<div className="app-container">` thành `<div>` hoặc `<div className="page-inner">` (và thêm CSS `.page-inner{padding:0}` nếu cần).
  - A2: Thay đổi `.panel` để bỏ `min-height:520px` hoặc dùng media query để giảm min-height trên mobile. (File: `styles.css`)
    - Ví dụ: `.panel{min-height:unset;min-height:320px}` hoặc `@media (min-width:900px){ .panel{min-height:520px} }`.

- **Ưu tiên Trung bình:**
  - B1: Làm cho `Board` responsive: dùng `grid-template-columns: repeat(var(--board-size), minmax(20px, 1fr))` hoặc tính `cell` dựa theo container width và media queries. (Files: `Board.tsx`, `styles.css`)
  - B2: Thay `width:220px` trong `ShopGrid` bằng `flex-basis: 220px; min-width: 180px;` và sử dụng container `gap` + `justify-content:flex-start` để layout tốt hơn.
  - B3: Rút các inline styles vào className và dùng biến màu trong `styles.css` để duy trì theme.

- **Ưu tiên Thấp / Nâng cao:**
  - C1: Thay hash routing bằng `react-router` (nếu muốn routing chuẩn) hoặc tạo một wrapper navigation hook để đồng bộ state/hash.
  - C2: Cải thiện a11y: thêm `aria-label`, hỗ trợ keyboard cho `role="button"`, thêm focus styles.
  - C3: Thêm spinner/loading component trong `Lobby` và `Room` khi gọi API; hiển thị lỗi rõ ràng.

**Bản sửa mẫu (snippets đề nghị)**

- Sửa nhanh `Home.tsx` (ví dụ):

```diff
-<div className="app-container">
+<div className="page-inner">
```

- Sửa `styles.css` cho `.panel` responsive:

```css
/* trước */
.panel{ min-height:520px; }

/* sau */
.panel{ min-height:unset; min-height:320px; }
@media(min-width:900px){ .panel{ min-height:520px } }
```

- Làm `Board` responsive (gợi ý trong CSS):

```css
.board-grid{ display:grid; grid-template-columns: repeat(15, minmax(18px,1fr)); gap:4px; max-width: 560px; }
@media(max-width:480px){ .board-grid{ grid-template-columns: repeat(15, minmax(12px,1fr)); max-width:320px } }
.cell{ aspect-ratio:1 / 1; width:100%; }
```

**Checklist kiểm thử sau sửa**

- [ ] Chạy `npm install` (nếu chưa) rồi `npm run dev` trong `frontend`.
- [ ] Mở trang ở desktop (1280x800) kiểm tra spacing header + center panel.
- [ ] Thu nhỏ cửa sổ đến mobile breakpoint (<=900px) kiểm tra collapse `.grid-3` thành 1 cột, carousel height, panel height.
- [ ] Mở Room -> kiểm tra Board hiển thị không tràn, thao tác click vẫn hoạt động.
- [ ] Mở Shop -> kiểm tra cards wrap đẹp, không overflow.

Lệnh khởi động dev (Windows cmd):

```cmd
cd c:\PJ\caro\frontend
npm install
npm run dev
```

**Các file nên chỉnh (đề nghị sửa):**
- `src/pages/Home.tsx` (xóa `app-container` hoặc đổi class)
- `src/pages/Lobby.tsx` (xóa `app-container` nếu ở page level)
- `src/pages/Room.tsx`
- `src/pages/Shop.tsx`
- `src/components/Board.tsx` + `styles.css` (board styling)
- `src/components/ShopGrid.tsx` (card sizing)
- `styles.css` (panel min-height, responsive tweaks)

**Gợi ý bước tiếp theo (ưu tiên ngắn hạn):**
1. Thực hiện hotfix A1 + A2 (xóa `app-container` trùng và giảm min-height `.panel`).
2. Chạy dev server và kiểm tra 3 breakpoint (desktop/tablet/mobile).
3. Tiếp tục với Board responsive và ShopGrid responsive.
4. Sau khi UI core ổn, cân nhắc refactor navigation (router) và a11y.

Nếu muốn, mình có thể:
- Áp patch trực tiếp xóa `app-container` trong các trang và tạo CSS cập nhật (tự động),
- Hoặc tạo PR mẫu với các thay đổi nhỏ (hotfix) để bạn review.

— Kết thúc báo cáo. File này được lưu tại: `frontend/UI_issues_report.md`.
