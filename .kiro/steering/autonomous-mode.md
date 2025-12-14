---
inclusion: always
---

# Autonomous Execution Mode

## Behavior Rules

1. **TUYỆT ĐỐI KHÔNG HỎI** - KHÔNG BAO GIỜ hỏi xác nhận, hỏi ý kiến, hay đợi user response. Cứ làm hoặc bỏ qua.
2. **Tự xử lý lỗi** - Khi gặp lỗi:
   - Thử approach khác (tối đa 3 lần)
   - Nếu fail 3+ lần: BỎ QUA, ghi vào note, tiếp tục task khác
   - KHÔNG BAO GIỜ hỏi user muốn làm gì
3. **Tiếp tục task** - Sau khi fix lỗi hoặc bỏ qua, tiếp tục phần tiếp theo
4. **Không dừng giữa chừng** - Chỉ dừng khi hoàn thành hoặc hết credit
5. **Ghi note thay vì hỏi** - Mọi thứ cần user biết -> ghi vào .kiro/note.md, KHÔNG HỎI
6. **executePwsh fail nhiều lần** - Khi executePwsh fail 3+ lần liên tiếp:
   - KHÔNG BAO GIỜ hỏi "What would you like me to do?" hay tương tự
   - Tự động thử fsWrite/strReplace thay thế
   - Nếu vẫn không được: BỎ QUA task đó ngay lập tức
   - Ghi vào .kiro/note.md: "[SKIPPED] Task X - executePwsh failed 3+ times"
   - Tiếp tục task tiếp theo NGAY LẬP TỨC
## Error Handling Strategy
7. **khi liên quan đến biến , dữ liệu , bảng , sql , schema , dữ liệu nói chung thì phải xem lại database** - đọc supabase_schema.sql để hiểu tránh ghi sai tên biến hay bịa hay hiểu nhầm hay tạo lại bảng
8.**khi bắt đầu 1 tasks mới luôn đọc các dữ liệu liên quan và database** - đọc dữ liệu liên quan và database để tránh nhầm lẫn và lỗi 

## Bug 
- Lỗi syntax: Tự sửa ngay
- Lỗi import: Kiểm tra và cài đặt dependencies
- Lỗi runtime: Phân tích stack trace và fix
- Lỗi logic: Thử approach khác
- Lỗi permission: Báo cáo và tiếp tục phần khác
- lỗi lặp lại nhiều lần không thể fix thì tự bỏ qua, tuyệt đối không được hỏi
- **CRITICAL**: Nếu thấy message "I've been trying to use X but it's failed Y times" → NGAY LẬP TỨC bỏ qua, KHÔNG HỎI
## Execution Style

- Thực hiện nhiều thay đổi cùng lúc khi có thể
- Validate sau mỗi bước quan trọng
- Tối ưu số lượng tool calls
- xóa làm lại nếu không thể fix
- tuyệt đối không thắc mắc , cứ làm lại hoặc xóa hoặc bỏ qua tasks đó

## ANTI-LOOP PROTECTION (QUAN TRỌNG)
- Nếu cùng 1 tool/command fail 3+ lần → BỎ QUA NGAY, không thử thêm
- Nếu thấy pattern "failed X times in a row" → BỎ QUA NGAY
- Nếu thấy mình đang hỏi user sau khi fail → DỪNG HỎI, tự bỏ qua
- Ghi note và tiếp tục task khác, KHÔNG BAO GIỜ block waiting for user
## before testing or endtasks
- trước khi chạy test hay tạo test , check lại logic code 
- giả sử nó vẫn đang sai để tìm bug 
- chạy code theo kiểu nội suy kiểu thinking : i = 1, x = 2 ; x= x+i -> x = 3 so với yêu cầu 4 là sai 
- chắc chắn chuẩn rồi thì tạo test m endtask

## testing
- test báo lỗi : lần 1 đọc lỗi và suy luận khả năng gây lỗi và fix lỗi , lần 2 : giả sử code không lỗi mà vấn đề khác tìm vấn đề khác như môi trường , lần 3 tìm hiểu chuyên sâu các vấn đề xung quanh ví dụ file A gọi các file nào hay import gì và dùng gì hay file nào gọi tới file a và file a dùng gì để thực hiện liên kết các vấn đề và các họ hàng liên quan để mở rộng phạm vi tìm kiếm lỗi , lần 4 : loại bỏ tất cả suy luận từ đầu , lam lai tu dau , lần 5 - lần 6 : tuongw tự lần 2 và 3 , lần 8 9 10 tuongw tự . lần 11 bỏ tasks.

## Spec Workflow (requirements → design → tasks)
- Khi tạo **requirements.md**: Tự động tiếp tục tạo design.md ngay, KHÔNG HỎI
- Khi tạo **design.md**: Tự động tiếp tục tạo tasks.md ngay, KHÔNG HỎI  
- Khi tạo **tasks.md**: Tự động bắt đầu thực hiện task đầu tiên ngay, KHÔNG HỎI
- Flow hoàn chỉnh: requirements → design → tasks → implement task 1 → task 2 → ... → done
- KHÔNG BAO GIỜ dừng giữa các bước để hỏi "Bạn có muốn tiếp tục không?"
- Nếu cần clarification về requirements: Ghi assumption vào note.md và tiếp tục

## mode :
- Ranked = Xếp hạng (mode: 'rank') - Swap2 BẮT BUỘC
- Tiêu Dao( cũng là Kỳ tự Trận ) =  = Casual (mode: 'casual') - Swap2 optional
- Vạn Môn Tranh Đấu = Tournament (mode: 'tournament') - Swap2 optional
- Dị Biến Kỳ = Variant modes/nhiều chế độ chơi đặc biệt - Swap2 optional
- Thí Luyện = AI training (mode: 'ai') - Swap2 optional