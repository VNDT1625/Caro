import React from 'react'

type Item = {
  id: string
  title: string
  subtitle?: string
  price: number
  currency?: 'coin' | 'gem'
}

const sampleSkins: Item[] = [
  { id: 'skin1', title: 'Quân Cờ Gỗ Cổ Điển', subtitle: 'Classic wood', price: 0, currency: 'coin' },
  { id: 'skin2', title: 'Quân Cờ Ngọc Bích', subtitle: 'Jade pieces', price: 5000, currency: 'coin' },
  { id: 'skin3', title: 'Quân Cờ Hoàng Kim', subtitle: 'Gold pieces', price: 50, currency: 'gem' }
]

const sampleBoards: Item[] = [
  { id: 'board1', title: 'Bàn Cờ Cổ Điển', subtitle: 'Wooden board', price: 0, currency: 'coin' },
  { id: 'board2', title: 'Bàn Cờ Hoa Anh Đào', subtitle: 'Sakura board', price: 6000, currency: 'coin' },
  { id: 'board3', title: 'Bàn Cờ Vũ Trụ', subtitle: 'Space board', price: 120, currency: 'gem' }
]

function Card({ item }: { item: Item }) {
  return (
    <div style={{ width: 220, borderRadius: 12, padding: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005))', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ height: 120, borderRadius: 8, background: 'linear-gradient(180deg, rgba(6,22,38,0.9), rgba(8,28,46,0.8))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)' }}>
        Preview
      </div>
      <div style={{ fontWeight: 700 }}>{item.title}</div>
      <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{item.subtitle}</div>
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{item.price === 0 ? 'Free' : `${item.price} ${item.currency === 'gem' ? 'Gem' : 'Coin'}`}</div>
        <button style={{ background: 'var(--color-primary)', border: 'none', color: '#041014', padding: '8px 12px', borderRadius: 10, cursor: 'pointer' }}>Mua</button>
      </div>
    </div>
  )
}

export default function ShopGrid() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section>
        <h3 style={{ margin: '6px 0 12px 0' }}>Skins</h3>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {sampleSkins.map(s => <Card key={s.id} item={s} />)}
        </div>
      </section>

      <section>
        <h3 style={{ margin: '6px 0 12px 0' }}>Boards</h3>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {sampleBoards.map(b => <Card key={b.id} item={b} />)}
        </div>
      </section>
    </div>
  )
}
