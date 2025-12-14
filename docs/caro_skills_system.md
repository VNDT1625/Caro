# 🎮 CARO SKILL - HỆ THỐNG GAME HOÀN CHỈNH

## 📖 QUY TẮC GAMEPLAY CƠ BẢN

### Mục Tiêu
Tạo **5 quân liên tiếp** (ngang/dọc/chéo) trên bàn cờ 15x15 để giành chiến thắng, kết hợp với việc sử dụng skill chiến thuật.

### Cơ Chế Lượt Chơi

#### Chuẩn Bị Trước Trận
- Mỗi người chơi chọn **20 skill** từ 65 skill có sẵn → tạo **DECK cá nhân**
- Khi vào game, từ deck 20 skill sẽ **random 3 skill** hiển thị trên tay

#### Diễn Biến Mỗi Lượt
1. **Bắt đầu lượt**: Người chơi thấy 3 skill random từ deck của mình
2. **Hành động** (thứ tự linh hoạt):
   - **Đặt quân CỜ** (bắt buộc) VÀ/HOẶC
   - **Dùng 1 SKILL** (tùy chọn, nếu đủ mana)
   - **Thứ tự tùy trường hợp**:
     - Có thể dùng skill TRƯỚC rồi đặt quân SAU
     - Có thể đặt quân TRƯỚC rồi dùng skill SAU
     - **Điều kiện kết thúc lượt**: CẢ 2 hành động (đặt quân + dùng/bỏ qua skill) hoàn thành
3. **Kết thúc lượt**: 
   - Hồi +3 mana (tối đa 15)
   - Random lại 3 skill mới từ deck (thay thế 3 skill cũ)
   - Chuyển lượt cho đối phương

#### Ví Dụ Thực Tế
**Tình huống 1**: Người chơi muốn phá 1 quân địch rồi mới đặt quân
- Bước 1: Dùng **Sấm Sét** (4 mana) → phá quân địch → ô trống
- Bước 2: Đặt quân CỜ vào ô vừa phá
- → Kết thúc lượt

**Tình huống 2**: Người chơi muốn đặt quân trước rồi bảo vệ
- Bước 1: Đặt quân CỜ
- Bước 2: Dùng **Bảo Hộ** (10 mana) → bảo vệ quân vừa đặt
- → Kết thúc lượt

**Tình huống 3**: Không đủ mana hoặc không muốn dùng skill
- Bước 1: Đặt quân CỜ
- Bước 2: Bỏ qua dùng skill
- → Kết thúc lượt (vẫn hồi mana)

### Điều Kiện Thắng
- Tạo hàng 5 quân liên tiếp (không bị chặn 2 đầu)
- Đối phương không còn nước đi hợp lệ
- **LƯU Ý**: Quân được biến đổi bởi skill (vd: Nguyên Hóa) không tính vào điều kiện thắng ngay lập tức

---

## 💎 HỆ THỐNG MANA

| Thông Số | Giá Trị |
|----------|---------|
| **Mana khởi đầu** | 5 mana |
| **Hồi mỗi lượt** | +3 mana |
| **Mana tối đa** | 15 mana |
| **Skill không tốn mana** | Không, tất cả skill đều tốn mana |

### Phân Loại Chi Phí Mana
- **Skill cơ bản (1-3 mana)**: Hiệu ứng đơn giản, tức thời
- **Skill trung cấp (4-6 mana)**: Hiệu ứng theo lượt, phạm vi vừa
- **Skill cao cấp (7-10 mana)**: Hiệu ứng mạnh, phạm vi lớn
- **Skill ultimate (11-15 mana)**: Thay đổi cục diện trận đấu

---

## 🎴 HỆ THỐNG 70 SKILL

### 📊 Phân Loại Độ Hiếm
- **Thường (Common)**: 45 skill - 60% drop rate
- **Hiếm (Rare)**: 20 skill - 30% drop rate
- **Cực Hiếm (Ultra Rare)**: 5 skill - 10% drop rate

---

## ⚔️ NHÓM TẤN CÔNG (25 Skills)

