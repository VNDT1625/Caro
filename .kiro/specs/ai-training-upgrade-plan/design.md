# Ke hoach nang cap AI danh Caro (ban de hieu)

## Muc tieu
- Tang suc choi AI len muc kho danh, giam sai lam ro rang.
- Thoi gian tra nuoc giu duoi nguong mong muon (muc cao ~3s, muc vua ~1s).
- Chi phi hop ly cho sinh vien: co the chay ban nhe tren CPU, ban nang tren GPU thue theo gio.

## Cach AI se choi (noi don gian)
1) Nhin ban co hien tai.
2) Mang nho goi y vai nuoc di co co hoi thang cao.
3) Cong cu thu nhanh se thu nhieu kich ban nho (bo qua nuoc xau, giu nuoc tot).
4) Chon nuoc co ti le thang cao nhat sau khi thu.

## Lo trinh 4 tuan
- Tuan 1: Dung ban nhe (mang nho, thu it lan). Tao ~100k-200k van tu choi, tap 1 dot 4-8h tren GPU T4 (CPU se lau hon nhieu). Test thoi gian tra nuoc <3s.
- Tuan 2: Bo sung 20k-50k van moi, tap them 1-2h. Tang nhe so lan thu neu van nhanh. So sanh moi vs cu tren 100-200 van noi bo, chi giu neu moi thang >=55-60%.
- Tuan 3: Them ngau nhien o khai cuoc de da dang van. Dung bo the bat buoc phong thu cuoi van de tranh sai lon. Giu thoi gian tra nuoc dung muc.
- Tuan 4: Lap lai vong tu choi → tap ngan → danh gia. Dung khi suc manh khong tang ro (ti le thang khong cao hon va thoi gian bi cham).

## Thiet bi de chay
- Co GPU (T4/A100 thue theo gio): tap nhanh, chi phi tuong ung 4-8h dau tien ~1.5-6 USD (T4 re hon, A100 nhanh hon).
- Khong co GPU: van chay duoc ban nhe tren CPU, nhung tap va choi se cham; giu mang nho, so lan thu thap.

## Kiem tra sau moi dot
- Choi 100-200 van AI moi vs ban truoc, muc tieu thang >=55-60%.
- Do thoi gian tra nuoc: muc cao ~3s, muc vua ~1s.
- Neu khong dat: giam so lan thu hoac giam kich thuoc mang; neu con nhanh va yeu, tang so lan thu nhe.

## Khi nao dung lai
- Ti le thang giua phien ban moi vs cu khong tang them (khac biet nho hon ~30-50 Elo tuong duong ~55% win rate).
- Thoi gian tra nuoc vuot muc mong muon va khong cải thien duoc.

## Ghi chu van hanh
- Chay theo phien ngan (2-6h) thay vi 24/7 de tiet kiem chi phi.
- Luon luu lai cac moc mo hinh tot de rollback neu phien moi kem hon.
- Them mot chut ngau nhien o khai cuoc de tranh van lap lai.

## Buoc tiep theo de thuc hien
- Tao script tu choi + tap ban nhe tren GPU T4 (hoac CPU) va log thoi gian, ti le thang.
- Viet huong dan su dung don gian (lenh chay, tham so thoi gian, cach do thoi gian tra nuoc).
- Thiet lap bo test noi bo 100-200 van de danh gia sau moi phien tap.
