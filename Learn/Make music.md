# Hướng Dẫn: Tạo Chức Năng Nhạc Nền Tùy Chỉnh Trong Game

## Mục Lục
1. [Tổng Quan Chức Năng](#1-tổng-quan-chức-năng)
2. [Kiến Trúc Hệ Thống](#2-kiến-trúc-hệ-thống)
3. [Các Bước Triển Khai](#3-các-bước-triển-khai)
4. [Lỗi Đã Gặp và Cách Khắc Phục](#4-lỗi-đã-gặp-và-cách-khắc-phục)
5. [Giải Thích Kỹ Thuật Chi Tiết](#5-giải-thích-kỹ-thuật-chi-tiết)
6. [Bài Học Rút Ra](#6-bài-học-rút-ra)

---

## 1. Tổng Quan Chức Năng

### Chức năng này làm gì?
Cho phép người chơi:
- Mua nhạc nền từ Shop trong game
- Trang bị (equip) nhạc đã mua từ Inventory (kho đồ)
- Nghe nhạc nền tùy chỉnh khi chơi game thay vì nhạc mặc định

### Luồng hoạt động (User Flow):
```
Admin upload nhạc → Lưu vào Supabase Storage → Tạo item trong Shop
                                                      ↓
User mua nhạc → Lưu vào user_items → User vào Inventory → Equip nhạc
                                                              ↓
                                          AudioManager phát nhạc nền mới
```

---

## 2. Kiến Trúc Hệ Thống

### Các thành phần chính:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  Admin.tsx          │  Inventory.tsx      │  AudioManager.ts     │
│  - Upload file nhạc │  - Hiển thị items   │  - Quản lý âm thanh  │
│  - Tạo shop item    │  - Equip/Unequip    │  - Phát nhạc nền     │
│  - Preview nhạc     │  - Preview nhạc     │  - Xử lý volume      │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Backend)                           │
├─────────────────────────────────────────────────────────────────┤
│  Storage (shop-assets)  │  Database                              │
│  - Lưu file MP3/WAV     │  - items: thông tin sản phẩm          │
│  - Public URL           │  - user_items: items user đã mua       │
│                         │  - categories: danh mục (âm nhạc,...)  │
└─────────────────────────────────────────────────────────────────┘
```

### Giải thích các thuật ngữ:

| Thuật ngữ | Tiếng Việt | Giải thích |
|-----------|------------|------------|
| **Storage** | Kho lưu trữ | Nơi lưu file (ảnh, nhạc, video) trên cloud |
| **Bucket** | Thùng chứa | Một "thư mục" trong Storage, ví dụ: `shop-assets` |
| **MIME Type** | Loại nội dung | Định dạng file, ví dụ: `audio/mpeg` cho MP3 |
| **Blob** | Binary Large Object | Dữ liệu nhị phân (binary), như nội dung file |
| **ArrayBuffer** | Bộ đệm mảng | Vùng nhớ chứa dữ liệu nhị phân thô |
| **URL.createObjectURL** | Tạo URL tạm | Tạo đường dẫn tạm để truy cập Blob |

---

## 3. Các Bước Triển Khai

### Bước 1: Tạo Storage Bucket trong Supabase

**File:** `infra/migrations/20251209_000030_create_shop_assets_bucket.sql`

```sql
-- Tạo bucket để lưu file shop (nhạc, ảnh, video)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-assets',      -- Tên bucket
  'shop-assets', 
  true,               -- Public = ai cũng đọc được
  52428800,           -- Giới hạn 50MB
  NULL                -- NULL = cho phép mọi loại file
);

-- Tạo policy cho phép đọc public
CREATE POLICY "shop-assets public read" ON storage.objects
FOR SELECT USING (bucket_id = 'shop-assets');

-- Tạo policy cho phép authenticated users upload
CREATE POLICY "shop-assets authenticated upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'shop-assets' 
  AND auth.role() = 'authenticated'
);
```

**Giải thích:**
- `bucket` giống như một thư mục trên cloud
- `public = true` nghĩa là ai cũng có thể xem file (không cần đăng nhập)
- `policy` là quy tắc bảo mật, quyết định ai được làm gì

### Bước 2: Tạo Database Tables

**Bảng `categories`:** Lưu danh mục sản phẩm
```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,        -- 'âm nhạc', 'skin', 'board'...
  name_vi TEXT,               -- Tên tiếng Việt
  name_en TEXT,               -- Tên tiếng Anh
  icon TEXT,                  -- Emoji icon
  is_active BOOLEAN DEFAULT true
);
```

**Bảng `items`:** Lưu thông tin sản phẩm
```sql
CREATE TABLE items (
  id UUID PRIMARY KEY,
  item_code TEXT UNIQUE,      -- Mã sản phẩm
  name TEXT,                  -- Tên sản phẩm
  category TEXT,              -- Danh mục (FK → categories.id)
  preview_url TEXT,           -- URL file nhạc/ảnh
  price_coins INTEGER,        -- Giá bằng coins
  price_gems INTEGER,         -- Giá bằng gems
  is_available BOOLEAN        -- Có bán không
);
```

**Bảng `user_items`:** Lưu items user đã mua
```sql
CREATE TABLE user_items (
  id UUID PRIMARY KEY,
  user_id UUID,               -- User nào
  item_id UUID,               -- Item nào
  is_equipped BOOLEAN,        -- Đang trang bị không
  acquired_at TIMESTAMP       -- Mua lúc nào
);
```

### Bước 3: Upload Logic trong Admin

**File:** `frontend/src/pages/Admin.tsx`

```typescript
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  
  // 1. Xác định MIME type
  const guessedType = (() => {
    if (file.type) return file.type
    const name = file.name.toLowerCase()
    if (name.endsWith('.mp3')) return 'audio/mpeg'
    if (name.endsWith('.wav')) return 'audio/wav'
    return 'application/octet-stream'
  })()

  // 2. Tạo tên file unique
  const fileName = `am_nhac/${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`

  // 3. ĐỌC FILE THÀNH ARRAYBUFFER (QUAN TRỌNG!)
  const arrayBuffer = await file.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: guessedType })
  
  // 4. Upload lên Supabase
  const { error } = await supabase.storage
    .from('shop-assets')
    .upload(fileName, blob, { 
      contentType: guessedType 
    })

  // 5. Lấy public URL
  const { data } = supabase.storage.from('shop-assets').getPublicUrl(fileName)
  const publicUrl = data?.publicUrl
}
```

### Bước 4: AudioManager - Quản lý âm thanh

**File:** `frontend/src/lib/AudioManager.ts`

```typescript
class AudioManagerClass {
  private bgMusicElement: HTMLAudioElement | null = null
  private currentMusicUrl: string = '/assets/music/default.wav'
  
