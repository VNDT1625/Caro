# Requirements: Gomoku Match Analysis System (Basic)

## 0. QUY ƯỚC HỆ TỌA ĐỘ

### 0.1 Chuẩn quốc tế (Standard Gomoku Notation)

```
Bàn cờ 15x15 chuẩn:

     A B C D E F G H I J K L M N O
   ┌─────────────────────────────┐
 1 │ • • • • • • • • • • • • • • • │  1
 2 │ • • • • • • • • • • • • • • • │  2
 3 │ • • • • • • • • • • • • • • • │  3
 4 │ • • • • • • • • • • • • • • • │  4
 5 │ • • • • • • • • • • • • • • • │  5
 6 │ • • • • • • • • • • • • • • • │  6
 7 │ • • • • • • • • • • • • • • • │  7
 8 │ • • • • • ● ○ ● • • • • • • • │  8  (ví dụ)
 9 │ • • • • • • • • • • • • • • • │  9
10 │ • • • • • • • • • • • • • • • │  10
11 │ • • • • • • • • • • • • • • • │  11
12 │ • • • • • • • • • • • • • • • │  12
13 │ • • • • • • • • • • • • • • • │  13
14 │ • • • • • • • • • • • • • • • │  14
15 │ • • • • • • • • • • • • • • • │  15
   └─────────────────────────────┘
     A B C D E F G H I J K L M N O

A1 = GÓC TRÊN-TRÁI (Top-Left)
O1 = GÓC TRÊN-PHẢI (Top-Right)
A15 = GÓC DƯỚI-TRÁI (Bottom-Left)
O15 = GÓC DƯỚI-PHẢI (Bottom-Right)

H8 = TRUNG TÂM (Center)
```

### 0.2 Quy tắc ghi chú tọa độ

**Format chuẩn:** `[CHỮ CÁI][SỐ]`
- Chữ cái (A-O): Cột, từ **trái → phải**
- Số (1-15): Hàng, từ **trên → dưới**

**Ví dụ:**
- `H8` = Cột H (giữa), Hàng 8 (giữa) = **Trung tâm**
- `A1` = Cột A (trái nhất), Hàng 1 (trên cùng) = **Góc trên-trái**
- `O15` = Cột O (phải nhất), Hàng 15 (dưới cùng) = **Góc dưới-phải**

### 0.3 Chuyển đổi với hệ tọa độ khác

Nhiều tool sử dụng hệ tọa độ khác nhau. Đây là bảng chuyển đổi:

| Hệ thống | A1 ở góc nào | Ví dụ trung tâm | Chuyển đổi |
|----------|--------------|-----------------|------------|
| **Chuẩn quốc tế** | Trên-Trái | H8 | (Dùng luôn) |
| **Array Index (0-14)** | Trên-Trái | [7][7] | col = letter_to_num(A=0), row = num-1 |
| **Pixel Coordinates** | Trên-Trái | (225, 225) | x = col × cell_size + offset |
| **Cờ Carô Việt Nam** | Dưới-Trái | H8 | row_vn = 16 - row_standard |

### 0.4 Conversion Functions (Tham khảo implementation)

```python
def notation_to_index(notation: str) -> tuple[int, int]:
    """
    Chuyển notation (VD: 'H8') sang array index (7, 7)
    
    Args:
        notation: String dạng 'H8', 'A1', etc.
    
    Returns:
        (row, col) với 0-indexed (0-14)
    """
    col = ord(notation[0].upper()) - ord('A')  # A=0, B=1, ..., O=14
    row = int(notation[1:]) - 1                 # 1=0, 2=1, ..., 15=14
    
    if not (0 <= col <= 14 and 0 <= row <= 14):
        raise ValueError(f"Invalid notation: {notation}")
    
    return (row, col)


def index_to_notation(row: int, col: int) -> str:
    """
    Chuyển array index (7, 7) sang notation 'H8'
    
    Args:
        row: 0-14
        col: 0-14
    
    Returns:
        String dạng 'H8'
    """
    if not (0 <= col <= 14 and 0 <= row <= 14):
        raise ValueError(f"Invalid index: ({row}, {col})")
    
    col_letter = chr(ord('A') + col)  # 0=A, 1=B, ..., 14=O
    row_number = row + 1               # 0=1, 1=2, ..., 14=15
    
    return f"{col_letter}{row_number}"


# Ví dụ sử dụng:
assert notation_to_index('A1') == (0, 0)      # Góc trên-trái
assert notation_to_index('O1') == (0, 14)     # Góc trên-phải
assert notation_to_index('H8') == (7, 7)      # Trung tâm
assert notation_to_index('O15') == (14, 14)   # Góc dưới-phải

assert index_to_notation(0, 0) == 'A1'
assert index_to_notation(7, 7) == 'H8'
assert index_to_notation(14, 14) == 'O15'
```

