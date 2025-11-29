import React, { createContext, useContext, useState, useEffect } from 'react'

type Language = 'vi' | 'en' | 'zh' | 'ja'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, any>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Translations
const translations: Record<Language, Record<string, string>> = {
  vi: {
    // Navigation
    'nav.home': 'Trang Chủ',
    'nav.lobby': 'Phòng Chờ',
    'nav.shop': 'Cửa Hàng',
    'nav.profile': 'Tiểu Phụ',
    'nav.inventory': 'Kho Đồ',
    'nav.quests': 'Nhiệm Vụ',
    'nav.events': 'Sự Kiện',
    'nav.guide': 'Hướng Dẫn',
    'nav.logout': 'Đăng Xuất',
    
    // Home Navigation (for mobile menu)
    'home.nav.shop': 'Tiêu Bảo Các',
    'home.nav.inventory': 'Túi Trữ Vật',
    'home.nav.quests': 'Tiên Duyên',
    'home.nav.events': 'Thiên Cơ Biến',
    'home.nav.khaiNhan': 'Khai Nhãn',
    'home.nav.guide': 'Bí Tịch',
    'home.nav.mentor': 'Cao Nhân Chỉ Điểm',
    
    // Home page
    'home.welcome': 'Chào mừng đến với Mindpoint Arena',
    'home.quickMatch': 'Tìm Trận Nhanh',
    'home.ranked': 'Rank',
    'home.training': 'Luyện Tập',
    'home.createRoom': 'Tạo Phòng',
    'home.hotseat': 'Chơi Local',
    'home.onlinePlayers': 'Người chơi online',
    'home.rank': 'Cấp bậc',
    'home.winRate': 'Tỷ lệ thắng',
    'home.totalMatches': 'Tổng số trận',
    
    // Home Hero Section
    'home.hero.title': 'VÔ DANH THÀNH VÔ ĐỐI',
    'home.hero.subtitle': '     Thủ kỳ lặng bóng vô danh\nHạ kỳ vạn trận thành danh muôn đời',
    'home.hero.ctaQuickMatch': 'GHÉP TRẬN NGAY',
    'home.hero.ctaRankNote': 'Rank',
    
    // Home Game Modes
    'home.modes.ranked': 'DỊ BIẾN KỲ',
    'home.modes.tournament': 'VẠN MÔN TRANH ĐẤU',
    'home.modes.training': 'THÍ LUYỆN',
    'home.modes.hotseat': 'KỲ TỰ TRẬN',
    
    // Training Modal
    'home.training.title': 'Phòng Thí Luyện',
    'home.training.subtitle': 'Chọn độ khó bot để luyện tập trước khi leo rank.',
    
    // Home Events
    'home.events.thienCoBien.title': 'THIÊN CƠ BIẾN',
    'home.events.thienCoBien.subtitle': 'Sự kiện giải đấu lớn',
    'home.events.thienCoBien.chip': 'ĐẶC BIỆT',
    'home.events.thienCoBien.highlight': 'Thưởng x2 Mindpoint',
    'home.events.thienCoBien.timeline': '3 ngày còn lại',
    'home.events.thienCoBien.reward': '🏆 1000 Kim Cương',
    'home.events.thienCoBien.ctaLabel': 'Tham gia',
    'home.events.luaTraiDaiHoi.title': 'LỬA TRẠI ĐẠI HỘI',
    'home.events.luaTraiDaiHoi.subtitle': 'Đấu đội 3v3',
    'home.events.luaTraiDaiHoi.chip': 'MỚI',
    'home.events.luaTraiDaiHoi.highlight': 'Chế độ chơi mới',
    'home.events.luaTraiDaiHoi.timeline': '7 ngày còn lại',
    'home.events.luaTraiDaiHoi.reward': '💎 500 Gem + Skin',
    'home.events.luaTraiDaiHoi.ctaLabel': 'Khám phá',
    'home.events.tuyetDinhSongDau.title': 'TUYỆT ĐỈNH SONG ĐẤU',
    'home.events.tuyetDinhSongDau.subtitle': '1v1 vô địch',
    'home.events.tuyetDinhSongDau.chip': 'RANK',
    'home.events.tuyetDinhSongDau.highlight': 'Leo rank nhanh x3',
    'home.events.tuyetDinhSongDau.timeline': '5 ngày còn lại',
    'home.events.tuyetDinhSongDau.reward': '⭐ Top 1: 2000 Gem',
    'home.events.tuyetDinhSongDau.ctaLabel': 'Tham chiến',
    
    // Home Social Tabs
    'home.social.friends': 'Đạo Hữu',
    'home.social.chat': 'Truyền Âm',
    'home.social.info': 'Cao Nhân',
    
    // Home Friends
    'home.friends.title': 'Đạo Hữu',
    'home.friends.connections': '{count} kết nối',
    'home.friends.onlineCount': '{count} online',
    'home.friends.loading': 'Đang tải...',
    'home.friends.refresh': '🔄 Làm mới',
    'home.friends.searchPlaceholder': '🔍 Tìm đạo hữu...',
    'home.friends.filterAll': 'Tất cả',
    'home.friends.filterOnline': 'Online',
    'home.friends.filterIncoming': 'Lời mời đến',
    'home.friends.filterOutgoing': 'Đã gửi',
    'home.friends.challenge': 'Thách đấu',
    'home.friends.daysAgo': '{count} ngày trước',
    'home.friends.hoursAgo': '{count} giờ trước',
    'home.friends.minutesAgo': '{count} phút trước',
    'home.friends.justNow': 'Vừa xong',
    'home.friends.hidden': 'Ẩn',
    'home.friends.anonymousUser': 'Ẩn danh',
    'home.friends.anonymous': 'Vô danh',
    'home.friends.friendRequestSent': '{name} đã gửi lời mời kết bạn',
    'home.friends.friendRequestAccepted': '{name} đã chấp nhận lời mời',
    'home.friends.emptyStateAll': 'Chưa có đạo hữu nào',
    'home.friends.emptyStateOnline': 'Không có đạo hữu online',
    'home.friends.emptyStateIncoming': 'Không có lời mời đến',
    'home.friends.emptyStateOutgoing': 'Chưa gửi lời mời nào',
    
    // Profile
    'profile.overview': 'Chính Điện',
    'profile.settings': 'Tiền Phủ',
    'profile.history': 'Lịch sử đấu',
    'profile.totalGames': 'Tổng quan',
    'profile.settingsTitle': 'Cài đặt',
    'profile.account': 'Tài khoản',
    'profile.ui': 'Giao diện',
    'profile.sound': 'Âm thanh',
    'profile.board': 'Bàn cờ & Nước đi',
    'profile.notifications': 'Thông báo',
    'profile.language': 'Ngôn ngữ',
    'profile.other': 'Khác',
    'profile.username': 'Tên người chơi',
    'profile.email': 'Email',
    'profile.changePassword': 'Đổi mật khẩu',
    'profile.theme': 'Giao diện',
    'profile.themeDark': 'Tối',
    'profile.themeLight': 'Sáng',
    'profile.uiEffects': 'Hiệu ứng UI',
    'profile.effectsQuality': 'Chất lượng hiệu ứng',
    'profile.effectsHigh': 'Cao',
    'profile.effectsMedium': 'Trung bình',
    'profile.effectsLow': 'Thấp',
    'profile.fontSize': 'Kích thước chữ',
    'profile.fontSmall': 'Nhỏ',
    'profile.fontMedium': 'Vừa',
    'profile.fontLarge': 'Lớn',
    'profile.sfx': 'Âm thanh hiệu ứng',
    'profile.bgMusic': 'Nhạc nền',
    'profile.volume': 'Âm lượng',
    'profile.highlightLastMove': 'Đánh dấu nước đi cuối',
    'profile.showWinningLine': 'Hiển thị đường thắng',
    'profile.pieceDropEffect': 'Hiệu ứng đặt quân',
    'profile.showHints': 'Hiển thị gợi ý',
    'profile.boardSkin': 'Giao diện bàn cờ',
    'profile.systemNotif': 'Thông báo hệ thống',
    'profile.inviteNotif': 'Lời mời đấu',
    'profile.chatNotif': 'Tin nhắn',
    'profile.turnNotif': 'Lượt đi',
    'profile.restoreDefaults': 'Khôi phục cài đặt gốc',
    
    // Shop
    'shop.title': 'Cửa Hàng',
    'shop.coins': 'Vàng',
    'shop.gems': 'Kim cương',
    'shop.featured': 'Nổi bật',
    'shop.avatars': 'Khung Avatar',
    'shop.boardSkins': 'Giao diện bàn cờ',
    'shop.emotes': 'Biểu cảm',
    'shop.buy': 'Mua',
    'shop.owned': 'Đã sở hữu',
    'shop.equipped': 'Đang dùng',
    
    // Quests
    'quests.title': 'Nhiệm Vụ',
    'quests.daily': 'Hằng ngày',
    'quests.weekly': 'Hằng tuần',
    'quests.achievements': 'Thành tựu',
    'quests.progress': 'Tiến độ',
    'quests.claim': 'Nhận thưởng',
    'quests.completed': 'Hoàn thành',
    
    // Events
    'events.title': 'Sự Kiện',
    'events.current': 'Đang diễn ra',
    'events.upcoming': 'Sắp tới',
    'events.past': 'Đã kết thúc',
    'events.joinNow': 'Tham gia ngay',
    'events.viewDetails': 'Xem chi tiết',
    
    // Lobby
    'lobby.title': 'Phòng Chờ',
    'lobby.findMatch': 'Tìm trận',
    'lobby.createRoom': 'Tạo phòng',
    'lobby.joinRoom': 'Vào phòng',
    'lobby.roomCode': 'Mã phòng',
    'lobby.searching': 'Đang tìm...',
    'lobby.cancel': 'Hủy',
    
    // Common
    'common.save': 'Lưu',
    'common.cancel': 'Hủy',
    'common.confirm': 'Xác nhận',
    'common.close': 'Đóng',
    'common.yes': 'Có',
    'common.no': 'Không',
    'common.ok': 'OK',
    'common.loading': 'Đang tải...',
    'common.error': 'Lỗi',
    'common.success': 'Thành công',
    'common.level': 'Cấp',
    'common.exp': 'Kinh nghiệm',
    'common.wins': 'Thắng',
    'common.losses': 'Thua',
    'common.draws': 'Hòa',
    
    // Settings Popup
    'settings.title': 'Cài đặt nhanh',
    'settings.subtitle': 'Điều chỉnh âm thanh & hiệu ứng',
    'settings.sfx': 'Âm thanh hiệu ứng',
    'settings.bgMusic': 'Nhạc nền',
    'settings.notification': 'Thông báo',
    'settings.language': 'Ngôn ngữ',
    'settings.effects': 'Hiệu ứng',
    'settings.effectsHigh': 'Cao',
    'settings.effectsMedium': 'Trung bình',
    'settings.effectsLow': 'Thấp',
    
    // Rank System
    'rank.label': 'Cảnh Giới',
    'rank.vo_danh': 'Vô Danh',
    'rank.tan_ky': 'Tân Kỳ',
    'rank.hoc_ky': 'Học Kỳ',
    'rank.ky_lao': 'Kỳ Lão',
    'rank.cao_ky': 'Cao Kỳ',
    'rank.ky_thanh': 'Kỳ Thánh',
    'rank.truyen_thuyet': 'Truyền Thuyết',
  },
  
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.lobby': 'Lobby',
    'nav.shop': 'Shop',
    'nav.profile': 'Profile',
    'nav.inventory': 'Inventory',
    'nav.quests': 'Quests',
    'nav.events': 'Events',
    'nav.guide': 'Guide',
    'nav.logout': 'Logout',
    
    // Home Navigation (for mobile menu)
    'home.nav.shop': 'Shop',
    'home.nav.inventory': 'Inventory',
    'home.nav.quests': 'Quests',
    'home.nav.events': 'Events',
    'home.nav.khaiNhan': 'Rank',
    'home.nav.guide': 'Guide',
    'home.nav.mentor': 'Replay Analysis',
    
    // Home page
    'home.welcome': 'Welcome to Mindpoint Arena',
    'home.quickMatch': 'Quick Match',
    'home.ranked': 'Ranked',
    'home.training': 'Training',
    'home.createRoom': 'Create Room',
    'home.hotseat': 'Local Play',
    'home.onlinePlayers': 'Online players',
    'home.rank': 'Rank',
    'home.winRate': 'Win rate',
    'home.totalMatches': 'Total matches',
    
    // Home Hero Section
    'home.hero.title': 'FROM UNKNOWN TO UNBEATABLE',
    'home.hero.subtitle': 'Play now, improve every day - Your legend starts here',
    'home.hero.ctaQuickMatch': 'QUICK MATCH',
    'home.hero.ctaRankNote': 'Rank',
    
    // Home Game Modes
    'home.modes.ranked': 'RANKED ARENA',
    'home.modes.tournament': 'TOURNAMENT',
    'home.modes.training': 'TRAINING HALL',
    'home.modes.hotseat': 'LOCAL DUEL',
    
    // Training Modal
    'home.training.title': 'Training Hall',
    'home.training.subtitle': 'Choose bot difficulty to practice before climbing ranks.',
    
    // Home Events
    'home.events.thienCoBien.title': 'HEAVEN\'S GAMBIT',
    'home.events.thienCoBien.subtitle': 'Major Tournament',
    'home.events.thienCoBien.chip': 'SPECIAL',
    'home.events.thienCoBien.highlight': 'x2 Mindpoint Reward',
    'home.events.thienCoBien.timeline': '3 days left',
    'home.events.thienCoBien.reward': '🏆 1000 Diamonds',
    'home.events.thienCoBien.ctaLabel': 'Join Now',
    'home.events.luaTraiDaiHoi.title': 'CAMPFIRE GATHERING',
    'home.events.luaTraiDaiHoi.subtitle': '3v3 Team Battle',
    'home.events.luaTraiDaiHoi.chip': 'NEW',
    'home.events.luaTraiDaiHoi.highlight': 'New Game Mode',
    'home.events.luaTraiDaiHoi.timeline': '7 days left',
    'home.events.luaTraiDaiHoi.reward': '💎 500 Gems + Skin',
    'home.events.luaTraiDaiHoi.ctaLabel': 'Explore',
    'home.events.tuyetDinhSongDau.title': 'ULTIMATE DUEL',
    'home.events.tuyetDinhSongDau.subtitle': '1v1 Championship',
    'home.events.tuyetDinhSongDau.chip': 'RANKED',
    'home.events.tuyetDinhSongDau.highlight': 'x3 Rank Speed',
    'home.events.tuyetDinhSongDau.timeline': '5 days left',
    'home.events.tuyetDinhSongDau.reward': '⭐ Top 1: 2000 Gems',
    'home.events.tuyetDinhSongDau.ctaLabel': 'Join Battle',
    
    // Home Social Tabs
    'home.social.friends': 'Friends',
    'home.social.chat': 'Chat',
    'home.social.info': 'AI Guide',
    
    // Home Friends
    'home.friends.title': 'Friends',
    'home.friends.connections': '{count} connections',
    'home.friends.onlineCount': '{count} online',
    'home.friends.loading': 'Loading...',
    'home.friends.refresh': '🔄 Refresh',
    'home.friends.searchPlaceholder': '🔍 Search friends...',
    'home.friends.filterAll': 'All',
    'home.friends.filterOnline': 'Online',
    'home.friends.filterIncoming': 'Incoming',
    'home.friends.filterOutgoing': 'Sent',
    'home.friends.challenge': 'Challenge',
    'home.friends.daysAgo': '{count} days ago',
    'home.friends.hoursAgo': '{count} hours ago',
    'home.friends.minutesAgo': '{count} minutes ago',
    'home.friends.justNow': 'Just now',
    'home.friends.hidden': 'Hidden',
    'home.friends.anonymousUser': 'Anonymous',
    'home.friends.anonymous': 'Unknown',
    'home.friends.friendRequestSent': '{name} sent you a friend request',
    'home.friends.friendRequestAccepted': '{name} accepted your request',
    'home.friends.emptyStateAll': 'No friends yet',
    'home.friends.emptyStateOnline': 'No friends online',
    'home.friends.emptyStateIncoming': 'No incoming requests',
    'home.friends.emptyStateOutgoing': 'No sent requests',
    
    // Profile
    'profile.overview': 'Overview',
    'profile.settings': 'Settings',
    'profile.history': 'Match History',
    'profile.totalGames': 'Total Games',
    'profile.settingsTitle': 'Settings',
    'profile.account': 'Account',
    'profile.ui': 'Interface',
    'profile.sound': 'Sound',
    'profile.board': 'Board & Moves',
    'profile.notifications': 'Notifications',
    'profile.language': 'Language',
    'profile.other': 'Other',
    'profile.username': 'Username',
    'profile.email': 'Email',
    'profile.changePassword': 'Change Password',
    'profile.theme': 'Theme',
    'profile.themeDark': 'Dark',
    'profile.themeLight': 'Light',
    'profile.uiEffects': 'UI Effects',
    'profile.effectsQuality': 'Effects Quality',
    'profile.effectsHigh': 'High',
    'profile.effectsMedium': 'Medium',
    'profile.effectsLow': 'Low',
    'profile.fontSize': 'Font Size',
    'profile.fontSmall': 'Small',
    'profile.fontMedium': 'Medium',
    'profile.fontLarge': 'Large',
    'profile.sfx': 'Sound Effects',
    'profile.bgMusic': 'Background Music',
    'profile.volume': 'Volume',
    'profile.highlightLastMove': 'Highlight Last Move',
    'profile.showWinningLine': 'Show Winning Line',
    'profile.pieceDropEffect': 'Piece Drop Effect',
    'profile.showHints': 'Show Hints',
    'profile.boardSkin': 'Board Skin',
    'profile.systemNotif': 'System Notifications',
    'profile.inviteNotif': 'Game Invites',
    'profile.chatNotif': 'Chat Messages',
    'profile.turnNotif': 'Turn Notifications',
    'profile.restoreDefaults': 'Restore Defaults',
    
    // Shop
    'shop.title': 'Shop',
    'shop.coins': 'Coins',
    'shop.gems': 'Gems',
    'shop.featured': 'Featured',
    'shop.avatars': 'Avatar Frames',
    'shop.boardSkins': 'Board Skins',
    'shop.emotes': 'Emotes',
    'shop.buy': 'Buy',
    'shop.owned': 'Owned',
    'shop.equipped': 'Equipped',
    
    // Quests
    'quests.title': 'Quests',
    'quests.daily': 'Daily',
    'quests.weekly': 'Weekly',
    'quests.achievements': 'Achievements',
    'quests.progress': 'Progress',
    'quests.claim': 'Claim',
    'quests.completed': 'Completed',
    
    // Events
    'events.title': 'Events',
    'events.current': 'Current',
    'events.upcoming': 'Upcoming',
    'events.past': 'Past',
    'events.joinNow': 'Join Now',
    'events.viewDetails': 'View Details',
    
    // Lobby
    'lobby.title': 'Lobby',
    'lobby.findMatch': 'Find Match',
    'lobby.createRoom': 'Create Room',
    'lobby.joinRoom': 'Join Room',
    'lobby.roomCode': 'Room Code',
    'lobby.searching': 'Searching...',
    'lobby.cancel': 'Cancel',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.ok': 'OK',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.level': 'Level',
    'common.exp': 'Experience',
    'common.wins': 'Wins',
    'common.losses': 'Losses',
    'common.draws': 'Draws',
    
    // Settings Popup
    'settings.title': 'Quick Settings',
    'settings.subtitle': 'Adjust sound & effects',
    'settings.sfx': 'Sound Effects',
    'settings.bgMusic': 'Background Music',
    'settings.notification': 'Notifications',
    'settings.language': 'Language',
    'settings.effects': 'Effects',
    'settings.effectsHigh': 'High',
    'settings.effectsMedium': 'Medium',
    'settings.effectsLow': 'Low',
    
    // Rank System
    'rank.label': 'Rank',
    'rank.vo_danh': 'Unranked',
    'rank.tan_ky': 'Novice',
    'rank.hoc_ky': 'Apprentice',
    'rank.ky_lao': 'Veteran',
    'rank.cao_ky': 'Master',
    'rank.ky_thanh': 'Grandmaster',
    'rank.truyen_thuyet': 'Legend',
  },
  
  zh: {
    // Navigation
    'nav.home': '主页',
    'nav.lobby': '大厅',
    'nav.shop': '商店',
    'nav.profile': '档案',
    'nav.inventory': '背包',
    'nav.quests': '任务',
    'nav.events': '活动',
    'nav.guide': '指南',
    'nav.logout': '登出',
    
    // Home Navigation (for mobile menu)
    'home.nav.shop': '商店',
    'home.nav.inventory': '背包',
    'home.nav.quests': '任务',
    'home.nav.events': '活动',
    'home.nav.khaiNhan': '排位',
    'home.nav.guide': '指南',
    'home.nav.mentor': '复盘分析',
    
    // Home page
    'home.welcome': '欢迎来到Mindpoint Arena',
    'home.quickMatch': '快速匹配',
    'home.ranked': '排位赛',
    'home.training': '训练',
    'home.createRoom': '创建房间',
    'home.hotseat': '本地游戏',
    'home.onlinePlayers': '在线玩家',
    'home.rank': '等级',
    'home.winRate': '胜率',
    'home.totalMatches': '总场次',
    
    // Home Hero Section
    'home.hero.title': '从无名到无敌',
    'home.hero.subtitle': '立刻开局，日日精进 - 传奇从此刻开始',
    'home.hero.ctaQuickMatch': '快速匹配',
    'home.hero.ctaRankNote': '排位',
    
    // Home Game Modes
    'home.modes.ranked': '排位竞技场',
    'home.modes.tournament': '万门争锋',
    'home.modes.training': '修炼场',
    'home.modes.hotseat': '棋局对弈',
    
    // Training Modal
    'home.training.title': '修炼场',
    'home.training.subtitle': '选择机器人难度进行练习，为排位赛做准备。',
    
    // Home Events
    'home.events.thienCoBien.title': '天机变',
    'home.events.thienCoBien.subtitle': '大型锦标赛',
    'home.events.thienCoBien.chip': '特别',
    'home.events.thienCoBien.highlight': 'x2 Mindpoint奖励',
    'home.events.thienCoBien.timeline': '剩余3天',
    'home.events.thienCoBien.reward': '🏆 1000钻石',
    'home.events.thienCoBien.ctaLabel': '立即加入',
    'home.events.luaTraiDaiHoi.title': '篝火大会',
    'home.events.luaTraiDaiHoi.subtitle': '3v3团队战',
    'home.events.luaTraiDaiHoi.chip': '新',
    'home.events.luaTraiDaiHoi.highlight': '新游戏模式',
    'home.events.luaTraiDaiHoi.timeline': '剩余7天',
    'home.events.luaTraiDaiHoi.reward': '💎 500宝石+皮肤',
    'home.events.luaTraiDaiHoi.ctaLabel': '探索',
    'home.events.tuyetDinhSongDau.title': '巅峰对决',
    'home.events.tuyetDinhSongDau.subtitle': '1v1冠军赛',
    'home.events.tuyetDinhSongDau.chip': '排位',
    'home.events.tuyetDinhSongDau.highlight': 'x3排位速度',
    'home.events.tuyetDinhSongDau.timeline': '剩余5天',
    'home.events.tuyetDinhSongDau.reward': '⭐ 第1名: 2000宝石',
    'home.events.tuyetDinhSongDau.ctaLabel': '参战',
    
    // Home Social Tabs
    'home.social.friends': '道友',
    'home.social.chat': '传音',
    'home.social.info': '高人',
    
    // Home Friends
    'home.friends.title': '道友',
    'home.friends.connections': '{count}个连接',
    'home.friends.onlineCount': '{count}在线',
    'home.friends.loading': '加载中...',
    'home.friends.refresh': '🔄 刷新',
    'home.friends.searchPlaceholder': '🔍 搜索好友...',
    'home.friends.filterAll': '全部',
    'home.friends.filterOnline': '在线',
    'home.friends.filterIncoming': '收到邀请',
    'home.friends.filterOutgoing': '已发送',
    'home.friends.challenge': '挑战',
    'home.friends.daysAgo': '{count}天前',
    'home.friends.hoursAgo': '{count}小时前',
    'home.friends.minutesAgo': '{count}分钟前',
    'home.friends.justNow': '刚刚',
    'home.friends.hidden': '隐藏',
    'home.friends.anonymousUser': '匿名',
    'home.friends.anonymous': '无名',
    'home.friends.friendRequestSent': '{name}向您发送了好友请求',
    'home.friends.friendRequestAccepted': '{name}接受了您的请求',
    'home.friends.emptyStateAll': '还没有好友',
    'home.friends.emptyStateOnline': '没有在线好友',
    'home.friends.emptyStateIncoming': '没有收到邀请',
    'home.friends.emptyStateOutgoing': '没有发送邀请',
    
    // Profile
    'profile.overview': '概览',
    'profile.settings': '设置',
    'profile.history': '对战历史',
    'profile.totalGames': '总游戏数',
    'profile.settingsTitle': '设置',
    'profile.account': '账户',
    'profile.ui': '界面',
    'profile.sound': '声音',
    'profile.board': '棋盘与走棋',
    'profile.notifications': '通知',
    'profile.language': '语言',
    'profile.other': '其他',
    'profile.username': '用户名',
    'profile.email': '邮箱',
    'profile.changePassword': '更改密码',
    'profile.theme': '主题',
    'profile.themeDark': '暗色',
    'profile.themeLight': '亮色',
    'profile.uiEffects': 'UI效果',
    'profile.effectsQuality': '效果质量',
    'profile.effectsHigh': '高',
    'profile.effectsMedium': '中',
    'profile.effectsLow': '低',
    'profile.fontSize': '字体大小',
    'profile.fontSmall': '小',
    'profile.fontMedium': '中',
    'profile.fontLarge': '大',
    'profile.sfx': '音效',
    'profile.bgMusic': '背景音乐',
    'profile.volume': '音量',
    'profile.highlightLastMove': '高亮最后一步',
    'profile.showWinningLine': '显示获胜线',
    'profile.pieceDropEffect': '落子效果',
    'profile.showHints': '显示提示',
    'profile.boardSkin': '棋盘皮肤',
    'profile.systemNotif': '系统通知',
    'profile.inviteNotif': '游戏邀请',
    'profile.chatNotif': '聊天消息',
    'profile.turnNotif': '回合通知',
    'profile.restoreDefaults': '恢复默认',
    
    // Shop
    'shop.title': '商店',
    'shop.coins': '金币',
    'shop.gems': '宝石',
    'shop.featured': '精选',
    'shop.avatars': '头像框',
    'shop.boardSkins': '棋盘皮肤',
    'shop.emotes': '表情',
    'shop.buy': '购买',
    'shop.owned': '已拥有',
    'shop.equipped': '使用中',
    
    // Quests
    'quests.title': '任务',
    'quests.daily': '每日',
    'quests.weekly': '每周',
    'quests.achievements': '成就',
    'quests.progress': '进度',
    'quests.claim': '领取',
    'quests.completed': '已完成',
    
    // Events
    'events.title': '活动',
    'events.current': '进行中',
    'events.upcoming': '即将到来',
    'events.past': '已结束',
    'events.joinNow': '立即参加',
    'events.viewDetails': '查看详情',
    
    // Lobby
    'lobby.title': '大厅',
    'lobby.findMatch': '寻找对手',
    'lobby.createRoom': '创建房间',
    'lobby.joinRoom': '加入房间',
    'lobby.roomCode': '房间代码',
    'lobby.searching': '搜索中...',
    'lobby.cancel': '取消',
    
    // Common
    'common.save': '保存',
    'common.cancel': '取消',
    'common.confirm': '确认',
    'common.close': '关闭',
    'common.yes': '是',
    'common.no': '否',
    'common.ok': '确定',
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.level': '等级',
    'common.exp': '经验',
    'common.wins': '胜',
    'common.losses': '败',
    'common.draws': '平',
    
    // Settings Popup
    'settings.title': '快速设置',
    'settings.subtitle': '调整声音和效果',
    'settings.sfx': '音效',
    'settings.bgMusic': '背景音乐',
    'settings.notification': '通知',
    'settings.language': '语言',
    'settings.effects': '效果',
    'settings.effectsHigh': '高',
    'settings.effectsMedium': '中',
    'settings.effectsLow': '低',
    
    // Rank System
    'rank.label': '境界',
    'rank.vo_danh': '无名',
    'rank.tan_ky': '新手',
    'rank.hoc_ky': '学士',
    'rank.ky_lao': '棋老',
    'rank.cao_ky': '高手',
    'rank.ky_thanh': '棋圣',
    'rank.truyen_thuyet': '传奇',
  },
  
  ja: {
    // Navigation
    'nav.home': 'ホーム',
    'nav.lobby': 'ロビー',
    'nav.shop': 'ショップ',
    'nav.profile': 'プロフィール',
    'nav.inventory': 'インベントリ',
    'nav.quests': 'クエスト',
    'nav.events': 'イベント',
    'nav.guide': 'ガイド',
    'nav.logout': 'ログアウト',
    
    // Home Navigation (for mobile menu)
    'home.nav.shop': 'ショップ',
    'home.nav.inventory': 'インベントリ',
    'home.nav.quests': 'クエスト',
    'home.nav.events': 'イベント',
    'home.nav.khaiNhan': 'ランク',
    'home.nav.guide': 'ガイド',
    'home.nav.mentor': 'リプレイ分析',
    
    // Home page
    'home.welcome': 'Mindpoint Arenaへようこそ',
    'home.quickMatch': 'クイックマッチ',
    'home.ranked': 'ランクマッチ',
    'home.training': 'トレーニング',
    'home.createRoom': 'ルーム作成',
    'home.hotseat': 'ローカルプレイ',
    'home.onlinePlayers': 'オンラインプレイヤー',
    'home.rank': 'ランク',
    'home.winRate': '勝率',
    'home.totalMatches': '総試合数',
    
    // Home Hero Section
    'home.hero.title': '無名から無敵へ',
    'home.hero.subtitle': '今すぐプレイ、毎日上達 - 伝説はここから始まる',
    'home.hero.ctaQuickMatch': 'クイックマッチ',
    'home.hero.ctaRankNote': 'ランク',
    
    // Home Game Modes
    'home.modes.ranked': 'ランクアリーナ',
    'home.modes.tournament': '万門争覇',
    'home.modes.training': '修練場',
    'home.modes.hotseat': 'ローカル対局',
    
    // Training Modal
    'home.training.title': '修練場',
    'home.training.subtitle': 'ランクマッチに挑む前に、ボットの難易度を選んで練習しましょう。',
    
    // Home Events
    'home.events.thienCoBien.title': '天機変',
    'home.events.thienCoBien.subtitle': '大規模トーナメント',
    'home.events.thienCoBien.chip': '特別',
    'home.events.thienCoBien.highlight': 'x2 Mindpoint報酬',
    'home.events.thienCoBien.timeline': '残り3日',
    'home.events.thienCoBien.reward': '🏆 1000ダイヤモンド',
    'home.events.thienCoBien.ctaLabel': '今すぐ参加',
    'home.events.luaTraiDaiHoi.title': 'キャンプファイア集会',
    'home.events.luaTraiDaiHoi.subtitle': '3v3チームバトル',
    'home.events.luaTraiDaiHoi.chip': '新規',
    'home.events.luaTraiDaiHoi.highlight': '新ゲームモード',
    'home.events.luaTraiDaiHoi.timeline': '残り7日',
    'home.events.luaTraiDaiHoi.reward': '💎 500ジェム+スキン',
    'home.events.luaTraiDaiHoi.ctaLabel': '探索',
    'home.events.tuyetDinhSongDau.title': '究極の決闘',
    'home.events.tuyetDinhSongDau.subtitle': '1v1チャンピオンシップ',
    'home.events.tuyetDinhSongDau.chip': 'ランク',
    'home.events.tuyetDinhSongDau.highlight': 'x3ランク速度',
    'home.events.tuyetDinhSongDau.timeline': '残り5日',
    'home.events.tuyetDinhSongDau.reward': '⭐ 1位: 2000ジェム',
    'home.events.tuyetDinhSongDau.ctaLabel': '参戦',
    
    // Home Social Tabs
    'home.social.friends': '道友',
    'home.social.chat': '伝音',
    'home.social.info': '高人',
    
    // Home Friends
    'home.friends.title': 'フレンド',
    'home.friends.connections': '{count}接続',
    'home.friends.onlineCount': '{count}オンライン',
    'home.friends.loading': '読み込み中...',
    'home.friends.refresh': '🔄 更新',
    'home.friends.searchPlaceholder': '🔍 フレンド検索...',
    'home.friends.filterAll': 'すべて',
    'home.friends.filterOnline': 'オンライン',
    'home.friends.filterIncoming': '受信リクエスト',
    'home.friends.filterOutgoing': '送信済み',
    'home.friends.challenge': 'チャレンジ',
    'home.friends.daysAgo': '{count}日前',
    'home.friends.hoursAgo': '{count}時間前',
    'home.friends.minutesAgo': '{count}分前',
    'home.friends.justNow': 'たった今',
    'home.friends.hidden': '非表示',
    'home.friends.anonymousUser': '匿名',
    'home.friends.anonymous': '無名',
    'home.friends.friendRequestSent': '{name}があなたにフレンドリクエストを送信しました',
    'home.friends.friendRequestAccepted': '{name}があなたのリクエストを承認しました',
    'home.friends.emptyStateAll': 'まだフレンドがいません',
    'home.friends.emptyStateOnline': 'オンラインのフレンドがいません',
    'home.friends.emptyStateIncoming': '受信リクエストなし',
    'home.friends.emptyStateOutgoing': '送信リクエストなし',
    
    // Profile
    'profile.overview': '概要',
    'profile.settings': '設定',
    'profile.history': '対戦履歴',
    'profile.totalGames': '総ゲーム数',
    'profile.settingsTitle': '設定',
    'profile.account': 'アカウント',
    'profile.ui': 'インターフェース',
    'profile.sound': 'サウンド',
    'profile.board': 'ボードと動き',
    'profile.notifications': '通知',
    'profile.language': '言語',
    'profile.other': 'その他',
    'profile.username': 'ユーザー名',
    'profile.email': 'メール',
    'profile.changePassword': 'パスワード変更',
    'profile.theme': 'テーマ',
    'profile.themeDark': 'ダーク',
    'profile.themeLight': 'ライト',
    'profile.uiEffects': 'UIエフェクト',
    'profile.effectsQuality': 'エフェクト品質',
    'profile.effectsHigh': '高',
    'profile.effectsMedium': '中',
    'profile.effectsLow': '低',
    'profile.fontSize': 'フォントサイズ',
    'profile.fontSmall': '小',
    'profile.fontMedium': '中',
    'profile.fontLarge': '大',
    'profile.sfx': '効果音',
    'profile.bgMusic': 'BGM',
    'profile.volume': '音量',
    'profile.highlightLastMove': '最後の手をハイライト',
    'profile.showWinningLine': '勝利ラインを表示',
    'profile.pieceDropEffect': 'ピース配置エフェクト',
    'profile.showHints': 'ヒントを表示',
    'profile.boardSkin': 'ボードスキン',
    'profile.systemNotif': 'システム通知',
    'profile.inviteNotif': 'ゲーム招待',
    'profile.chatNotif': 'チャットメッセージ',
    'profile.turnNotif': 'ターン通知',
    'profile.restoreDefaults': 'デフォルトに戻す',
    
    // Shop
    'shop.title': 'ショップ',
    'shop.coins': 'コイン',
    'shop.gems': 'ジェム',
    'shop.featured': '注目',
    'shop.avatars': 'アバターフレーム',
    'shop.boardSkins': 'ボードスキン',
    'shop.emotes': 'エモート',
    'shop.buy': '購入',
    'shop.owned': '所有',
    'shop.equipped': '装備中',
    
    // Quests
    'quests.title': 'クエスト',
    'quests.daily': 'デイリー',
    'quests.weekly': 'ウィークリー',
    'quests.achievements': '実績',
    'quests.progress': '進行状況',
    'quests.claim': '受け取る',
    'quests.completed': '完了',
    
    // Events
    'events.title': 'イベント',
    'events.current': '開催中',
    'events.upcoming': '近日開催',
    'events.past': '終了',
    'events.joinNow': '今すぐ参加',
    'events.viewDetails': '詳細を見る',
    
    // Lobby
    'lobby.title': 'ロビー',
    'lobby.findMatch': 'マッチを探す',
    'lobby.createRoom': 'ルーム作成',
    'lobby.joinRoom': 'ルーム参加',
    'lobby.roomCode': 'ルームコード',
    'lobby.searching': '検索中...',
    'lobby.cancel': 'キャンセル',
    
    // Common
    'common.save': '保存',
    'common.cancel': 'キャンセル',
    'common.confirm': '確認',
    'common.close': '閉じる',
    'common.yes': 'はい',
    'common.no': 'いいえ',
    'common.ok': 'OK',
    'common.loading': '読み込み中...',
    'common.error': 'エラー',
    'common.success': '成功',
    'common.level': 'レベル',
    'common.exp': '経験値',
    'common.wins': '勝利',
    'common.losses': '敗北',
    'common.draws': '引き分け',
    
    // Settings Popup
    'settings.title': 'クイック設定',
    'settings.subtitle': 'サウンドとエフェクトを調整',
    'settings.sfx': '効果音',
    'settings.bgMusic': '背景音楽',
    'settings.notification': '通知',
    'settings.language': '言語',
    'settings.effects': 'エフェクト',
    'settings.effectsHigh': '高',
    'settings.effectsMedium': '中',
    'settings.effectsLow': '低',
    
    // Rank System
    'rank.label': '境界',
    'rank.vo_danh': '無名',
    'rank.tan_ky': '初心者',
    'rank.hoc_ky': '学士',
    'rank.ky_lao': 'ベテラン',
    'rank.cao_ky': '高手',
    'rank.ky_thanh': '棋聖',
    'rank.truyen_thuyet': '伝説',
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language') as Language
    return saved || 'vi'
  })

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
    document.documentElement.setAttribute('lang', lang)
    
    // Dispatch event để đồng bộ với các component khác
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }))
  }

  const t = (key: string, params?: Record<string, any>): string => {
    let text = translations[language]?.[key] || key
    
    // Replace parameters like {count}, {name} with actual values
    if (params) {
      Object.keys(params).forEach(param => {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(params[param]))
      })
    }
    
    return text
  }

  useEffect(() => {
    // Đặt ngôn ngữ ban đầu
    document.documentElement.setAttribute('lang', language)
    
    // Lắng nghe sự kiện languageChanged từ các component khác (như Profile settings)
    const handleLanguageChange = (event: CustomEvent) => {
      const newLang = event.detail as Language
      if (newLang && newLang !== language) {
        setLanguageState(newLang)
        localStorage.setItem('language', newLang)
        document.documentElement.setAttribute('lang', newLang)
      }
    }
    
    window.addEventListener('languageChanged', handleLanguageChange as EventListener)
    
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener)
    }
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