  // Phát nhạc nền
  async startBgLoop() {
    const url = this.currentMusicUrl
    
    // Với Supabase URL, fetch thành blob trước
    if (url.includes('supabase.co/storage')) {
      const response = await fetch(url)
      const blob = await response.blob()
      
      // Tạo blob với đúng MIME type
      const audioBlob = new Blob([blob], { type: 'audio/mpeg' })
      const blobUrl = URL.createObjectURL(audioBlob)
      
      this.bgMusicElement = new Audio(blobUrl)
      this.bgMusicElement.loop = true
      await this.bgMusicElement.play()
    }
  }
  
  // Đổi nhạc nền
  setBackgroundMusic(url: string, id: string) {
    this.currentMusicUrl = url
    this.currentMusicId = id
    // Restart với track mới
    this.stopBackgroundMusic()
    this.playBackgroundMusic()
  }
}
```

### Bước 5: Hook Load Nhạc Đã Equip

**File:** `frontend/src/hooks/useEquippedMusic.ts`

```typescript
export function useEquippedMusic() {
  useEffect(() => {
    // Đợi AudioManager khởi tạo xong
    const timer = setTimeout(() => {
      loadEquippedMusic()
    }, 500)
    return () => clearTimeout(timer)
  }, [])
}

async function loadEquippedMusic() {
  // 1. Lấy user hiện tại
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) return

  // 2. Tìm item nhạc đang equipped
  const { data } = await supabase
    .from('user_items')
    .select(`item_id, items (id, preview_url, category)`)
    .eq('user_id', user.id)
    .eq('is_equipped', true)

  // 3. Lọc ra item có category là 'âm nhạc'
  const musicItem = data?.find(ui => 
    isMusicCategory(ui.items?.category)
  )
  
  // 4. Set làm background music
  if (musicItem?.items?.preview_url) {
    AudioManager.setBackgroundMusic(
      musicItem.items.preview_url, 
      musicItem.items.id
    )
  }
}
```

---

## 4. Lỗi Đã Gặp và Cách Khắc Phục

### Lỗi 1: File Upload Bị Lưu Sai Format

**Triệu chứng:**
- Upload file MP3 thành công
- Nhưng khi mở URL, nội dung file là text như:
```
------WebKitFormBoundary8T8EiFW0A03zzlCK
Content-Disposition: form-data; name="cacheControl"
3600
------WebKitFormBoundary8T8EiFW0A03zzlCK
Content-Disposition: form-data; name=""; filename="song.mp3"
Content-Type: audio/mpeg
```

**Nguyên nhân:**
Supabase JS client đang serialize (chuyển đổi) file thành **multipart form data** (dạng text) thay vì **binary** (dạng nhị phân).

**Giải thích đơn giản:**
- File nhạc MP3 là dữ liệu nhị phân (binary) - giống như một chuỗi số 0 và 1
- Khi upload, thay vì gửi trực tiếp dữ liệu nhị phân, nó lại gửi dưới dạng "form" (như khi bạn điền form trên web)
- Kết quả là file được lưu không phải là nhạc, mà là text mô tả form

**Cách khắc phục:**
```typescript
// SAI - Gửi File object trực tiếp
await supabase.storage.upload(fileName, file, { contentType: 'audio/mpeg' })

