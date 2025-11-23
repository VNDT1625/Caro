THÔNG TIN ĐỒ ÁN 
I.Thông tin chung
	1. gameplay
1.1 Game play gốc ( chế độ : MindPoint – online , 2 player , AI – đấu với máy)
Caro : 
- Game caro là trò chơi hai người, đánh dấu X hoặc O trên bàn, ai có 5 hàng liên tiếp sẽ thắng. 
	- không giới hạn ô đối với Rank – ở các chế độ khác tùy vào tạp phòng
	- Thời gian : 
		+ Rank : 30 giây ->10 giây ( giảm dần khi lên rank càng cao )
		+ chế độ khác tùy chỉnh trong khi tạo phòng ( ít nhất 5 giây – nhiều nhất không tính thời gian * Vì vậy phải lưu trữ ván đấu)
1.2 Game play biến thể ( chế độ giải trí , 2 player , online ,rank)
	- Caro skill :  biến thể của caro truyền thống nhưng khác biệt ở chỗ có 1 số chess có skill như hoán vị , chặng hàng ,… - có thể phát triển thành rank ( khác với mindpoint thì rank này dùng để cho người chơi có mục tiêu khác với 1 chế độ khác tránh sự nhàm chán )
	- Caro ẩn : các quân cờ sau mỗi 3 nước sẽ ẩn đi và bắt người chơi phải ghi nhớ 
	- Caro theo ô : giới hạn ô như 3x3 , 9x9 ,…
	- Caro theo hàng : đặt luật thắng theo số hàng như 5 hàng , 3 hàng ,…
	- Caro theo cặp : đánh luân phiên ví dụ 4 người chơi chia làm 2 cặp 2x2 ( A1 + A2 và B1 + B2 ) đánh luân phiên A1 ->  B1 -> A2 -> B2 . 5 nước là thắng
	- Caro địa hình : thay vì chỉ đơn giản là điền vào các ô trống nay các ô có địa hình khác nhau mang lại lợi thế chiến thuật khác nhau . Ví dụ : ở các ô “?” mang lại ngẫu nhiên 1 skill như caro skill chẳng hạng nhưng lần này thay vì chiến thắng bằng 5 nước thì tích điểm : n hàng liên tiếp – n điểm + điểm khi vào các, đánh hết ô 15x15 hoặc 9x9 – nếu phát triển rank thì chọn 1 trong 2 .
1.3 MindPoint và Ranking :
1.1.3Mindpoit là xếp hạng cá nhân của người chơi được tích điểm qua từng trận đấu :
Cách xếp hạng theo điểm : 1️⃣ Các bậc rank chính
Vô danh → Tân Kỳ → Học Kỳ → Kỳ Lão → Cao Kỳ → Tam Kỳ → Đệ Nhị → Vô đối

2️⃣ Cách tính rank theo điểm và tiến trình
Vô danh → Học Kỳ
Tính theo điểm cá nhân tích lũy (mỗi trận thắng +1 điểm)
Mỗi rank chia 4 nhánh chính:
oSơ → Trung → Cao → Vượt bậc
Mỗi nhánh chính chia 3 nhánh nhỏ (ví dụ Sơ 1-2-3)
Khi đạt Cao 3 → lên Vượt bậc, chuẩn bị thách đấu bậc cao hơn
Vượt bậc (Học Kỳ)
Chỉ khi đạt Vượt bậc mới được ghép trận với Kỳ Lão
Trước đó, chỉ đấu nội bộ Học Kỳ để tăng điểm

3️⃣ Từ Kỳ Lão trở lên
Vẫn tính điểm cá nhân để xếp hạng, tạo leaderboard
Matchmaking tự động: đấu với rank ngang hoặc thấp hơn
Thắng → nhảy rank cao hơn, Thua → giữ rank hiện tại
Tạo động lực liên tục cho bậc cao

4️⃣ Top 3
Đệ Nhị → Vô đối: top cuối cùng, uy lực cao nhất
Vẫn tính điểm cho leaderboard nhưng rank cố định