| # | Tên Skill | Độ Hiếm | Mana | Mô Tả Chi Tiết | Điều Kiện | Icon Đề Xuất |
|---|-----------|---------|------|----------------|-----------|--------------|
| 1 | **Nguyên Tố Lửa** | Thường | 4 | Đốt các ô xung quanh (vùng 3x3) trong 3 lượt. Cả ta và địch không thể đặt quân vào vùng này | Không | 🔥 Quả cầu lửa |
| 2 | **Thủy Chấn** | Hiếm | 5 | Xê dịch 1 quân địch sang 1 hướng (↑↓←→). Tất cả quân phía sau (ta/địch) cũng bị đẩy theo chuỗi | Không có tường chặn phía sau | 🌊 Sóng nước xoáy |
| 3 | **Phong Cước** | Thường | 3 | Di chuyển 1 quân (ta/địch) đến 1 ô trống bất kỳ | Ô đích phải trống | 💨 Lốc gió xoắn |
| 4 | **Địa Chấn** | Thường | 6 | **BLOCK** 1 ô vĩnh viễn. Ô đó không thể đặt quân, không chịu mọi hiệu ứng cho đến hết game | Không | 🪨 Đất nứt |
| 5 | **Sấm Sét** | Thường | 4 | Phá hủy 1 quân địch. Ô đó trở thành **ô trống** (cả ta và địch đều có thể đặt quân) | Phải có quân địch trên ô đó | ⚡ Tia sét vàng |
| 6 | **Lưỡi Dao Gió** | Thường | 5 | Random bay theo 1 hàng/cột/chéo, phá hủy TẤT CẢ quân (ta/địch) trên đường đi → trở thành ô trống | Không | 🌪️ Lưỡi liềm gió |
| 7 | **Hỏa Hồn (Cháy Lan)** | Hiếm | 7 | Đặt lửa vào 1 quân địch. Mỗi lượt lửa lan sang 1 quân liền kề ngẫu nhiên. Sau 5 lượt: **5 quân bị đốt (gốc + 4 lan) biến mất**. Có thể dập bằng bất kỳ skill hệ Thủy | Phải chọn quân địch | 🔥💀 Đầu lâu lửa |
| 8 | **Bẫy Nguyên Khí** | Thường | 2 | Đặt bẫy vào 1 ô trống. Nếu địch đặt quân vào → **mất lượt tiếp theo** | Ô phải trống | 🕸️ Bẫy ma thuật |
| 9 | **Sấm Nổ** | Thường | 5 | Random phá **3 ô** trong vùng 3x3 xung quanh 1 điểm chọn. Các ô bị phá → ô trống | Không | ⚡💥 Sét đánh liên hoàn |
| 10 | **Lốc Xoáy** | Thường | 6 | Chọn 1 vùng 3x3. Lốc di chuyển ngẫu nhiên trong vùng đó, phá hủy **tối đa 3 quân** (ta/địch) gặp trên đường đi | Không | 🌀 Vòng xoáy xanh |
| 11 | **Thạch Băng** | Thường | 4 | Đóng băng 1 ô trong 3 lượt. Ô đó không thể: đặt quân, di chuyển quân, chịu hiệu ứng | Không | ❄️ Tinh thể băng |
| 12 | **Nguyên Kết** | Thường | 5 | Làm 1 quân địch **biến mất** trong 3 lượt (coi như không tồn tại). Không thể win, không tác động, ta không đánh vào ô đó. Sau 3 lượt quân xuất hiện lại | Phải chọn quân địch | 🔗⛓️ Xiềng xích huyền |
| 13 | **Hồn Liên** | Thường | 3 | Tạo 1 **quân giả** của ta. Quân này hoạt động bình thường nhưng biến mất sau 5 lượt → trở về ô trống | Ô đặt phải trống | 👻 Bóng ma trắng |
| 14 | **Hỏa Nhãn** | Thường | 2 | Soi sáng vùng 3x3, lộ tất cả quân địch (kể cả quân bị ẩn) trong vùng | Không | 👁️🔥 Con mắt lửa |
| 15 | **Pháo Nguyên** | Thường | 4 | Giống **Sấm Sét** nhưng chọn **random** 1 quân địch trên toàn bàn cờ để phá | Phải có ít nhất 1 quân địch | 💣 Quả cầu pháo |
| 16 | **Mưa Lửa** | Thường | 5 | Các ô trong vùng 3x3 **mất công dụng** trong 3 lượt (vẫn đặt quân được nhưng skill không tác động vào vùng này) | Không | 🌧️🔥 Mưa thiên thạch |
| 17 | **Lôi Phong** | Thường | 3 | Di chuyển 1 quân địch sang 1 ô trống liền kề (8 hướng) | Ô đích phải trống, liền kề | ⚡💨 Sét gió |
| 18 | **Nguyên Tâm** | Thường | 4 | **Buff**: Skill tấn công tiếp theo gây thêm +50% hiệu ứng (phá 1→2 ô, vùng 3x3→5x5, thời gian 3→5 lượt) | Phải dùng trước skill tấn công | 🧠✨ Tâm linh sáng |
| 19 | **Cạm Bẫy** | Thường | 2 | Giống **Bẫy Nguyên Khí** (đặt bẫy → địch mất lượt) | Ô phải trống | 🪤 Bẫy răng cưa |
| 20 | **Long Hỏa** | Thường | 6 | Nếu đã dùng skill hệ Hỏa trước đó trong 3 lượt → tăng thêm hiệu ứng: đốt thêm vùng 5x5 trong 2 lượt | Phải có skill hệ Hỏa trước đó | 🐉🔥 Rồng lửa |
| 21 | **Hỏa Thần** | Hiếm | 8 | Giải hóa skill hệ Thủy (Băng Nguyên, Thạch Băng, Thủy Chấn) đang tác động trên 1 vùng 3x3 | Phải có hiệu ứng hệ Thủy | 🔥⚔️ Thần lửa |
| 22 | **Thủy Thần** | Hiếm | 8 | Giải hóa skill hệ Hỏa (Hỏa Hồn, Nguyên Tố Lửa, Mưa Lửa) trong vùng 3x3 | Phải có hiệu ứng hệ Hỏa | 💧🛡️ Thần nước |
| 23 | **Thổ Thần** | Hiếm | 8 | Giải hóa skill hệ Mộc (Phong Cước, Lưỡi Dao Gió, Nguyên Phong) trong vùng 3x3 | Phải có hiệu ứng hệ Mộc | 🪨🛡️ Thần đất |
| 24 | **Mộc Thần** | Hiếm | 8 | Giải hóa skill hệ Thổ (Địa Chấn, Thạch Băng, Nguyên Động) trong vùng 3x3 | Phải có hiệu ứng hệ Thổ | 🌳🛡️ Thần cây |
| 25 | **Kim Thần** | Hiếm | 8 | Giải hóa skill hệ Kim (Sấm Sét, Lưỡi Dao Gió, Nguyên Sát) trong vùng 3x3 | Phải có hiệu ứng hệ Kim | ⚔️🛡️ Thần kim |

---

## 🛡️ NHÓM PHÒNG THỦ (25 Skills)