// ĐÚNG - Đọc thành ArrayBuffer rồi tạo Blob mới
const arrayBuffer = await file.arrayBuffer()  // Đọc nội dung nhị phân
const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })  // Tạo Blob mới
await supabase.storage.upload(fileName, blob, { contentType: 'audio/mpeg' })
```

**Tại sao cách này hoạt động?**
- `file.arrayBuffer()` đọc nội dung file thành dữ liệu nhị phân thuần túy
- `new Blob([arrayBuffer], { type: 'audio/mpeg' })` tạo một Blob mới với đúng MIME type
- Khi upload Blob này, Supabase sẽ gửi đúng dữ liệu nhị phân

---

### Lỗi 2: MIME Type Sai Khi Download

**Triệu chứng:**
- File đã upload đúng (nội dung là binary)
- Nhưng khi browser tải về, header `Content-Type` là `application/json` thay vì `audio/mpeg`
- Browser từ chối phát vì "không phải file audio"

**Nguyên nhân:**
Supabase Storage (hoặc Cloudflare CDN phía trước) trả về sai MIME type trong HTTP response header.

**Giải thích đơn giản:**
- Khi browser tải file, server gửi kèm thông tin "đây là loại file gì" (MIME type)
- Browser dựa vào thông tin này để quyết định xử lý file như thế nào
- Nếu server nói "đây là JSON" nhưng thực tế là MP3, browser sẽ từ chối phát

**Cách khắc phục:**
Thay vì dùng URL trực tiếp, ta fetch file về dưới dạng Blob rồi tự tạo URL:

```typescript
// SAI - Dùng URL trực tiếp
const audio = new Audio(supabaseUrl)
audio.play()  // Lỗi: MIME type không đúng

// ĐÚNG - Fetch thành Blob trước
const response = await fetch(supabaseUrl)
const blob = await response.blob()

// Tạo Blob mới với đúng MIME type
const audioBlob = new Blob([blob], { type: 'audio/mpeg' })

// Tạo URL tạm từ Blob
const blobUrl = URL.createObjectURL(audioBlob)

