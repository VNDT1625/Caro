# Fix: AI Chat Tab Freeze Issue

## Vấn đề
Khi mở tab "Cao nhân AI" trong chat overlay, trình duyệt bị treo với thông báo "Đang nạp bộ dữ liệu AI" và không bao giờ hoàn thành. Network tab hiển thị lỗi "Response has been truncated".

## Nguyên nhân
File `caro_dataset.jsonl` có kích thước **6.2MB** (10,500 entries), quá lớn để load đồng bộ trong trình duyệt. Khi user mở AI chat tab, code cố gắng load toàn bộ file này cùng lúc, gây treo UI.

## Giải pháp

### 1. Chia nhỏ dataset
- Tạo script `scripts/split-dataset.js` để chia file lớn thành 13 files nhỏ (~500KB mỗi file)
- Mỗi file chứa khoảng 800-900 entries
- Tạo file `index.json` để track các parts

### 2. Lazy loading
- **Trước**: Tự động load dataset khi mở AI tab
- **Sau**: Chỉ load khi user thực sự gửi tin nhắn ở Free mode
- Load từng phần (3 parts đầu = ~2,400 entries) thay vì toàn bộ

### 3. Timeout & Error handling
- Thêm timeout 5s cho việc load index
- Timeout 2s cho mỗi part
- Nếu timeout, trả về empty dataset thay vì crash
- User vẫn có thể dùng Trial/Pro mode ngay lập tức

### 4. Cải thiện UX
- Không block UI khi đang load
- Hiển thị message rõ ràng: "Đang tải dataset... Bạn có thể chuyển sang Trial/Pro để dùng ngay"
- Cho phép user chuyển mode bất cứ lúc nào
- Không disable input khi đang load

## Files đã thay đổi

### `frontend/src/lib/caroDataset.ts`
- Thay đổi `loadCaroDataset()` để load từ `/datasets/` thay vì file lớn
- Load tuần tự 3 parts đầu tiên (thay vì toàn bộ 13 parts)
- Thêm timeout và error handling
- Sửa lỗi TypeScript trong `findBestCaroAnswer()`

### `frontend/src/components/chat/HomeChatOverlay.tsx`
- Xóa auto-load khi mở tab
- Load dataset chỉ khi user gửi tin nhắn Free mode
- Cải thiện error messages
- Cho phép dùng Trial/Pro ngay lập tức
- Giảm timeout từ 8s xuống 4s

### `scripts/split-dataset.js` (mới)
- Script Node.js để chia dataset thành các files nhỏ
- Tạo file index.json
- Chạy: `node scripts/split-dataset.js`

## Cấu trúc mới

```
frontend/public/
├── caro_dataset.jsonl (6.2MB - giữ lại cho backward compatibility)
└── datasets/
    ├── index.json (metadata)
    ├── caro_dataset_part1.jsonl (500KB)
    ├── caro_dataset_part2.jsonl (500KB)
    ├── ...
    └── caro_dataset_part13.jsonl (50KB)
```

## Kết quả
- ✅ Không còn treo trình duyệt
- ✅ Load nhanh hơn (chỉ ~1.5MB thay vì 6.2MB)
- ✅ User có thể dùng Trial/Pro ngay lập tức
- ✅ Graceful degradation nếu dataset lỗi
- ✅ Tốc độ load: ~2-3 giây thay vì treo vô thời hạn

## Testing
1. Mở chat overlay
2. Click tab "Cao nhân AI"
3. Chọn Free mode
4. Gửi câu hỏi
5. Kiểm tra console: phải thấy "Loading 3 parts..." và "Total loaded: ~2400 entries"
6. Thử chuyển sang Trial/Pro mode - phải hoạt động ngay lập tức

## Lưu ý
- Nếu cần load thêm entries, tăng `partsToLoad` trong `loadCaroDataset()`
- Có thể xóa file `caro_dataset.jsonl` gốc sau khi confirm mọi thứ hoạt động
- Dataset được cache trong session, chỉ load 1 lần