### 0.5 Validation Rules

AI phải validate input notation trước khi phân tích:

✅ **Valid notations:**
- `A1`, `H8`, `O15` (chữ in hoa + số)
- `h8`, `a1` (chữ thường - auto convert sang in hoa)

❌ **Invalid notations:**
- `P1` (chữ P không tồn tại, chỉ A-O)
- `A16` (số 16 vượt quá bàn 15x15)
- `A0` (số bắt đầu từ 1, không có 0)
- `1A` (sai thứ tự, phải là chữ trước số sau)
- `AA` (thiếu số)
- `88` (thiếu chữ)

### 0.6 Hướng di chuyển (Directions)

Từ một ô, có 8 hướng di chuyển:

```
Directions (từ vị trí hiện tại):

  NW(-1,-1)  N(-1,0)  NE(-1,+1)
         ↖     ↑     ↗
  
  W(0,-1) ← [CENTER] → E(0,+1)
  
         ↙     ↓     ↘
  SW(+1,-1)  S(+1,0)  SE(+1,+1)

- Horizontal (ngang): W ↔ E
- Vertical (dọc): N ↔ S  
- Diagonal1 (chéo /): SW ↔ NE
- Diagonal2 (chéo \): NW ↔ SE
```

**Ví dụ:** Từ `H8` đi về hướng East (E):
```
H8 → I8 → J8 → K8 → L8
(đi sang phải)
```

---

## 1. ĐỊNH NGHĨA CƠ BẢN

### 1.1 Patterns và Mức độ Nguy hiểm
AI cần nhận diện và phân loại các pattern sau:

| Pattern | Mô tả | Điểm đe dọa | Ví dụ |
|---------|-------|-------------|-------|
| **Hàng 5** | 5 quân liên tiếp | 100 (thắng) | XXXXX |
| **Hàng 4 mở** | _XXXX_ | 90 | _XXXX_ |
| **Hàng 4 kín** | XXXX_ hoặc _XXXX | 50 | OXXXX_ |
| **Hàng 3 mở** | _XXX_ | 30 | _XXX_ |
| **Hàng 3 kín** | XXX_ hoặc _XXX | 10 | _XXXO |
| **Fork (Đa đường)** | 1 nước tạo ≥2 hàng 3 mở | 70 | Giao điểm tạo 2 hàng 3 |
| **Hàng 2 mở** | _XX_ | 5 | _XX_ |

### 1.2 Đánh giá Thế trận
**Công thức tính điểm thế trận:**
```
Điểm thế trận = Σ(điểm patterns của X) - Σ(điểm patterns của O)

- Điểm > +20: X lợi thế công
- Điểm từ -20 đến +20: Cân bằng
- Điểm < -20: O lợi thế công
```

### 1.3 Vai trò sau Swap 2
- **Người đi trước (sau swap)**: Vai trò tấn công
- **Người đi sau (sau swap)**: Vai trò phòng thủ
- **Ngoại lệ**: Vai trò đảo ngược khi điểm thế trận chênh lệch > 30

---

## 2. CHỨC NĂNG PHÂN TÍCH TỪNG NƯỚC CỜ

### 2.1 Input
- Lịch sử các nước đi từ đầu ván (tọa độ + người chơi)
- Xác định nước đi hiện tại cần phân tích
- Xác định vai trò (X/O, công/thủ)

### 2.2 Output cho MỖI nước đi
AI cần trả về JSON với cấu trúc:

```json
{
  "move_number": 15,
  "player": "X",
  "position": "H8",
  "role": "attacker",
  "board_evaluation": {
    "before_move": 15,
    "after_move": 35,
    "change": +20
  },
  "move_analysis": {
    "type": "offensive/defensive/balanced",
    "rating": "excellent/good/average/poor/blunder",
    "score": 8.5,
    "primary_purpose": "Tạo fork (2 hàng 3 mở)",
    "threats_created": [
      {"type": "open_three", "direction": "horizontal", "position": ["H6", "H7", "H8", "H9", "H10"]},
      {"type": "open_three", "direction": "diagonal", "position": ["F6", "G7", "H8", "I9", "J10"]}
    ],
    "threats_blocked": [],
    "tactical_elements": ["fork_creation", "tempo_gain"]
  },
  "alternatives": [
    {
      "position": "G9",
      "score": 7.0,
      "reason": "Tạo hàng 3 mở nhưng không fork"
    },
    {
      "position": "I7",
      "score": 6.5,
      "reason": "Chặn hàng 3 của đối thủ"
    }
  ],
  "comment": "Nước đi xuất sắc! Tạo fork buộc đối thủ chỉ chặn được 1 đường, dẫn đến hàng 4 mở ở nước tiếp theo.",
  "next_recommendation": "Nếu O chặn H9, X nên đánh G7 để hoàn thiện hàng 4 mở diagonal"
}
```

---

## 3. QUY TẮC ĐÁNH GIÁ THEO VAI TRÒ

### 3.1 Người tấn công (thế công)

#### Tiêu chí nước đi TỐT:
✅ **Điểm cao nếu:**
1. Tạo nhiều đường công (≥2 hàng 3 trở lên)
2. Tạo hàng 4 hoặc fork
3. Nước đi khiến đối thủ BUỘC phải chặn (tempo forcing)
4. Vị trí chặn của đối thủ KHÔNG TẠO được phản công mạnh (điểm đe dọa < 20)

❌ **Điểm thấp nếu:**
1. Tạo hàng 3 đơn lẻ mà đối thủ chặn được VÀ tạo phản công mạnh (điểm ≥30)
2. Không tạo thêm đường công nào
3. Đánh vào vị trí mà đối thủ chặn được NHIỀU đường cùng lúc

#### Ví dụ cụ thể:
```
Tình huống: X có XXX_ và _XX_ ở 2 hướng khác nhau
- Nước đi A: Hoàn thiện XXX_ thành XXXX_ (Điểm: 7/10)
  → Đúng hướng nhưng đối thủ chặn dễ
  
- Nước đi B: Đánh vào giao điểm tạo fork (2 hàng 3 mở) (Điểm: 10/10)
  → Xuất sắc! Đối thủ chỉ chặn được 1 đường
```

### 3.2 Người phòng thủ (thế thủ)

#### Tiêu chí nước đi TỐT:
✅ **Điểm cao nếu:**
1. Chặn đường nguy hiểm nhất của đối thủ (ưu tiên: hàng 4 > fork > hàng 3 mở)
2. Vị trí chặn TẠO được phản công (tạo hàng 3 của mình)
3. Chặn vào điểm giao TẮT NHIỀU đường công của đối thủ
4. Không để đối thủ tạo fork ở nước tiếp theo

❌ **Điểm thấp nếu:**
1. Chặn nhầm đường ít nguy hiểm hơn
2. Vị trí chặn không có kết nối với quân mình (phản công sau này khó)
3. Để đối thủ tạo fork ở nước sau

#### Ví dụ cụ thể:
```
Tình huống: X có 2 hàng 3 mở: _XXX_ (ngang) và _XX_X (dọc)
- Nước đi A: Chặn hàng ngang (Điểm: 5/10)
  → Chặn được 1 đường nhưng đối thủ vẫn còn hàng 3 dọc
  
- Nước đi B: Chặn vào GIAO ĐIỂM (Điểm: 10/10)
  → Xuất sắc! Tắt cả 2 đường VÀ tạo hàng 3 của O
```

### 3.3 Thế cân bằng (cả 2 cùng công)

