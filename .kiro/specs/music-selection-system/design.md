# Music Selection System - Design

## Architecture

### 1. Database Schema
Sử dụng các bảng có sẵn:
- `items`: Lưu thông tin nhạc (category='music', preview_url=URL file nhạc)
- `user_items`: Lưu nhạc đã mua, is_equipped=true cho nhạc đang dùng
- `profiles.settings`: JSON chứa selected_music_id

### 2. Components

#### AudioManager Updates
```typescript
// Thêm method để set custom music
setBackgroundMusic(musicUrl: string | null)
getCurrentMusicId(): string | null
```

#### Inventory Updates
- Thêm nút Preview cho category music
- Khi Use nhạc: update is_equipped và gọi AudioManager

#### Profile/Settings Updates
- Thêm MusicSelector component trong tab Sound
- Load owned music từ user_items
- Dropdown với preview button

### 3. Data Flow

```
Shop (mua nhạc) → user_items (lưu)
                      ↓
Inventory (xem/chọn) → is_equipped=true
                      ↓
Settings (dropdown) ← load từ user_items
                      ↓
AudioManager (play) ← get music URL từ equipped item
```

### 4. API Endpoints
Không cần API mới, sử dụng Supabase client trực tiếp.

## Implementation Details

### MusicSelector Component
```tsx
interface MusicItem {
  id: string
  name: string
  preview_url: string
  is_equipped: boolean
}

function MusicSelector() {
  const [ownedMusic, setOwnedMusic] = useState<MusicItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  
  // Load owned music on mount
  // Handle selection change
  // Handle preview play/stop
}
```

### AudioManager Changes
```typescript
class AudioManagerClass {
  private currentMusicUrl: string = '/assets/music/Saos.wav' // default
  private currentMusicId: string | null = null
  
  setBackgroundMusic(url: string | null, id: string | null) {
    this.currentMusicUrl = url || '/assets/music/Saos.wav'
    this.currentMusicId = id
    if (this.settings.bgMusic) {
      this.stopBackgroundMusic()
      this.playBackgroundMusic()
    }
  }
  
  getCurrentMusicId(): string | null {
    return this.currentMusicId
  }
}
```

### Inventory Music Card
- Thêm nút Preview (play/pause icon)
- Preview audio element riêng, không ảnh hưởng background music
- Khi Use: stop preview, update DB, notify AudioManager