| # | Tên Skill | Độ Hiếm | Mana | Mô Tả Chi Tiết | Điều Kiện | Icon Đề Xuất |
|---|-----------|---------|------|----------------|-----------|--------------|
| 26 | **Nguyên Vệ** | Thường | 5 | Bảo vệ vùng 3x3 trong 3 lượt. **Mọi quân (ta + địch)** trong vùng này **miễn nhiễm** tất cả hiệu ứng skill | Không | 🛡️✨ Lá chắn năng lượng |
| 27 | **Thiên Mệnh** | Thường | 6 | **Né tránh**: Vô hiệu hóa 1 skill tấn công của địch ở lượt tiếp theo (chỉ 1 lần) | Phải dùng trước lượt địch | 🌟🛡️ Vòng sáng thiên thần |
| 28 | **Bảo Hộ** | Thường | 10 | Bảo vệ 1 ô **đến cuối game** khỏi **tất cả** hiệu ứng (phá hủy, di chuyển, biến mất, etc.) | Không | 💎🛡️ Khiên kim cương |
| 29 | **Hồi Nguyên** | Thường | 5 | Hồi 1 quân đã bị phá trong **3 lượt gần nhất** (chọn ô đã bị phá) | Phải có ô bị phá trong 3 lượt | ♻️✨ Hồi sinh |
| 30 | **Nguyên Tĩnh** | Thường | 7 | Địch **không thể dùng skill** trong 3 lượt (vẫn đặt quân bình thường) | Không | 🤫🔇 Im lặng |
| 31 | **Kim Cương** | Thường | 6 | Cả 2 bên **đều chọn 1 quân** để bảo hộ trong 5 lượt (miễn nhiễm skill) | Không | 💎💎 Kết tinh kim cương |
| 32 | **Tường Nguyên** | Thường | 5 | Bảo vệ 1 hàng quân **liền kề** của ta (2→5 quân) trong 3 lượt khỏi mọi hiệu ứng | Phải có ít nhất 2 quân ta liền kề | 🧱 Tường thành |
| 33 | **Lá Chắn** | Thường | 8 | Bảo vệ 1 quân khỏi skill **làm biến mất** (Địa Chấn, Nguyên Kết) đến cuối game. **Vẫn dính** hiệu ứng khác (đẩy, đóng băng, etc.) | Không | 🛡️ Khiên gỗ |
| 34 | **Hồn Lực** | Thường | 4 | **Buff**: Tăng gấp đôi thông số skill tiếp theo (lượt 3→6, vùng 3x3→5x5, số lượng 1→2) | Phải dùng trước skill khác | ⚡💪 Năng lượng tối thượng |
| 35 | **Thần Hộ** | Thường | 5 | Khi 1 ô ta bị phá/tác động, chuyển toàn bộ sát thương/hiệu ứng sang 1 ô ta khác (chọn trước) | Phải kích hoạt trước khi bị tấn công | 🔄🛡️ Chuyển hóa |
| 36 | **Khí Ngưng** | Thường | 6 | Random loại bỏ 10 skill trong deck địch (địch không rút được) trong 5 lượt | Không | 🌫️❄️ Sương mù đông lạnh |
| 37 | **Nguyên Trí** | Hiếm | 5 | **Bắt địch** phải chọn skill ngay lúc này để dùng ở lượt tiếp theo. Ta biết địch sẽ dùng skill gì | Không | 🔮👁️ Con mắt tiên tri |
| 38 | **Linh Ngọc (Double Turn)** | Thường | 12 | Thêm 1 lượt đi ngay sau lượt này (đặt quân + dùng skill 2 lần liên tiếp). **Cooldown: 5 lượt** | Không | 💎⏱️ Ngọc thời gian |
| 39 | **Băng Nguyên** | Thường | 4 | Hóa băng 1 quân địch trong 5 lượt. Quân đó không thể: di chuyển, tạo hàng 5, chịu hiệu ứng buff | Phải chọn quân địch | ❄️🧊 Băng phong ấn |
| 40 | **Nguyên Thần** | Cực Hiếm | 15 | **ULTIMATE**: Bảo vệ **TẤT CẢ** quân ta trong 5 lượt khỏi mọi hiệu ứng. **Giới hạn: 2 lần/game** | Không | 🌌🛡️ Khiên thần thánh |
| 41 | **Hộ Mệnh** | Thường | 5 | Giống **Hồi Nguyên** (hồi 1 quân trong 3 lượt gần nhất) | Phải có ô bị phá trong 3 lượt | 💚✨ Tái sinh |
| 42 | **Bẫy Thiên Thần** | Thường | 6 | Chọn 3 ô quân ta. Nếu địch tác động skill lên → **phản đòn** hiệu ứng tương tự về địch | Phải chọn 3 ô quân ta | 😇🪤 Thiên thần trả thù |
| 43 | **Ngọc Thiên** | Thường | 4 | **Buff phòng thủ**: Tăng thông số skill phòng thủ tiếp theo (lượt +2, vùng +1 cấp) | Phải dùng trước skill phòng thủ | 💠🛡️ Ngọc xanh |
| 44 | **Khí Hồn** | Hiếm | 8 | Random ra hiệu ứng 1 skill **bất kỳ** trong 65 skill (60% Thường, 30% Hiếm, 10% Cực Hiếm) | Không | 🎲✨ Xúc xắc vận mệnh |
| 45 | **Nguyên Linh** | Thường | 6 | Bảo vệ vùng 3x3 trong 6 lượt khỏi mọi hiệu ứng | Không | 🌟🛡️ Linh hồn bảo vệ |
| 46 | **Khử Buff I** | Thường | 4 | Xóa **TẤT CẢ buff** đang tồn tại trên bàn cờ (của cả 2 bên) | Phải có ít nhất 1 buff đang hoạt động | 🚫✨ Xóa sạch |
| 47 | **Khử Buff II** | Thường | 3 | Vô hiệu hóa **mọi buff** sẽ được dùng trong 3 lượt tiếp theo | Không | 🚫⏱️ Cấm buff |
| 48 | **Khử Buff III** | Hiếm | 2 | Xóa 1 buff cụ thể đang tác động (chọn skill buff để xóa) | Phải có buff đó đang hoạt động | 🎯🚫 Xóa chính xác |
| 49 | **Cố Định Quân** | Thường | 5 | Chọn 1 quân (ta/địch), quân đó **không thể di chuyển** bởi bất kỳ skill nào trong 4 lượt | Không | 📍⛓️ Neo giữ |
| 50 | **Ẩn Thân** | Cực Hiếm | 10 | Random ẩn **5 quân địch**. Ta vẫn thấy nhưng **địch không biết** 5 quân đó ở đâu trong 5 lượt | Địch phải có ít nhất 5 quân | 👁️‍🗨️🌫️ Sương mù chiến tranh |
| 51 | **Giải Phóng** | Thường | 3 | Giải tỏa trạng thái **Cố Định** của 1 quân (ta/địch), quân đó có thể di chuyển trở lại | Phải có quân đang bị Cố Định | 🔓⛓️ Phá xiềng |
| 52 | **Cưỡng Chế Di Chuyển** | Hiếm | 6 | **Bắt buộc** di chuyển 1 quân bị Cố Định đến ô trống (phá vỡ Cố Định). Nếu quân không bị Cố Định → di chuyển bình thường | Không | 💪🔗 Vỡ xiềng cưỡng bức |

---

## 🎯 NHÓM CHIẾN THUẬT (18 Skills)

