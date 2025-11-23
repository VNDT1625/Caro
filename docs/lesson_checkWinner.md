# Bài học: Giải thích `GameEngine::checkWinner()` (dòng‑một‑dòng)

Mục tiêu: giải thích từng dòng trong hàm `checkWinner` để bạn (hoặc người khác) hiểu chính xác cách nó phát hiện người thắng trong trò Cờ Caro.

Ghi chú: mình viết bằng ngôn ngữ đơn giản, tránh thuật ngữ khó.

---

Dưới đây là mã đầy đủ (đã rút gọn cho dễ đọc), sau đó mình giải thích từng dòng hoặc từng nhóm dòng:

```php
<?php
namespace App;

class GameEngine
{
    public static function checkWinner(array $board): ?string
    {
        if (empty($board)) {
            return null;
        }

        $positions = ['X' => [], 'O' => []];
        foreach ($board as $key => $val) {
            if (!in_array($val, ['X', 'O'])) continue;
            $parts = explode('_', $key);
            if (count($parts) !== 2) continue;
            $x = intval($parts[0]);
            $y = intval($parts[1]);
            $positions[$val]["{$x}_{$y}"] = true;
        }

        $dirs = [
            [1, 0],
            [0, 1],
            [1, 1],
            [1, -1]
        ];

        foreach (['X', 'O'] as $player) {
            foreach ($positions[$player] as $key => $_) {
                $parts = explode('_', $key);
                $x0 = intval($parts[0]);
                $y0 = intval($parts[1]);

                foreach ($dirs as $d) {
                    $dx = $d[0];
                    $dy = $d[1];
                    $count = 1;
                    $i = 1;
                    while (isset($positions[$player]["" . ($x0 + $dx * $i) . "_" . ($y0 + $dy * $i)])) {
                        $count++;
                        $i++;
                    }
                    $i = 1;
                    while (isset($positions[$player]["" . ($x0 - $dx * $i) . "_" . ($y0 - $dy * $i)])) {
                        $count++;
                        $i++;
                    }
                    if ($count >= 5) {
                        return $player;
                    }
                }
            }
        }

        return null;
    }
}
```

Giải thích từng phần (rất chi tiết, bằng lời dễ hiểu):

- `<?php`
  - Dòng mở đầu cho biết đây là file PHP.

- `namespace App;`
  - Nói rằng lớp này thuộc nhóm tên `App` (giúp tổ chức mã). Bạn không cần thao tác gì ở dòng này để hiểu thuật toán.

- `class GameEngine` và `public static function checkWinner(array $board): ?string`
  - Tạo một cái hộp (class) tên `GameEngine` và bên trong có một hàm `checkWinner` nhận vào một biến tên `board`.
  - `board` là danh sách các ô đã có nước (mỗi ô được ghi là "x_y" => 'X' hoặc 'O').
  - Hàm trả về 'X' hoặc 'O' nếu tìm được người thắng, còn không có người thắng thì trả về `null` (tức là không ai thắng).

- `if (empty($board)) { return null; }`
  - Nếu bàn trống (chưa ai đánh), hàm dừng và trả về không ai thắng.

- Phần tạo `positions` và vòng `foreach ($board as $key => $val)`
  - Tạo hai nhóm trống: một cho 'X' và một cho 'O'.
  - Duyệt mỗi mục trong `board`:
    - Nếu giá trị không phải 'X' hoặc 'O' thì bỏ.
    - Tách khóa `"x_y"` thành hai số `x` và `y`.
    - Lưu vị trí đó vào nhóm tương ứng, đánh dấu là có quân ở ô đó.
  - Kết quả: bạn có hai tập ô; tập của 'X' chứa mọi ô có X, tập của 'O' chứa mọi ô có O.

- ` $dirs = [[1,0],[0,1],[1,1],[1,-1]]; `
  - Đây là 4 hướng cần kiểm tra:
    - `[1,0]` nghĩa là sang phải (hàng ngang)
    - `[0,1]` nghĩa là lên/dưới (hàng dọc)
    - `[1,1]` chéo xuống phải
    - `[1,-1]` chéo lên phải
  - Ta sẽ kiểm tra từ mỗi ô theo từng hướng này để đếm xem có đủ 5 quân nối nhau không.

- `foreach (['X','O'] as $player)`
  - Ta kiểm tra lần lượt cho 'X' rồi cho 'O'. Ai có chuỗi 5 trước sẽ được trả về.

- `foreach ($positions[$player] as $key => $_)`
  - Với mỗi ô mà người chơi có, ta coi đó là một điểm xuất phát để dò chuỗi.
  - `$_` là biến không dùng (chỉ quan tâm tới key).

- ` $parts = explode('_', $key); $x0 = intval($parts[0]); $y0 = intval($parts[1]); `
  - Lấy lại toạ độ x0,y0 từ chuỗi key.

- `foreach ($dirs as $d) { $dx = $d[0]; $dy = $d[1]; $count = 1; ... }`
  - Với mỗi hướng, đặt biến đếm `count` = 1 (tức là ô bắt đầu đã là 1 quân).
  - Ta sẽ dò tiếp theo hướng đó (và ngược lại) để cộng thêm lần lượt.

- Phần `while (isset($positions[$player][...])) { $count++; $i++; }` (forward)
  - Từ ô bắt đầu, đi từng ô một theo hướng `dx,dy` (ví dụ +1,+0 nghĩa sang phải), nếu ô đó cũng có quân của cùng người thì tăng `count`.
  - Lặp cho tới khi gặp ô trống hoặc không có quân cùng người.

- Phần tương tự `while (...)` (backward)
  - Sau khi dò về một phía, ta dò ngược lại phía kia (ví dụ sang trái) để đếm chuỗi nối tiếp cả hai bên.
  - Vì chuỗi có thể kéo dài cả hai chiều (ví dụ một hàng dài 7), ta cần cộng cả hai chiều để biết tổng chuỗi liên tiếp.

- `if ($count >= 5) { return $player; }`
  - Nếu tổng số liên tiếp lớn hoặc bằng 5, tức là người đó thắng. Hàm trả về 'X' hoặc 'O'.

- `return null;`
  - Nếu vòng kiểm tra hết mà không ai có chuỗi 5, hàm trả về `null` (không có người thắng).

---

Ghi chú thêm, bằng lời rất đời thường:
- Ta biến dữ liệu bàn cờ thành hai danh sách: chỗ nào có X, chỗ nào có O.
- Với mỗi ô của mỗi người, ta thử kéo dài hàng theo 4 hướng để xem có 5 nối nhau không.
- Vì ta tính cả chiều tới và chiều lui, nên không lo bị đếm thiếu khi chuỗi nằm chính giữa.

Kết luận ngắn: hàm này kiểm tra đầy đủ các trường hợp thắng cơ bản (ngang, dọc, chéo) bằng cách đếm các ô liên tiếp.

---