-Cách tính điểm : 
Vô danh -> Học Kỳ : tính điểm theo cấu trúc : số lượt đi ( < 10 -> +10 ,<20 -> + 7 , >20 -> +5 ) + thời gian chênh lệch ( >x2 -> +10 , >x1.5 -> +7, còn lại +5 ) +  mức rank ( vô danh +10 , tân kỳ + 7, học kỳ + 5) => 20 -> 35 đ
(Học Kỳ – vượt cấp ) Kỳ lão -> vô đối :  tính Matchpoint ( điểm cá nhân ) =  (số lượt đi + thời gian chênh lệch ) x chênh rank ( nếu rank nhỏ hơn thì x1.5 , ngược lại x0.5).

1.4 chế độ chơi :
I.Rank : thi đấu online 
II.Đấu với máy : đánh với AI
III.Tự đấu : cùng 1 máy cho 2 người cùng chơi
IV.Giải trí : tạo phòng chơi với bạn , với các chế độ khác nhau.
V.Giải đấu : tạo giải đấu theo số lượng min : 3 , max : 128.
II. Giao diện : 
Theo phong cách cổ trang nhưng vẫn lòng ghép phần hiện đại 
Yêu cầu :  ( bổ sung vào đây )
Các trang :
1.Home : trang chủ sau khi đăng nhập
2.Đăng nhập / Đăng ký : trang đăng nhập / đky 
3.Landing page : trang trước khi đăng nhập 
4.Trang cửa hàng : mua skin chess , mua bàn cờ,..
5.Trang cá nhân : trang hiển thị thông tin cá nhân 
6.Trang sự kiện
7.Trang cài đặt 
8.Trang trong trận đấu 
9.Trang trong phòng 
10.Trang loading : trang loading vô trận và trang loading khác ( thời gian chờ , vô home ,…)
11.Trang admin
III. Hệ Thống :
1.Hệ thống trong trận : hoạt động trong trận đấu – chọn vào ô để tick ( đánh nước cờ ) – kiểm tra điều kiện chiến thắng – thông báo thắng thua – tính giờ 
2.Đăng nhập / đăng ký : tạo tài khoảng và đăng nhập vào tài khoảng 
3.Kết bạn : kết bạn theo id 
4.Tạo phòng + mời : tạo phòng có id phòng, mời bạn bè , cho phép tham dự qua id phòng , mời thế giới
5.Ghép trận : theo mức rank  và theo chế độ 
6.Chọn chế độ chơi 
7.Chat 
8. Module AI :  AI đánh cờ (mức độ : nhập môn + Kỳ Tài + Nghịch thiên  ) + AI Chat ( chỉ giải đáp về caro ) + tìm lỗi sai trong trận ( mua prenium – nếu có thể )
9.Trang cá nhân : lịch sử đấu + thông tin cá nhân + Thêm , sửa , xóa thông tin 
10.Mua và dùng skin trang phục : mua và dùng skin trong trận đấu 
11.Hiệu ứng trong trận : khi dùng skin sẽ có hiệu ứng và hiển thị skin trong trận
12.Hướng dẫn : tạo hướng dẫn khi vừa đăng nhập vào game .
13.Cài đặt hệ thống 
IV. database :

VI.Kế hoạch thực hiện 
1.Mục tiêu 
-Đạt > 80% dự án trong 3 ngày 
-Đảm bảo các mục chính được thực hiện 
2.Yêu cầu của từng phần :
-Giao diện : đạt chuẩn về màu sắc và bố cục vì chơi cờ não bộ hoạt động mạnh tăng sự tập trung vào màn hình có thể gây mõi mắt và sao nhãn  
-Âm thanh : âm thanh không gây ồn khó chịu , chìm để dễ tập trung
-Hệ thống : tối ưu không gây lag , nặng . Đảm bảo mượt mà và clean . Hạn chế lỗi 
-Đảm bảo logic cho đồ án không kẻ hở trừ điểm logic 
3.Kế hoạch theo thời gian để thực hiện ( tạo bảng ):