| # | Tên Skill | Độ Hiếm | Mana | Mô Tả Chi Tiết | Điều Kiện | Icon Đề Xuất |
|---|-----------|---------|------|----------------|-----------|--------------|
| 53 | **Thời Không** | Thường | 7 | Đảo ngược thứ tự lượt (địch đi 2 lượt liên tiếp, ta nghỉ 1 lượt) | Không | ⏳🔄 Đồng hồ cát đảo |
| 54 | **Nguyên Quyết** | Thường | 5 | Xóa 1 skill trong deck địch (địch mất vĩnh viễn 1 skill đã chọn) | Không | ❌📜 Xé skill |
| 55 | **Lưu Chuyển** | Thường | 4 | Đổi vị trí 2 quân: 1 quân ta + 1 quân địch | Cả 2 quân phải tồn tại | 🔄🔀 Hoán đổi |
| 56 | **Phản Nguyên** | Hiếm | 6 | **Setup**: Đặt trước, sau 5 lượt sẽ **phản** 1 skill địch về địch. Qua lượt 6 hết tác dụng | Phải setup trước | 🪞⚡ Gương phản chiếu |
| 57 | **Khai Nguyên** | Hiếm | 8 | Chọn lại 1 skill **đã dùng** từ đầu ván (cả ta và địch) để dùng ngay | Phải có ít nhất 1 skill đã dùng | ♻️📜 Tái sử dụng |
| 58 | **Nguyên Cầu** | Cực Hiếm | 14 | **RESET** vùng 4x4: Xóa mọi hiệu ứng + quân cờ (cả ta và địch), trở về trạng thái ban đầu | Không | 🌀🔮 Quả cầu thời gian |
| 59 | **Hợp Nhất** | Thường | 7 | Lượt tiếp theo có thể dùng **2 skill cùng lúc** (thay vì 1) | Không | ⚡⚡ Kết hợp năng lượng |
| 60 | **Nguyên Điểm** | Hiếm | 9 | Địch **buộc phải** chọn ô tiếp theo sẽ đặt quân (ta biết trước). Địch chỉ chọn skill, không đặt quân lượt này | Không | 🎯📍 Dự đoán vận mệnh |
| 61 | **Bùng Nổ** | Thường | 8 | Phá **5 ô random** trong vùng 5x5 cùng lúc → ô trống | Không | 💥💥 Nổ liên hoàn |
| 62 | **Lưỡng Nguyên** | Thường | 3 | Chọn 1 ô (ta/địch), random hiệu ứng **50% lợi / 50% hại** (có thể bảo vệ hoặc phá hủy) | Không | ☯️🎲 Âm dương |
| 63 | **Nguyên Hóa** | Hiếm | 10 | Biến 1 quân địch thành quân ta. **LƯU Ý**: Nếu tạo hàng 5 ngay → **không win ngay**, phải đợi lượt sau | Phải chọn quân địch đơn lẻ (không trong chuỗi 3+) | 🔄👤 Biến hóa |
| 64 | **Khí Nguyên** | Thường | 4 | Tăng tỷ lệ random skill có yếu tố may rủi: 50/50 → 60/40 (lợi ta). **Stack tối đa 3 lượt** → 70/30 | Không | 🍀📈 Tăng vận may |
| 65 | **Nguyên Phong** | Thường | 5 | Tạo gió đẩy 2 quân địch liền nhau, tách ra (xxx → x_xx hoặc xx_x). **Phải có đầu hở** (✓ o|xxx → o|x_xx; ✗ o|xxx nếu không có khoảng trống) | Phải có ít nhất 1 đầu hở | 🌬️💨 Gió tách rời |
| 66 | **Nguyên Sát** | Thường | 4 | **Buff tấn công**: Tăng hệ số sát thương skill tấn công tiếp theo (+50% hiệu ứng) | Phải dùng trước skill tấn công | ⚔️🔥 Tăng sát thương |
| 67 | **Nguyên Động** | Cực Hiếm | 13 | **CHAOS**: Tất cả quân trên bàn cờ nhảy loạn **1 ô random** theo 8 hướng. **Điều kiện**: Lượt gần nhất địch không dùng skill hệ Thủy | Địch không dùng skill hệ Thủy lượt trước | 🌍💥 Động đất |
| 68 | **Thanh Tẩy** | Hiếm | 6 | Xóa **1 Debuff** đang tác động lên quân ta (chọn Debuff cụ thể để xóa) | Phải có ít nhất 1 Debuff trên quân ta | ✨🧹 Làm sạch |
| 69 | **Phong Ấn** | Hiếm | 7 | **Debuff**: Ngăn 1 quân địch sử dụng bất kỳ Buff nào trong 3 lượt | Không | 🔒🚫 Phong ấn ma thuật |
| 70 | **Tăng Cường** | Thường | 5 | **Buff**: Tăng +1 lượt cho TẤT CẢ Buff đang tác động lên quân ta (ví dụ: Buff 3 lượt → 4 lượt) | Phải có ít nhất 1 Buff đang hoạt động | 💪✨ Kéo dài hiệu ứng |

---

## 🔥 HỆ THỐNG NGŨ HÀNH (Kim Mộc Thủy Hỏa Thổ)

### 📖 Khái Niệm Cơ Bản
Ngũ Hành là hệ thống **khắc chế lẫn nhau** giữa 5 yếu tố tự nhiên. Mỗi skill thuộc 1 hệ, và có thể bị **hóa giải** bởi hệ khắc mình.

---

### ⚔️ Vòng Tròn Khắc Chế

```
        🔥 HỎA
         ↓ (nóng chảy)
    💧 THỦY ← ⚔️ KIM
         ↓ (ngăn)      ↓ (chặt)
        🪨 THỔ → 🌳 MỘC
           (xuyên) ←
```

**Quy Luật**: 
- 🔥 **Hỏa khắc Kim** (Lửa nóng chảy kim loại)
- ⚔️ **Kim khắc Mộc** (Kim loại chặt cây)
- 🌳 **Mộc khắc Thổ** (Rễ cây xuyên đất)
- 🪨 **Thổ khắc Thủy** (Đất ngăn nước)
- 💧 **Thủy khắc Hỏa** (Nước dập lửa)

---

### 🎴 Phân Loại Skill Theo Hệ

