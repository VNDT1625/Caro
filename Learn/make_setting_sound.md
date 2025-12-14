# Hướng Dẫn Làm Chức Năng Cài Đặt Âm Thanh

## Mục Tiêu
Tạo hệ thống quản lý âm thanh cho ứng dụng web, cho phép người dùng:
- Bật/tắt nhạc nền (background music)
- Điều chỉnh âm lượng nhạc nền (0-100%)
- Bật/tắt hiệu ứng âm thanh (sound effects - SFX)
- Điều chỉnh âm lượng hiệu ứng
- Lưu cài đặt để lần sau mở app vẫn giữ nguyên

---

## Kiến Thức Cần Biết Trước

### 1. localStorage là gì?
**localStorage** là nơi lưu trữ dữ liệu trên trình duyệt của người dùng. Dữ liệu sẽ được giữ lại ngay cả khi đóng trình duyệt.

```javascript
// Lưu dữ liệu
localStorage.setItem('ten_key', 'gia_tri')

// Đọc dữ liệu
const giaTri = localStorage.getItem('ten_key')

// Xóa dữ liệu
localStorage.removeItem('ten_key')
```

### 2. HTMLAudioElement là gì?
**HTMLAudioElement** là đối tượng JavaScript dùng để phát âm thanh. Nó giống như một máy nghe nhạc ảo.

```javascript
// Tạo đối tượng audio
const audio = new Audio('/duong-dan/nhac.mp3')

// Phát nhạc
audio.play()

// Tạm dừng
audio.pause()

// Điều chỉnh âm lượng (từ 0.0 đến 1.0)
audio.volume = 0.5  // 50%

// Lặp lại khi hết bài
audio.loop = true
```

### 3. Singleton Pattern là gì?
**Singleton** là mẫu thiết kế đảm bảo chỉ có DUY NHẤT MỘT đối tượng được tạo ra trong toàn bộ ứng dụng. Điều này quan trọng vì:
- Chỉ cần 1 "máy nghe nhạc" cho cả app
- Tránh nhiều bài nhạc phát cùng lúc
- Dễ quản lý trạng thái

```javascript
// Tạo class
class AudioManager {
  // Code ở đây
}

// Tạo DUY NHẤT 1 instance (thể hiện) và export ra ngoài
export const audioManager = new AudioManager()
```

---

## Bước 1: Định Nghĩa Cấu Trúc Dữ Liệu

Đầu tiên, ta cần xác định những gì cần lưu trữ:

```typescript
// Interface = bản thiết kế mô tả cấu trúc dữ liệu
// Giống như form đăng ký, quy định cần điền những gì
interface AudioSettings {
  bgMusic: boolean        // Bật/tắt nhạc nền (true = bật, false = tắt)
  bgMusicVolume: number   // Âm lượng nhạc nền (0-100)
  sfxEnabled: boolean     // Bật/tắt hiệu ứng âm thanh
  sfxVolume: number       // Âm lượng hiệu ứng (0-100)
}
```

---

## Bước 2: Tạo AudioManager Class

```typescript
class AudioManagerClass {
  // === BIẾN PRIVATE (chỉ dùng bên trong class) ===
  
  // Đối tượng phát nhạc nền
  private bgMusicElement: HTMLAudioElement | null = null
  
  // Cài đặt mặc định
  private settings: AudioSettings = {
    bgMusic: true,
    bgMusicVolume: 70,
    sfxEnabled: true,
    sfxVolume: 80
  }
  
  // Đánh dấu đã khởi tạo chưa
  private initialized = false
  
  // URL nhạc nền hiện tại
  private currentMusicUrl: string = '/assets/music/default.mp3'
```

---

## Bước 3: Hàm Khởi Tạo (Initialize)

Hàm này được gọi 1 lần khi app khởi động:

```typescript
  /**
   * Khởi tạo hệ thống âm thanh với cài đặt ban đầu
   * @param settings - Cài đặt từ localStorage hoặc mặc định
   */
  initialize(settings: AudioSettings) {
    // Nếu đã khởi tạo rồi thì không làm lại
    if (this.initialized) return
    
    // Lưu cài đặt
    this.settings = settings
    this.initialized = true
    
    console.log('AudioManager đã khởi tạo với:', settings)
  }
```

---

## Bước 4: Hàm Phát Nhạc Nền

```typescript
  /**
   * Phát nhạc nền
   * Chỉ phát khi: bgMusic = true VÀ volume > 0
   */
  playBackgroundMusic() {
    // Kiểm tra điều kiện
    if (!this.settings.bgMusic) {
      console.log('Nhạc nền đã bị tắt trong cài đặt')
      return
    }
    
    if (this.settings.bgMusicVolume <= 0) {
      console.log('Âm lượng = 0, không phát')
      return
    }

    // Nếu đã có audio element đang chạy, chỉ cần resume (tiếp tục)
    if (this.bgMusicElement) {
      this.bgMusicElement.play()
      return
    }

    // Tạo mới audio element
    this.bgMusicElement = new Audio(this.currentMusicUrl)
    this.bgMusicElement.loop = true  // Lặp lại khi hết bài
    this.bgMusicElement.volume = this.settings.bgMusicVolume / 100  // Chuyển 0-100 thành 0-1
    
    // Phát nhạc
    this.bgMusicElement.play()
      .then(() => console.log('Đang phát nhạc nền'))
      .catch(err => console.warn('Không thể phát nhạc:', err))
  }
```

---

## Bước 5: Hàm Dừng Nhạc

```typescript
  /**
   * Dừng nhạc nền hoàn toàn
   */
  stopBackgroundMusic() {
    if (this.bgMusicElement) {
      this.bgMusicElement.pause()       // Tạm dừng
      this.bgMusicElement.currentTime = 0  // Quay về đầu bài
      this.bgMusicElement = null        // Xóa reference
    }
  }
```

---

## Bước 6: Hàm Cập Nhật Cài Đặt (QUAN TRỌNG NHẤT)

Đây là hàm phức tạp nhất, xử lý khi người dùng thay đổi cài đặt:

```typescript
  /**
   * Cập nhật cài đặt âm thanh
   * @param newSettings - Cài đặt mới (có thể chỉ 1 phần)
   */
  updateSettings(newSettings: Partial<AudioSettings>) {
    // Gộp cài đặt mới vào cài đặt hiện tại
    // Partial<T> nghĩa là có thể chỉ truyền 1 số field, không cần đủ hết
    this.settings = { ...this.settings, ...newSettings }
    
    // === XỬ LÝ NHẠC NỀN ===
    
    // Lấy giá trị hiện tại (dùng ?? để lấy giá trị mặc định nếu undefined)
    const volume = this.settings.bgMusicVolume
    const isEnabled = this.settings.bgMusic
    
    // Quyết định có nên phát không
    // Chỉ phát khi: bật nhạc VÀ âm lượng > 0
    const shouldPlay = isEnabled && volume > 0
    
    // Cập nhật âm lượng nếu đang phát
    if (this.bgMusicElement) {
      this.bgMusicElement.volume = volume / 100
    }
    
    // Xử lý phát/dừng
    if (shouldPlay) {
      // Nên phát nhạc
      if (this.bgMusicElement && this.bgMusicElement.paused) {
        // Đang pause -> resume
        this.bgMusicElement.play()
      } else if (!this.bgMusicElement) {
        // Chưa có -> tạo mới và phát
        this.playBackgroundMusic()
      }
    } else {
      // Nên dừng nhạc (vì tắt hoặc volume = 0)
      if (this.bgMusicElement && !this.bgMusicElement.paused) {
        this.bgMusicElement.pause()
        console.log('Đã dừng nhạc (bgMusic:', isEnabled, 'volume:', volume, ')')
      }
    }
    
    console.log('Cài đặt đã cập nhật:', this.settings)
  }
```