**Quy tắc:**
- Người đi trước (X) có lợi thế timing → Nên ưu tiên công
- Người đi sau (O) nếu điểm thế trận không hơn → NÊN PHÒNG THỦ

**Tiêu chí đánh giá:**
- So sánh tốc độ tạo hàng 4 của 2 bên
- Ai tạo hàng 4 mở trước → Người đó thắng
- Đếm số nước còn lại để tạo hàng 4: X cần 2 nước, O cần 3 nước → X tốt hơn

---

## 4. HỆ THỐNG ĐIỂM ĐÁNH GIÁ

### 4.1 Thang điểm nước đi (0-10)

| Điểm | Rating | Tiêu chí |
|------|--------|----------|
| 9-10 | Excellent (Xuất sắc) | Nước đi duy nhất/tốt nhất. Tạo lợi thế quyết định (fork, hàng 4 mở) |
| 7-8 | Good (Tốt) | Nước đi đúng hướng, tăng lợi thế rõ ràng (+15 điểm thế trận) |
| 5-6 | Average (Trung bình) | Nước đi an toàn nhưng không tối ưu |
| 3-4 | Poor (Kém) | Bỏ lỡ cơ hội tốt hơn hoặc để lộ điểm yếu |
| 0-2 | Blunder (Sai lầm) | Nước đi sai nghiêm trọng, mất lợi thế hoặc thua ngay |

### 4.2 Công thức tính điểm nước đi

```python
def calculate_move_score(move_data):
    base_score = 5.0
    
    # Thưởng/phạt theo vai trò
    if move_data['role'] == 'attacker':
        # Thưởng tạo đe dọa
        base_score += (threats_created * 0.5)
        # Thưởng nếu buộc đối thủ phải chặn
        if is_forcing_move:
            base_score += 1.5
        # Phạt nếu đối thủ chặn + phản công mạnh
        if opponent_counter_threat > 30:
            base_score -= 2.0
            
    elif move_data['role'] == 'defender':
        # Thưởng chặn đúng đường nguy hiểm nhất
        if blocked_highest_threat:
            base_score += 2.0
        # Thưởng tạo phản công
        base_score += (counter_threats * 0.5)
        # Phạt chặn nhầm đường
        if missed_critical_threat:
            base_score -= 3.0
    
    # Điều chỉnh theo thay đổi thế trận
    board_eval_change = after_score - before_score
    base_score += (board_eval_change / 10)
    
    return max(0, min(10, base_score))
```

---

## 5. CÁC CHIẾN THUẬT CẦN NHẬN DIỆN

### 5.1 Bẫy (Trap)
**Đặc điểm:** Cố tình đánh vào vị trí "yếu" để dụ đối thủ chặn, tạo setup cho nước sau

**Cách nhận diện:**
- Nước đi tạo hàng 3 kín (điểm thấp) NHƯNG...
- Nếu đối thủ chặn vào điểm đó, nước sau tạo được fork/hàng 4

**AI cần comment:**
```
"Nước đi có vẻ yếu (tạo hàng 3 kín) nhưng là BẪY! 
Nếu O chặn vào H8, X sẽ đánh I7 tạo fork. 
Rating: 8.5/10 - Good tactical setup"
```

### 5.2 Tiền đề (Setup/Preparation)
**Đặc điểm:** Nước đi không rõ ý đồ ngay, nhưng tạo nền tảng cho các nước sau

**Cách nhận diện:**
- Nước đi hiện tại: chỉ tạo hàng 2 hoặc vị trí xa
- Nhưng sau 2-3 nước: tạo được nhiều hàng 3 giao nhau

**AI cần comment:**
```
"Nước đi TIỀN ĐỀ. Hiện không tạo đe dọa trực tiếp nhưng:
- 2 nước sau: có thể tạo 3 hàng 3 mở từ vị trí này
- Khó bị nhận ra → Đối thủ khó phòng ngừa
Rating: 7.5/10 - Good strategic preparation"
```

### 5.3 Lấy công bù thủ (Trading)
**Đặc điểm:** Cố tình cho đối thủ tạo hàng 3, nhưng mình tạo được hàng 4