| Hệ | Icon | Skill Thuộc Hệ Này | Bị Khắc Bởi | Khắc |
|----|------|--------------------|-------------|------|
| **Hỏa** | 🔥 | Nguyên Tố Lửa (#1), Hỏa Hồn (#7), Mưa Lửa (#16), Long Hỏa (#20), Hỏa Nhãn (#14) | 💧 Thủy | ⚔️ Kim |
| **Thủy** | 💧 | Thủy Chấn (#2), Băng Nguyên (#39), Thạch Băng (#11) | 🪨 Thổ | 🔥 Hỏa |
| **Mộc** | 🌳 | Phong Cước (#3), Lưỡi Dao Gió (#6), Nguyên Phong (#63) | ⚔️ Kim | 🪨 Thổ |
| **Thổ** | 🪨 | Địa Chấn (#4), Nguyên Động (#65), Sấm Nổ (#9) | 🌳 Mộc | 💧 Thủy |
| **Kim** | ⚔️ | Sấm Sét (#5), Pháo Nguyên (#15), Nguyên Sát (#64), Lôi Phong (#17) | 🔥 Hỏa | 🌳 Mộc |

---

### 🛡️ Skill Hóa Giải (Thần Hệ)

5 skill **HÓA GIẢI** chuyên dụng để counter skill hệ bị khắc:

| # | Tên Skill | Độ Hiếm | Mana | Hóa Giải Hệ | Cơ Chế Hóa Giải |
|---|-----------|---------|------|-------------|-----------------|
| 21 | **Hỏa Thần** | Hiếm | 8 | 💧 Thủy | Xóa tất cả hiệu ứng skill hệ **Thủy** (Băng Nguyên, Thạch Băng, Thủy Chấn) trong vùng 3x3 |
| 22 | **Thủy Thần** | Hiếm | 8 | 🔥 Hỏa | Xóa tất cả hiệu ứng skill hệ **Hỏa** (Hỏa Hồn, Nguyên Tố Lửa, Mưa Lửa) trong vùng 3x3 |
| 23 | **Thổ Thần** | Hiếm | 8 | 🌳 Mộc | Xóa tất cả hiệu ứng skill hệ **Mộc** (Phong Cước di chuyển, Lưỡi Dao Gió, Nguyên Phong) trong vùng 3x3 |
| 24 | **Mộc Thần** | Hiếm | 8 | 🪨 Thổ | Xóa tất cả hiệu ứng skill hệ **Thổ** (Địa Chấn block, Nguyên Động, Sấm Nổ) trong vùng 3x3 |
| 25 | **Kim Thần** | Hiếm | 8 | ⚔️ Kim | Xóa tất cả hiệu ứng skill hệ **Kim** (Sấm Sét phá hủy, Pháo Nguyên, Nguyên Sát buff) trong vùng 3x3 |

---

### 📋 Điều Kiện Hóa Giải

#### ✅ KHI NÀO DÙNG ĐƯỢC?
1. **Phải có hiệu ứng hệ tương ứng** đang tồn tại trên bàn cờ
2. **Phải chọn vùng 3x3** chứa hiệu ứng cần hóa giải
3. **Đủ 8 mana** để kích hoạt
4. **Skill hóa giải phải trong 3 skill random** trên tay

#### ❌ KHÔNG DÙNG ĐƯỢC KHI:
- Không có hiệu ứng hệ đó trên bàn cờ
- Hiệu ứng nằm ngoài vùng 3x3 chọn
- Không đủ mana
- Skill không có trong tay

---

### 🎯 Ví Dụ Cụ Thể

#### **Tình Huống 1: Dập Lửa Bằng Nước**
```
Lượt 1 - Địch: Dùng "Hỏa Hồn" (#7) → Đặt lửa vào quân ta
         Lửa sẽ lan trong 5 lượt → 5 quân biến mất

Lượt 2 - Ta:   Dùng "Thủy Thần" (#22, 8 mana)
         Chọn vùng 3x3 chứa quân bị cháy
         → ✅ Hóa giải hoàn toàn, lửa tắt, quân được cứu
```

#### **Tình Huống 2: Phá Block Bằng Cây**
```
Lượt 3 - Địch: Dùng "Địa Chấn" (#4) → Block ô chiến lược
         Ô đó không thể dùng cho đến hết game

Lượt 4 - Ta:   Dùng "Mộc Thần" (#24, 8 mana)
         Chọn vùng 3x3 chứa ô bị block
         → ✅ Hóa giải, ô trở lại bình thường
```

#### **Tình Huống 3: Giải Băng Bằng Lửa**
```
Lượt 5 - Địch: Dùng "Băng Nguyên" (#39) → Đóng băng 1 quân ta
         Quân không thể di chuyển/tạo hàng 5 trong 5 lượt

Lượt 6 - Ta:   Dùng "Hỏa Thần" (#21, 8 mana)
         Chọn vùng 3x3 chứa quân bị băng
         → ✅ Hóa giải, băng tan, quân tự do
```

---

### 🧠 Chiến Thuật Ngũ Hành

#### **Offense (Tấn Công)**
- Dùng skill hệ mạnh khi địch **KHÔNG CÓ** skill Thần khắc mình
- Ví dụ: Dùng **Hỏa Hồn** (cháy lan) khi địch hết **Thủy Thần**

#### **Defense (Phòng Thủ)**
- Giữ skill Thần để counter skill hệ mạnh của địch
- Ví dụ: Giữ **Thủy Thần** khi địch có nhiều skill hệ Hỏa

#### **Mind Game**
- Bluff: Dùng skill hệ yếu để "bait" địch dùng skill Thần
- Sau đó dùng skill hệ mạnh khi địch đã hết counter

#### **Combo Ngũ Hành**
```
Bước 1: Dùng "Hỏa Hồn" (cháy lan)
Bước 2: Địch dùng "Thủy Thần" → Hết 8 mana
Bước 3: Ta dùng "Long Hỏa" (skill Hỏa khác) → Địch không còn counter
```

---

### ⚠️ LƯU Ý QUAN TRỌNG

1. **Hóa giải ≠ Miễn nhiễm**: 
   - Hóa giải: Xóa hiệu ứng **đã tồn tại**
   - Miễn nhiễm (Nguyên Vệ, Bảo Hộ): Chặn hiệu ứng **trước khi xảy ra**

2. **Skill Thần khắc NHIỀU skill cùng lúc**: 
   - 1 lần dùng Thủy Thần có thể xóa **tất cả** Hỏa Hồn, Nguyên Tố Lửa, Mưa Lửa trong vùng 3x3

3. **Không khắc skill Trung Lập**:
   - Skill không thuộc 5 hệ (như Nguyên Thần, Linh Ngọc) **KHÔNG** bị hóa giải

4. **Counter Chain**:
   ```
   A dùng Hỏa Hồn → B dùng Thủy Thần (hóa giải)
   → A dùng Hỏa Thần (counter Thủy Thần... NHƯNG KHÔNG!)
   → ❌ Thủy Thần đã kích hoạt xong, không còn "hiệu ứng" để counter
   ```

5. **Chi phí cao**: 8 mana = cơ hội dùng 2 skill thường (4+4), cân nhắc kỹ

---

## 🔗 HỆ THỐNG CỐ ĐỊNH ↔ DI CHUYỂN

### 📖 Khái Niệm
Một cơ chế khắc chế giữa việc **giữ chân quân cờ** và **di chuyển cưỡng chế**. Tạo ra chiến thuật về kiểm soát vị trí.

---

### ⚔️ Sơ Đồ Khắc Chế

```
   CỐ ĐỊNH QUÂN (#49)
        ↓ (khóa vị trí 4 lượt)
      QUÂN CỜ
        ↓ (phá vỡ)
   ┌──────────┴──────────┐
   │                     │
GIẢI PHÓNG (#51)    CƯỠNG CHẾ (#52)
(xóa trạng thái)    (di chuyển cưỡng bức)
```

---

### 🎴 3 Skill Liên Quan

| # | Tên | Mana | Loại | Mô Tả | Khắc Chế |
|---|-----|------|------|-------|----------|
| **49** | Cố Định Quân | 5 | Control | Khóa 1 quân không di chuyển 4 lượt | Bị phá bởi #51, #52 |
| **51** | Giải Phóng | 3 | Counter | Xóa trạng thái Cố Định | Counter trực tiếp #49 |
| **52** | Cưỡng Chế Di Chuyển | 6 | Counter | Bắt buộc di chuyển (phá Cố Định) | Counter cưỡng bức #49 |

---

### 🎯 Cơ Chế Chi Tiết

#### **Skill #49: Cố Định Quân** 📍⛓️
**Hiệu ứng**: 
- Chọn 1 quân (ta/địch) → Gắn trạng thái "Cố Định" trong 4 lượt
- Quân bị Cố Định:
  - ✅ Vẫn tính hàng 5 bình thường
  - ✅ Vẫn chịu hiệu ứng phá hủy (Sấm Sét, Lốc Xoáy...)
  - ❌ KHÔNG thể bị di chuyển bởi: Phong Cước, Lôi Phong, Thủy Chấn, Lưu Chuyển...
  - ❌ KHÔNG thể tự di chuyển (nếu có skill cho phép)

**Chiến thuật sử dụng**:
- Cố định quân **then chốt** của địch (quân tạo cơ hội hàng 4)
- Cố định quân **ta** để tránh bị đẩy ra khỏi vị trí chiến lược

---

#### **Skill #51: Giải Phóng** 🔓⛓️
**Hiệu ứng**:
- Chọn 1 quân đang bị "Cố Định" → Xóa trạng thái ngay lập tức
- Quân đó có thể di chuyển trở lại bình thường
- Chi phí rẻ (3 mana) → dễ counter

**Chiến thuật sử dụng**:
- Giải phóng quân ta bị khóa
- Giải phóng quân địch để... dùng Phong Cước đẩy đi (combo)

---

#### **Skill #52: Cưỡng Chế Di Chuyển** 💪🔗
**Hiệu ứng**:
- Chọn 1 quân → **BẮT BUỘC** di chuyển đến ô trống
- Nếu quân đang bị Cố Định → **PHÁ VỠ** trạng thái Cố Định + di chuyển
- Nếu quân không bị Cố Định → di chuyển bình thường

**Khác biệt với Phong Cước**:
| | Phong Cước (#3) | Cưỡng Chế (#52) |
|---|---|---|
| **Chi phí** | 3 mana | 6 mana |
| **Đối với quân Cố Định** | ❌ Không di chuyển được | ✅ Phá vỡ Cố Định + di chuyển |
| **Ưu điểm** | Rẻ, linh hoạt | Counter Cố Định |

**Chiến thuật sử dụng**:
- Phá chiến thuật "Cố Định quân then chốt" của địch
- Cưỡng chế di chuyển quân địch ra khỏi hàng 4

---

### 📊 Ví Dụ Thực Chiến

#### **Tình Huống 1: Khóa Quân Then Chốt**
```
Bàn cờ:
  X X X _ O    (X sắp thắng nếu đặt vào _)

Lượt Địch (O): Dùng "Cố Định Quân" → khóa quân X giữa
  X [X] X _ O   ([X] = bị cố định)

Lượt Ta (X): Không thể dùng Phong Cước di chuyển quân khác vào _
              Phải tìm cách khác hoặc... 
              → Dùng "Cưỡng Chế" (6 mana) phá Cố Định!
```

#### **Tình Huống 2: Combo Giải Phóng + Di Chuyển**
```
Lượt 1 - Địch: "Cố Định Quân" → khóa quân ta
Lượt 2 - Ta:   "Giải Phóng" (3 mana) → xóa Cố Định
Lượt 3 - Ta:   "Phong Cước" (3 mana) → di chuyển quân đó
              → Tổng 6 mana, nhưng mất 2 lượt
```

#### **Tình Huống 3: Phòng Thủ Quân Chiến Lược**
```
Ta có quân tạo hàng 4 nguy hiểm:
  _ X X X _

Ta dùng "Cố Định Quân" → khóa quân X giữa
  → Địch không thể dùng Lôi Phong/Thủy Chấn đẩy ra
  → Trừ khi địch tốn 6 mana "Cưỡng Chế" hoặc 3 mana "Giải Phóng" + 3 mana di chuyển
```

---

### 🧠 Chiến Thuật Nâng Cao

#### **Offense**
1. **Cố Định + Phá Hủy**: 
   - Cố định quân địch → địch không trốn được
   - Lượt sau dùng Sấm Sét phá

2. **Cưỡng Chế Phá Formation**:
   - Địch có: O O O O _
   - Dùng Cưỡng Chế → đẩy 1 quân ra → O O _ O O (phá hàng 4)

#### **Defense**
1. **Cố Định Phòng Thủ**:
   - Cố định quân ta ở vị trí then chốt
   - Địch khó phá chiến thuật

2. **Giữ Giải Phóng làm Counter**:
   - Khi địch Cố Định quân ta → dùng Giải Phóng ngay
   - Chỉ tốn 3 mana (rẻ)

#### **Mind Game**
1. **Bait Skill**:
   - Cố định 1 quân "mồi nhử"
   - Địch tốn 6 mana Cưỡng Chế
   - Ta vẫn còn quân chính an toàn

2. **Counter Chain**:
   ```
   A: Cố Định quân B
   B: Giải Phóng (3 mana)
   A: Cố Định lại ngay (5 mana)
   B: Hết Giải Phóng → phải dùng Cưỡng Chế (6 mana) hoặc chấp nhận
   ```

---

### ⚠️ LƯU Ý QUAN TRỌNG

1. **Thời gian Cố Định**: 4 lượt (không phải 3 như skill khác)
   - Đủ dài để tạo ưu thế
   - Không quá lâu để broken

2. **Chi phí Counter**:
   - Cố Định (5 mana) vs Giải Phóng (3 mana) → Counter rẻ hơn
   - Cố Định (5 mana) vs Cưỡng Chế (6 mana) → Counter đắt hơn
   → Cân bằng: có 2 cách counter với giá khác nhau

3. **Không chặn skill phá hủy**:
   - Cố Định ≠ Bảo Hộ
   - Quân bị Cố Định vẫn bị Sấm Sét, Địa Chấn phá bình thường

4. **Combo với skill khác**:
   - Cố Định + Hỏa Hồn = địch không di chuyển tránh lửa
   - Cố Định + Bẫy Thiên Thần = bảo vệ tuyệt đối

5. **Ưu tiên mục tiêu**:
   - Cố định quân **giữa hàng 4** của địch (X X [X] X _)
   - Cố định quân **điểm giao** của nhiều hướng (X, Y, Z)

---

## 💪 HỆ THỐNG BUFF ↔ DEBUFF

### 📖 Khái Niệm
**Buff** = Tăng cường sức mạnh (cho ta hoặc đồng minh)
**Debuff** = Giảm sức mạnh (cho địch)
Hai hệ thống này có thể **triệt tiêu lẫn nhau**.

---

### ⚔️ Sơ Đồ Tương Tác

```
        BUFF (Tăng sức mạnh)
             ↕ (counter lẫn nhau)
        DEBUFF (Giảm sức mạnh)
             ↓ (xóa)
    ┌────────┴────────┐
    │                 │
THANH TẨY (#68)   KHỬ BUFF I-III
(xóa Debuff)      (#46,#47,#48 - xóa Buff)
```

---

### 📊 Phân Loại Skill Buff & Debuff

#### ✅ **BUFF** (Tăng Sức Mạnh - 12 Skills)

| # | Tên | Mana | Hiệu Ứng | Icon |
|---|-----|------|----------|------|
| **18** | Nguyên Tâm | 4 | Tăng +50% sát thương skill tấn công tiếp theo | 🧠✨ |
| **29** | Hồn Lực | 4 | Gấp đôi thông số (lượt/vùng) skill tiếp theo | ⚡💪 |
| **38** | Ngọc Thiên | 4 | Tăng thông số skill phòng thủ tiếp theo | 💠🛡️ |
| **43** | Khí Hồn | 8 | Random 1 skill bất kỳ (60% Thường/30% Hiếm/10% Cực Hiếm) | 🎲✨ |
| **59** | Hợp Nhất | 7 | Lượt sau dùng 2 skill cùng lúc | ⚡⚡ |
| **62** | Khí Nguyên | 4 | Tăng tỷ lệ random 50→60→70 (stack 3 lượt) | 🍀📈 |
| **66** | Nguyên Sát | 4 | +50% sát thương skill tấn công | ⚔️🔥 |
| **70** | Tăng Cường | 5 | +1 lượt cho TẤT CẢ Buff đang hoạt động | 💪✨ |
| **28** | Bảo Hộ | 10 | Miễn nhiễm mọi hiệu ứng đến cuối game | 💎🛡️ |
| **33** | Lá Chắn | 8 | Miễn nhiễm skill làm biến mất đến cuối game | 🛡️ |
| **32** | Tường Nguyên | 5 | Bảo vệ hàng quân 3 lượt | 🧱 |
| **45** | Nguyên Linh | 6 | Bảo vệ vùng 3x3 trong 6 lượt | 🌟🛡️ |

**Đặc điểm chung Buff**:
- Hiệu ứng **tích cực** (bảo vệ, tăng sát thương, tăng thông số)
- Tác động lên **quân ta**
- Kéo dài theo **lượt** hoặc **vĩnh viễn**

---

#### ❌ **DEBUFF** (Giảm Sức Mạnh - 10 Skills)

| # | Tên | Mana | Hiệu Ứng | Icon |
|---|-----|------|----------|------|
| **2** | Thủy Chấn | 5 | Xê dịch quân địch (mất vị trí) | 🌊 |
| **11** | Thạch Băng | 4 | Khóa ô 3 lượt (không tương tác) | ❄️ |
| **12** | Nguyên Kết | 5 | Làm quân biến mất 3 lượt | 🔗⛓️ |
| **30** | Nguyên Tĩnh | 7 | Địch không dùng skill 3 lượt | 🤫🔇 |
| **36** | Khí Ngưng | 6 | Loại bỏ 10 skill random trong deck địch 5 lượt | 🌫️❄️ |
| **39** | Băng Nguyên | 4 | Đóng băng quân địch 5 lượt (không di chuyển/tạo hàng 5) | ❄️🧊 |
| **49** | Cố Định Quân | 5 | Khóa di chuyển 4 lượt | 📍⛓️ |
| **69** | Phong Ấn | 7 | Ngăn sử dụng Buff 3 lượt | 🔒🚫 |
| **53** | Thời Không | 7 | Địch mất 1 lượt đi | ⏳🔄 |
| **60** | Nguyên Điểm | 9 | Bắt địch lộ nước đi | 🎯📍 |

**Đặc điểm chung Debuff**:
- Hiệu ứng **tiêu cực** (khóa, giảm khả năng, mất lượt)
- Tác động lên **quân/khả năng địch**
- Thường kéo dài 3-5 lượt

---

### 🎯 Skill Counter Buff/Debuff

#### **Xóa BUFF** (3 Skills)

| # | Tên | Mana | Cơ Chế | Điều Kiện | Icon |
|---|-----|------|--------|-----------|------|
| **46** | Khử Buff I | 4 | Xóa **TẤT CẢ** Buff đang tồn tại (cả 2 bên) | Phải có ít nhất 1 Buff | 🚫✨ |
| **47** | Khử Buff II | 3 | Vô hiệu hóa Buff trong **3 lượt tiếp** | Không | 🚫⏱️ |
| **48** | Khử Buff III | 2 | Xóa **1 Buff cụ thể** (chọn skill) | Phải có Buff đó | 🎯🚫 |

#### **Xóa DEBUFF** (2 Skills)

| # | Tên | Mana | Cơ Chế | Điều Kiện | Icon |
|---|-----|------|--------|-----------|------|
| **68** | Thanh Tẩy | 6 | Xóa **1 Debuff** trên quân ta | Phải có Debuff trên quân ta | ✨🧹 |
| **69** | Phong Ấn | 7 | **Counter Buff**: Ngăn địch dùng Buff 3 lượt | Không | 🔒🚫 |

---

### 📋 Quy Tắc Tương Tác

#### ✅ **Buff Counter Debuff**
Một số Buff có thể **chặn hoặc vô hiệu** Debuff:

| Buff | Counter Debuff Nào | Cơ Chế |
|------|-------------------|--------|
| **Bảo Hộ** (#28) | **MỌI** Debuff | Miễn nhiễm tất cả (Cố Định, Băng, Biến Mất...) |
| **Nguyên Thần** (#40) | **MỌI** Debuff 5 lượt | Bảo vệ toàn bộ quân ta |
| **Lá Chắn** (#33) | Nguyên Kết, Địa Chấn | Chỉ chặn skill làm "biến mất" |
| **Tăng Cường** (#70) | Gián tiếp | Kéo dài Buff → duy trì bảo vệ lâu hơn |

#### ❌ **Debuff Counter Buff**

| Debuff | Counter Buff Nào | Cơ Chế |
|--------|-----------------|--------|
| **Phong Ấn** (#69) | **MỌI** Buff | Ngăn địch sử dụng Buff 3 lượt |
| **Nguyên Tĩnh** (#30) | Gián tiếp | Ngăn dùng skill → không Buff được |
| **Khí Ngưng** (#36) | Gián tiếp | Loại skill Buff khỏi deck |

#### 🔄 **Counter Chain**

```
A: Dùng Buff "Bảo Hộ" (bảo vệ 1 quân vĩnh viễn)
   ↓
B: Dùng "Khử Buff III" (xóa Bảo Hộ ngay, chỉ 2 mana!)
   ↓
A: Buff mất → quân trở về dễ bị tổn thương
```

```
A: Dùng Debuff "Băng Nguyên" (đóng băng quân B)
   ↓
B: Dùng "Thanh Tẩy" (xóa Debuff, 6 mana)
   ↓
A: Quân B tự do trở lại
```

---

### 🎮 Ví Dụ Thực Chiến

#### **Tình Huống 1: Buff Stack**
```
Lượt 1 - Ta: "Nguyên Sát" (#66, 4 mana)
              → Buff: +50% sát thương skill tấn công

Lượt 2 - Ta: "Hồn Lực" (#29, 4 mana)
              → Buff: Gấp đôi thông số skill tiếp

Lượt 3 - Ta: "Sấm Nổ" (phá 3 ô)
              → Với 2 Buff:
                 • +50% sát thương → phá 4-5 ô
                 • Gấp đôi → phá 6-8 ô!
              → ⚠️ Quá mạnh, địch phải dùng "Khử Buff I"
```

#### **Tình Huống 2: Debuff Lock**
```
Lượt 1 - Địch: "Phong Ấn" (#69)
                → Ta không dùng Buff được 3 lượt

Lượt 2 - Ta:    Không thể "Bảo Hộ" quân chiến lược
                → Địch dùng "Sấm Sét" phá quân đó
                → Ta thua thế

Giải pháp: Dùng "Thanh Tẩy" (#68) xóa Phong Ấn ngay lượt 1
           → Tốn 6 mana nhưng giữ được linh hoạt
```

#### **Tình Huống 3: Counter War**
```
A: "Tường Nguyên" (bảo vệ hàng quân 3 lượt)
B: "Khử Buff III" (xóa Tường Nguyên, 2 mana - rẻ!)
A: "Tăng Cường" (+1 lượt cho Buff, nhưng... đã bị xóa rồi!)
   → A lãng phí skill

Bài học: Không dùng "Tăng Cường" khi Buff đã mất
```

---

### 🧠 Chiến Thuật Nâng Cao

#### **1. Buff Layering (Chồng Buff)**
```
Setup: Bảo Hộ (vĩnh viễn) + Tường Nguyên (3 lượt) + Nguyên Vệ (3 lượt)
→ 3 lớp bảo vệ
→ Địch phải tốn 3 skill "Khử Buff" mới phá được
```

#### **2. Debuff Chain (Chuỗi Debuff)**
```
Lượt 1: Phong Ấn (ngăn Buff)
Lượt 2: Băng Nguyên (đóng băng quân)
Lượt 3: Cố Định Quân (khóa di chuyển)
→ Quân địch bị "khóa hoàn toàn" 3 lượt
```

#### **3. Bait & Punish**
```
A: Dùng Buff yếu "Ngọc Thiên" (4 mana)
B: Phản ứng "Khử Buff I" (4 mana) - xóa mọi Buff
A: Buff thật "Nguyên Thần" (15 mana, cực hiếm)
   → B đã hết skill counter, không xóa được!
```

#### **4. Economy War**
```
Mana Cost Comparison:
- Bảo Hộ (10 mana) vs Khử Buff III (2 mana)
  → Counter rẻ hơn 5 LẦN!
  → Không nên dùng Buff đắt khi địch còn Khử Buff

- Phong Ấn (7 mana) vs Thanh Tẩy (6 mana)
  → Gần bằng nhau → cân bằng
```

---

### ⚠️ LƯU Ý QUAN TRỌNG

1. **Buff/Debuff không chồng cùng loại**:
   - Dùng 2 lần "Nguyên Sát" → KHÔNG +100% sát thương
   - Chỉ refresh lại thời gian

2. **Khử Buff I xóa CẢ 2 BÊN**:
   - Dùng khi địch có nhiều Buff hơn ta
   - Tránh "tự bắn vào chân"

3. **Ưu tiên target**:
   - Debuff lên quân then chốt địch (hàng 4, điểm giao)
   - Buff lên quân chiến lược ta

4. **Timing**:
   - Buff trước khi địch tấn công
   - Debuff trước khi ta tấn công
   - Khử Buff/Debuff ngay khi thấy nguy hiểm

5. **Mana management**:
   - Giữ 2-4 mana dự phòng cho "Khử Buff III" (counter rẻ)
   - Không all-in Buff khi địch còn mana

6. **Combo bị cấm**:
   - "Phong Ấn" + "Khử Buff II" = địch không Buff được 6 lượt!
   - Quá mạnh → cân nhắc nerf