---

## Bước 7: Hàm Lấy Cài Đặt Hiện Tại

```typescript
  /**
   * Lấy bản sao cài đặt hiện tại
   * Dùng spread operator {...} để tạo bản sao, tránh sửa trực tiếp
   */
  getSettings(): AudioSettings {
    return { ...this.settings }
  }
```

---

## Bước 8: Export Singleton Instance

```typescript
// Tạo DUY NHẤT 1 instance và export
export const AudioManager = new AudioManagerClass()
```

---

## Bước 9: Hàm Đọc Cài Đặt Từ localStorage

```typescript
/**
 * Đọc cài đặt âm thanh từ localStorage
 * Nếu không có thì trả về giá trị mặc định
 */
export function loadAudioSettingsFromStorage(): AudioSettings {
  try {
    // Đọc từ localStorage
    const stored = localStorage.getItem('gameSettings')
    
    if (stored) {
      // Parse JSON string thành object
      const settings = JSON.parse(stored)
      
      // Trả về với giá trị mặc định nếu thiếu field
      // ?? là nullish coalescing operator
      // Nghĩa là: nếu bên trái là null/undefined thì dùng bên phải
      return {
        bgMusic: settings.bgMusic ?? true,
        bgMusicVolume: settings.bgMusicVolume ?? 70,
        sfxEnabled: settings.sfxEnabled ?? true,
        sfxVolume: settings.sfxVolume ?? 80
      }
    }
  } catch (error) {
    console.error('Lỗi đọc cài đặt:', error)
  }

  // Trả về mặc định nếu không có hoặc lỗi
  return {
    bgMusic: true,
    bgMusicVolume: 70,
    sfxEnabled: true,
    sfxVolume: 80
  }
}
```

---

## Bước 10: Sử Dụng Trong React Component

### 10.1. Khởi tạo khi App load

```tsx
// App.tsx
import { useEffect } from 'react'
import { AudioManager, loadAudioSettingsFromStorage } from './lib/AudioManager'

function App() {
  useEffect(() => {
    // Đọc cài đặt từ localStorage
    const settings = loadAudioSettingsFromStorage()
    
    // Khởi tạo AudioManager
    AudioManager.initialize(settings)
    
    // Phát nhạc nền (nếu được bật)
    AudioManager.playBackgroundMusic()
  }, [])  // [] = chỉ chạy 1 lần khi mount
  
  return <div>...</div>
}
```

### 10.2. Tạo UI Cài Đặt

```tsx
// SettingsPanel.tsx
import { useState, useEffect } from 'react'
import { AudioManager } from '../lib/AudioManager'

function SettingsPanel() {
  // State lưu cài đặt hiện tại
  const [settings, setSettings] = useState({
    bgMusic: true,
    bgMusicVolume: 70,
    sfxEnabled: true,
    sfxVolume: 80
  })
  
  // Load cài đặt khi component mount
  useEffect(() => {
    const saved = localStorage.getItem('gameSettings')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
  }, [])
  
  // Hàm xử lý khi thay đổi cài đặt
  const handleChange = (key: string, value: boolean | number) => {
    // Cập nhật state
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    
    // Lưu vào localStorage
    localStorage.setItem('gameSettings', JSON.stringify(newSettings))
    
    // Cập nhật AudioManager
    AudioManager.updateSettings({ [key]: value })
  }
  
  return (
    <div className="settings-panel">
      {/* Toggle bật/tắt nhạc nền */}
      <div className="setting-row">
        <label>Nhạc nền</label>
        <input
          type="checkbox"
          checked={settings.bgMusic}
          onChange={(e) => handleChange('bgMusic', e.target.checked)}
        />
      </div>
      
      {/* Slider âm lượng nhạc nền */}
      <div className="setting-row">
        <label>Âm lượng nhạc: {settings.bgMusicVolume}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.bgMusicVolume}
          onChange={(e) => handleChange('bgMusicVolume', Number(e.target.value))}
        />
      </div>
      
      {/* Toggle bật/tắt SFX */}
      <div className="setting-row">
        <label>Hiệu ứng âm thanh</label>
        <input
          type="checkbox"
          checked={settings.sfxEnabled}
          onChange={(e) => handleChange('sfxEnabled', e.target.checked)}
        />
      </div>
      
      {/* Slider âm lượng SFX */}
      <div className="setting-row">
        <label>Âm lượng hiệu ứng: {settings.sfxVolume}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.sfxVolume}
          onChange={(e) => handleChange('sfxVolume', Number(e.target.value))}
        />
      </div>
    </div>
  )
}
```