**Cách nhận diện:**
- Bỏ qua chặn hàng 3 của đối thủ
- Đi tiếp tạo hàng 4 của mình
- Đổi trade: "Tôi tạo đe dọa lớn hơn → Đối thủ phải chặn tôi trước"

---

## 6. FLOW PHÂN TÍCH

```
Input: Danh sách nước đi từ đầu ván
↓
Với mỗi nước đi i:
  1. Đánh giá thế trận TRƯỚC nước đi
  2. Xác định vai trò (công/thủ/cân bằng)
  3. Liệt kê TẤT CẢ patterns của 2 bên
  4. Tính điểm thế trận
  5. Thực hiện nước đi
  6. Đánh giá thế trận SAU nước đi
  7. Phân loại nước đi (offensive/defensive/balanced)
  8. Tính điểm nước đi theo công thức
  9. Tìm 2-3 nước đi thay thế tốt hơn (nếu có)
  10. Sinh comment bằng tiếng Việt tự nhiên
↓
Output: JSON phân tích từng nước
```

---

## 7. YÊU CẦU VỀ COMMENT

### 7.1 Ngôn ngữ
- Tiếng Việt tự nhiên, dễ hiểu
- Tránh thuật ngữ phức tạp (hoặc giải thích nếu dùng)

### 7.2 Nội dung comment

**Với nước đi TỐT (7-10 điểm):**
```
"Nước đi xuất sắc! [Giải thích lý do]. 
Tạo [các đe dọa cụ thể]. 
Đối thủ buộc phải [hành động], dẫn đến [lợi thế]."
```

**Với nước đi TRUNG BÌNH (5-6 điểm):**
```
"Nước đi an toàn, [đạt được mục tiêu gì]. 
Tuy nhiên, có thể tốt hơn nếu đánh [vị trí khác] 
để [lợi ích cụ thể]."
```

**Với nước đi KÉM (0-4 điểm):**
```
"Nước đi chưa tối ưu! Bỏ lỡ cơ hội [cơ hội nào]. 
Nên đánh [vị trí thay thế] để [lý do]. 
Nước đi này dẫn đến [hậu quả tiêu cực]."
```

---

## 8. TEST CASES MẪU

### Test Case 1: Fork Creation
```
Input: 
- Nước 1-10: Setup phase
- Nước 11: X đánh H8 tạo fork

Expected Output:
- Type: offensive
- Rating: excellent
- Score: 9.5
- Primary purpose: "Tạo fork (2 hàng 3 mở)"
- Threats created: 2 open_threes
- Comment: "Nước đi xuất sắc! Tạo fork buộc O chỉ chặn được 1 đường..."
```

### Test Case 2: Missed Defense
```
Input:
- Nước 14: X tạo hàng 4 kín tại G7
- Nước 15: O đánh xa (M12) thay vì chặn G6

Expected Output:
- Type: defensive
- Rating: blunder
- Score: 1.0
- Comment: "Sai lầm nghiêm trọng! Bỏ qua hàng 4 kín của X tại G7. 
  Phải chặn ngay G6, nếu không X thắng nước sau."
- Alternatives: [{"position": "G6", "score": 9.0, "reason": "Chặn hàng 4"}]
```

---

## 9. PHÂN TẦNG NGƯỜI DÙNG & GIỚI HẠN TỪNG CẤP

### 9.1 Phiên bản BASIC - Dành cho: **Người mới/Trung bình (ELO < 1800)**

**Đối tượng:**
- Người chơi mới làm quen với Gomoku
- Người chơi nghiệp dư, chơi giải trí
- Người muốn học các khái niệm cơ bản: hàng 3, hàng 4, fork

**Phân tích gì:**
✅ Nhận diện patterns cơ bản (hàng 3, 4, 5, fork đơn giản)
✅ Đánh giá nước đi có tạo đe dọa không
✅ Chỉ ra sai lầm RÕ RÀNG (bỏ lỡ chặn hàng 4, để thua 1 nước)
✅ Comment đơn giản, dễ hiểu

**KHÔNG phân tích:**
❌ Opening theory (tên các khai cuộc, Taraguchi, Yamaguchi...)
❌ VCF/VCT (ván cờ thắng chắc phức tạp)
❌ Tính toán sâu > 3 nước
❌ Thuật ngữ chuyên sâu

