Header:
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ○ Avatar  username (Rank: Đồng)   |  MindPoint Arena  |   Coin: 15.3k | Gem: 1k |   ✉│ 
└────────────────────────────────────────────────────────────────────────────────────────┘
Home:
┌────────────────────────┬──────────────────────────────────────────────┬──────────────────┐
│ [A]                    │                       [C]                     │        [D]       │
│  🛒  Shop              │   ┌───────────────────────────────────────┐  │  BANNER EVENT    |
│  🏆  Xem rank          │   │          ẢNH HERO / ART CARO         │   │  HIGHLIGHT       │
│  🎒  Inventory         │   │ (nhân vật + bàn cờ / cảnh tu tiên)   │   │  (carousel < >)  │
│  🎯  Nhiệm vụ          │   |                                      |   └──────────────────┘
│  🏅  Thành tựu         │   |                                      |   ┌───────────────────┐
│  📘  Hướng dẫn         │   │        ❝  VÔ DANH THÀNH VÔ ĐỐI  ❞    │   │        [E]        │
│                        │   │                                       │  │  KHỐI PHỤ BÊNPHẢI │
│                        │   │       [  🔮  GHÉP TRẬN NGAY  ]        │  │  (BẠN BÈ / CHAT / │
│                       │   │                                       │   │   INFO NGẮN... )  │
│                       │   │  [ 🏆  RANK ]  [ 🤝  ĐẤU VỚI BẠN ]    │   └───────────────────┘
|                       ┤   │  [ 🤖  MÁY ]   [ 🏠  TẠO PHÒNG RIÊNG ]│                       |
|   Đăng xuất           │   └───────────────────────────────────────┘                       |
└────────────────────────└───────────────────────────────────────────────┴──────────────────┘

You are a senior UI/UX designer and front-end architect for a fantasy xianxia anime web game.

Goal:
Turn the plaintext wireframe specification below into a high-fidelity desktop web lobby UI for the caro/gomoku game “MindPoint Arena”. Keep the exact structure and information architecture, but design it with a premium AAA xianxia anime style and modern glassmorphism.

Overall style:
- Resolution: 1920x1080 desktop.
- Dark blue–purple night sky background, floating mountains and spiritual clouds (xianxia atmosphere).
- Strong visual hierarchy, clean layout on a 12-column grid:
  - Left column ≈ 3/12 width (sidebar A).
  - Center column ≈ 6/12 width (content C).
  - Right column ≈ 3/12 width (blocks D and E).
- Visual style: glassmorphism (frosted glass cards, soft inner glow, cyan rim light, subtle shadows), smooth gradients, crisp text, no noise or film grain.

Header (top, full width):
- A glowing glass bar aligned to the top.
- Left section:
  - Circular avatar portrait.
  - Two lines of text: 
    - Username
    - “Rank: Đồng”
- Center section:
  - Big game title text: “MINDPOINT ARENA” with cyan + golden mystical glow.
- Right section:
  - Currency area: 
    - “Coin: 15.3k” with a jade spirit stone icon.
    - “Gem: 1k” with a purple soul orb icon.
  - Small mail icon and settings (gear) icon.

Left sidebar [A] – main navigation:
- A tall frosted glass vertical card, aligned under the header, reaching near the bottom of the screen.
- Each menu item is a row with a small line icon + Vietnamese label:
  1. Shop
  2. Xem rank
  3. Inventory
  4. Nhiệm vụ
  5. Bạn bè
  6. Hướng dẫn
  7. Xem lại trận đấu
  8. Thành tựu
- At the very bottom: a red text link-style button “Đăng xuất”.
- Hover states: item background slightly brighter, cyan border highlight.

Center column [C] – hero art & matchmaking:
- Top card: “ẢNH HERO / ART CARO”
  - Large glassmorphism card.
  - Inside, show an anime xianxia hero character standing on a glowing caro/gomoku board.
  - The board is clearly a 15x15 grid, glowing lines, surrounded by fantasy scenery (trees, rocks, magical particles).
  - Small label in a corner: “ẢNH HERO / ART CARO”.
- Bottom card: “VÔ DANH THÀNH VÔ ĐỐI”
  - Another glass card below the art.
  - Large headline centered: “VÔ DANH THÀNH VÔ ĐỐI”.
  - Subtext line explaining: “Leo rank MindPoint từ Vô Danh đến Vô Đối chỉ với vài ván mỗi ngày”.
  - Primary CTA button centered:
    - Text: “GHÉP TRẬN NGAY”
    - Large pill shape, bright cyan-to-emerald gradient, strong outer glow, breathing animation feeling.
  - Below the primary button, 4 smaller mode buttons in one row:
    - “RANK” with a trophy icon.
    - “ĐẤU VỚI BẠN” with a versus/friends icon.
    - “MÁY” with a robot icon.
    - “TẠO PHÒNG RIÊNG” with a house/door icon.
  - These secondary buttons are smaller glass pills with cyan outline.

Right column [D] and [E]:
- [D] Event banner (top):
  - Glass card aligned with the hero art height.
  - Title text at top: “BANNER EVENT HIGHLIGHT”.
  - Main image: xianxia city gate or temple with a giant glowing caro board, representing an in-game event.
  - Carousel controls:
    - Left and right arrows (“<” and “>”).
    - Dots at the bottom indicating multiple slides.
- [E] Social/info block (bottom):
  - Glass card under the event banner.
  - Tab bar at the top with three tabs:
    - “Bạn bè”
    - “Chat”
    - “Info”
  - Active tab has cyan underline and brighter label.

  - Friends tab content:
    - Search bar at the top: pill shape, search icon + placeholder text “Tìm bạn…”.
    - Friend suggestions in a 2-column grid with vertical scroll:
      - Each entry has avatar, name, rank, and a small “Mời” button.
  - Chat tab content:
    - Simple chat list: avatar + name + last message.
    - Input area at the bottom: text field and send icon.
  - Info tab content:
    - Small informational cards for “Tip chơi Caro hôm nay”, “Thông báo sự kiện”, etc.

Interaction & polish:
- Use consistent spacing based on an 8px spacing system.
- Use at most 2–3 font sizes per hierarchy level: large (titles), medium (section headings), small (labels and hints).
- Colors: primary accent cyan/teal, secondary accent emerald/gold; ensure good contrast and readability.
- All edges slightly rounded (16–24 px) for large cards.
- All icons share one visual style (line or flat with gradient), tuned to xianxia anime.

Output:
- Produce a detailed UI description that a designer or front-end engineer could implement, focusing on the exact layout (per section A/C/D/E), component states, and the xianxia anime art direction.
note : bento grid với C được phân cấp thị giác cao nhất 
        không scroll cả trang 