---

## Lưu Ý Quan Trọng

### 1. Autoplay Policy (Chính sách tự động phát)
Trình duyệt hiện đại CHẶN việc tự động phát âm thanh. Nhạc chỉ phát được sau khi người dùng tương tác (click, tap...).

**Giải pháp:** Phát nhạc sau khi user click vào app lần đầu.

### 2. Volume = 0 phải dừng nhạc
Khi âm lượng = 0, nên PAUSE nhạc thay vì chỉ set volume = 0. Lý do:
- Tiết kiệm tài nguyên
- Tránh nhầm lẫn (user nghĩ đã tắt nhưng thực ra vẫn chạy)

### 3. Đồng bộ giữa các nguồn
Khi có nhiều nơi thay đổi cài đặt (Settings page, Quick settings...), cần đảm bảo:
- Tất cả đều gọi `AudioManager.updateSettings()`
- Tất cả đều lưu vào cùng 1 key trong localStorage

### 4. Xử lý lỗi khi load file âm thanh
```typescript
audio.onerror = (event) => {
  console.error('Không thể load file âm thanh:', event)
  // Có thể fallback sang file mặc định
}
```

---

## Tóm Tắt Flow (Luồng Hoạt Động)

```
1. App khởi động
   ↓
2. Đọc cài đặt từ localStorage
   ↓
3. Khởi tạo AudioManager với cài đặt
   ↓
4. Phát nhạc nền (nếu được bật và volume > 0)
   ↓
5. User thay đổi cài đặt trong UI
   ↓
6. Gọi AudioManager.updateSettings()
   ↓
7. AudioManager xử lý: cập nhật volume, play/pause
   ↓
8. Lưu cài đặt mới vào localStorage
   ↓
9. Lần sau mở app → quay lại bước 2
```

---

## Bài Tập Thực Hành

1. **Cơ bản:** Tạo AudioManager đơn giản chỉ với nhạc nền
2. **Trung bình:** Thêm chức năng SFX (hiệu ứng âm thanh)
3. **Nâng cao:** Cho phép user chọn bài nhạc nền từ danh sách
4. **Thử thách:** Thêm chức năng fade in/out khi chuyển bài

---

## Thuật Ngữ Giải Thích

| Thuật ngữ | Giải thích |
|-----------|------------|
| **Singleton** | Mẫu thiết kế đảm bảo chỉ có 1 instance duy nhất |
| **localStorage** | Bộ nhớ lưu trữ trên trình duyệt |
| **HTMLAudioElement** | Đối tượng JavaScript để phát âm thanh |
| **Interface** | Bản thiết kế mô tả cấu trúc dữ liệu |
| **Partial<T>** | Kiểu dữ liệu cho phép chỉ truyền 1 phần của T |
| **Mount** | Khi component được render lần đầu |
| **State** | Dữ liệu thay đổi được trong component |
| **useEffect** | Hook chạy code sau khi render |
| **Spread operator (...)** | Toán tử trải rộng, copy object/array |
| **Nullish coalescing (??)** | Toán tử trả về giá trị phải nếu trái là null/undefined |