const audio = new Audio(blobUrl)
audio.play()  // Hoạt động!
```

**Tại sao cách này hoạt động?**
- `fetch()` tải nội dung file về (không quan tâm MIME type)
- `new Blob([blob], { type: 'audio/mpeg' })` tạo Blob mới với đúng type
- `URL.createObjectURL()` tạo URL tạm trỏ đến Blob trong bộ nhớ
- Browser sử dụng URL này và biết đây là audio

---

### Lỗi 3: Category Không Nhận Diện Đúng

**Triệu chứng:**
- Item có category là "âm nhạc" trong database
- Nhưng code không nhận ra đây là music item
- Không hiển thị nút preview, không set làm background music

**Nguyên nhân:**
Tiếng Việt có dấu, khi so sánh string cần normalize (chuẩn hóa) trước.

**Giải thích:**
- "âm nhạc" và "am nhac" là khác nhau với máy tính
- Cần loại bỏ dấu trước khi so sánh

**Cách khắc phục:**
```typescript
// Hàm chuẩn hóa - loại bỏ dấu tiếng Việt
const normalize = (val?: string | null) => 
  (val || '')
    .normalize('NFD')                           // Tách dấu ra
    .replace(/[\u0300-\u036f]/g, '')            // Xóa dấu
    .toLowerCase()                              // Chuyển thường

// Các alias của category nhạc
const MUSIC_ALIASES = ['music', 'âm nhạc', 'am nhac']

// Hàm kiểm tra có phải category nhạc không
const isMusicCategory = (cat?: string | null) => {
  if (!cat) return false
  const normalized = normalize(cat)
  return MUSIC_ALIASES.some(alias => normalize(alias) === normalized)
}