**Ví dụ comment phù hợp:**
```
"Nước đi tốt! Tạo 2 hàng 3 cùng lúc (fork), 
đối thủ chỉ chặn được 1 đường thôi."
```

---

### 9.2 Phiên bản INTERMEDIATE - Dành cho: **Người chơi khá (ELO 1800-2200)**

**Đối tượng:**
- Người đã hiểu rõ patterns cơ bản
- Muốn học chiến thuật sâu hơn
- Tham gia giải đấu nghiệp dư

**Phân tích thêm:**
✅ Opening evaluation (đánh giá khai cuộc, có lợi cho X hay O?)
✅ Multiple threats analysis (phân tích nhiều đe dọa cùng lúc)
✅ VCF detection (phát hiện ván cờ thắng chắc đơn giản - 3-5 nước)
✅ Positional understanding (hiểu về vị trí, structure)
✅ Phân tích 3-5 nước đi thay thế tốt nhất

**Ví dụ comment phù hợp:**
```
"Nước đi setup tốt cho VCF sau này. 
Nếu O chặn H8, X có sequence thắng chắc: 
I7 → J6 → K5 → thắng.
Tuy nhiên, nước I9 có thể mạnh hơn vì..."
```

---

### 9.3 Phiên bản ADVANCED - Dành cho: **Chuyên nghiệp (ELO > 2200)**

**Đối tượng:**
- Người chơi chuyên nghiệp
- Muốn đào sâu từng nước đi ở mức độ engine
- Phân tích để cải thiện opening repertoire

**Phân tích thêm:**
✅ Full opening database (so sánh với opening book)
✅ VCT detection (Victory by Continuous Threat - phức tạp)
✅ Deep calculation (tính toán 7-10 nước)
✅ Winning percentage evaluation (% thắng của mỗi nước đi)
✅ Alternative lines với đánh giá chi tiết từng nhánh
✅ Strategic imbalance (đánh giá mất cân bằng chiến lược)

**Ví dụ comment phù hợp:**
```
"Nước đi sai lầm tinh vi. Database cho thấy nước này 
có tỷ lệ thắng 45% so với 62% của nước G9.
Sau 8...H7 9.I8 O buộc phải đi 10...J7 (forced),
dẫn đến position -15 theo đánh giá engine.
Opening transposition: Taraguchi-D4 variant."
```

---

## 10. SO SÁNH CÁC PHIÊN BẢN

| Tính năng | Basic | Intermediate | Advanced |
|-----------|-------|--------------|----------|
| **Nhận diện pattern** | Hàng 3,4,5, Fork đơn | + VCF 3-5 nước | + VCT, Double-VCF |
| **Độ sâu tính toán** | 1-2 nước | 3-5 nước | 7-10 nước |
| **Opening analysis** | ❌ | ✅ Basic | ✅ Full database |
| **Alternatives** | 1-2 nước | 3-5 nước | 5-10 nước + variations |
| **Comment style** | Đơn giản, dễ hiểu | Chi tiết, có thuật ngữ | Chuyên nghiệp, engine-like |
| **Đối tượng** | Mới/Trung bình | Khá/Giỏi | Chuyên nghiệp |
| **Mục đích** | Học cơ bản | Cải thiện chiến thuật | Đào sâu lý thuyết |

---

## 11. KHUYẾN NGHỊ PHÁT TRIỂN

### Roadmap triển khai:
```
Phase 1 (Tháng 1-2): BASIC
  → Pattern recognition cơ bản
  → Scoring system đơn giản
  → Comment dễ hiểu

Phase 2 (Tháng 3-4): INTERMEDIATE  
  → Thêm VCF detection
  → Opening evaluation
  → Multiple alternatives

Phase 3 (Tháng 5+): ADVANCED
  → Deep search algorithm
  → Opening database integration
  → Engine-level analysis
```

### Lựa chọn ban đầu:
**Nên bắt đầu với BASIC vì:**
✅ Phục vụ được phần lớn người dùng (70-80%)
✅ Dễ implement, test, debug
✅ Feedback loop nhanh → cải thiện dần
✅ Tránh overwhelm người mới với quá nhiều thông tin