// Sử dụng
isMusicCategory('âm nhạc')  // true
isMusicCategory('Âm Nhạc')  // true
isMusicCategory('am nhac')  // true
isMusicCategory('music')    // true
isMusicCategory('skin')     // false
```

---

### Lỗi 4: AudioManager Chưa Khởi Tạo

**Triệu chứng:**
- Gọi `AudioManager.setBackgroundMusic()` nhưng không có gì xảy ra
- Console log cho thấy `initialized = false`

**Nguyên nhân:**
Hook `useEquippedMusic` chạy trước khi `AudioManager.initialize()` được gọi.

**Cách khắc phục:**
Thêm delay để đợi AudioManager khởi tạo:

```typescript
export function useEquippedMusic() {
  useEffect(() => {
    // Đợi 500ms cho AudioManager khởi tạo
    const timer = setTimeout(() => {
      loadEquippedMusic()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [])
}
```

---

## 5. Giải Thích Kỹ Thuật Chi Tiết

### 5.1. MIME Type là gì?

**MIME** = Multipurpose Internet Mail Extensions

Đây là cách máy tính "đánh dấu" loại nội dung của file:

| MIME Type | Loại file | Ví dụ |
|-----------|-----------|-------|
| `audio/mpeg` | Nhạc MP3 | song.mp3 |
| `audio/wav` | Nhạc WAV | sound.wav |
| `image/png` | Ảnh PNG | logo.png |
| `image/jpeg` | Ảnh JPG | photo.jpg |
| `video/mp4` | Video MP4 | movie.mp4 |
| `application/json` | Dữ liệu JSON | data.json |
| `text/html` | Trang web | index.html |

**Tại sao quan trọng?**
- Browser dựa vào MIME type để biết cách xử lý file
- Nếu MIME type sai, browser có thể từ chối hoặc xử lý sai

### 5.2. Blob và ArrayBuffer

**ArrayBuffer:**
- Vùng nhớ chứa dữ liệu nhị phân thô
- Giống như một mảng các byte (số từ 0-255)
- Không có thông tin về loại dữ liệu

```javascript
// Đọc file thành ArrayBuffer
const buffer = await file.arrayBuffer()
// buffer chứa: [73, 68, 51, 4, 0, 0, 0, 0, ...]  (các byte)
```

**Blob (Binary Large Object):**
- Đối tượng chứa dữ liệu nhị phân + thông tin MIME type
- Có thể tạo URL để truy cập

```javascript
// Tạo Blob từ ArrayBuffer
const blob = new Blob([buffer], { type: 'audio/mpeg' })
// blob.type = 'audio/mpeg'
// blob.size = 1234567 (bytes)

// Tạo URL tạm
const url = URL.createObjectURL(blob)
// url = 'blob:http://localhost:5173/abc-123-def'
```

### 5.3. Fetch API

**Fetch** là cách JavaScript tải dữ liệu từ server:

```javascript
// Tải file
const response = await fetch('https://example.com/song.mp3')

// Kiểm tra thành công
if (!response.ok) {
  throw new Error(`HTTP ${response.status}`)
}

// Lấy nội dung dưới dạng Blob
const blob = await response.blob()

// Hoặc dưới dạng text
const text = await response.text()

// Hoặc dưới dạng JSON
const json = await response.json()
```

### 5.4. HTML Audio Element

```javascript
// Tạo audio element
const audio = new Audio()

// Hoặc với URL
const audio = new Audio('https://example.com/song.mp3')

// Các thuộc tính quan trọng
audio.src = 'url'           // URL file nhạc
audio.volume = 0.5          // Âm lượng (0-1)
audio.loop = true           // Lặp lại
audio.currentTime = 0       // Vị trí hiện tại (giây)

// Các phương thức
audio.play()                // Phát
audio.pause()               // Tạm dừng
audio.load()                // Tải lại

// Các sự kiện
audio.oncanplaythrough = () => {}  // Đã tải đủ để phát
audio.onerror = (e) => {}          // Có lỗi
audio.onended = () => {}           // Phát xong
```

---

## 6. Bài Học Rút Ra

### 6.1. Khi Upload File Lên Cloud Storage

✅ **Nên làm:**
- Đọc file thành ArrayBuffer trước khi upload
- Tạo Blob mới với đúng MIME type
- Log thông tin để debug (size, type)

❌ **Không nên:**
- Upload File object trực tiếp (có thể bị serialize sai)
- Tin tưởng MIME type từ browser (có thể sai)

### 6.2. Khi Phát Media Từ Cloud

✅ **Nên làm:**
- Fetch file về dưới dạng Blob
- Tạo Blob URL với đúng MIME type
- Xử lý lỗi và fallback về default

❌ **Không nên:**
- Dùng URL trực tiếp (MIME type có thể sai)
- Bỏ qua error handling

### 6.3. Khi Làm Việc Với Tiếng Việt

✅ **Nên làm:**
- Normalize string trước khi so sánh
- Hỗ trợ nhiều alias (có dấu, không dấu)
- Test với các trường hợp viết hoa/thường

### 6.4. Debug Tips

1. **Kiểm tra file đã upload đúng chưa:**
   - Mở URL trong browser
   - Nếu thấy text `WebKitFormBoundary` → upload sai
   - Nếu browser tải file về → upload đúng

2. **Kiểm tra MIME type:**
   - Mở DevTools → Network tab
   - Tìm request tải file
   - Xem Response Headers → Content-Type

3. **Kiểm tra audio có phát được không:**
   - Console log các sự kiện: `oncanplaythrough`, `onerror`
   - Thử tạo Blob URL và mở trong tab mới

---

## Tổng Kết

Chức năng nhạc nền tùy chỉnh tưởng đơn giản nhưng có nhiều "bẫy" kỹ thuật:

1. **Upload:** Cần đọc file thành binary trước khi upload
2. **Download:** Cần fetch thành Blob để bypass MIME type sai
3. **Category:** Cần normalize tiếng Việt khi so sánh
4. **Timing:** Cần đợi AudioManager khởi tạo xong

Khi gặp lỗi, hãy:
1. Đọc kỹ error message
2. Kiểm tra Network tab trong DevTools
3. Log các giá trị quan trọng
4. So sánh với trường hợp hoạt động đúng

---

*Tài liệu này được viết ngày 12/12/2025 sau khi fix bug nhạc nền không hoạt động.*
