import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

type PlanCode = 'trial' | 'pro' | 'pro_plus'

interface PaymentSession {
  pay_url: string
  txn_ref: string
  expires_at: number
}

const PLANS: Array<{
  code: PlanCode
  name: string
  price: number
  desc: string
  quota: string
  highlight?: boolean
}> = [
  { code: 'trial', name: 'Trial 7 ngày', price: 50000, desc: 'Kích hoạt thử 7 ngày', quota: '4 phân tích + 10 chat/ngày' },
  { code: 'pro', name: 'Pro 30 ngày', price: 150000, desc: 'Full quyền phân tích AI', quota: '40 phân tích + 120 chat/ngày', highlight: true },
  { code: 'pro_plus', name: 'Pro+ 90 ngày', price: 390000, desc: 'Quyền cao nhất, không giới hạn thực tế', quota: '100 phân tích + 500 chat/ngày' },
]

export default function Subscription({ userId }: { userId?: string | null }) {
  const { t } = useLanguage()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<PaymentSession | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then((res) => {
      const token = res.data.session?.access_token || null
      setAccessToken(token)
    }).catch(() => setAccessToken(null))
  }, [])

  const userWarning = useMemo(() => {
    if (!userId) return 'Bạn cần đăng nhập trước khi thanh toán.'
    return null
  }, [userId])

  const startPayment = async (plan: PlanCode, price: number) => {
    setError(null)
    setMessage(null)
    if (!userId || !accessToken) {
      setError('Cần đăng nhập để thanh toán.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ plan, amount: price })
      })
      let json: any = null
      try {
        json = await res.json()
      } catch (_) {
        json = null
      }
      if (!res.ok || !json?.success) {
        const msg = json?.error?.message || `Thanh toán thất bại (HTTP ${res.status})`
        throw new Error(msg)
      }
      setSession(json.data)
      setMessage('Tạo liên kết thanh toán thành công, đang chuyển hướng...')
      window.open(json.data.pay_url, '_blank')
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi tạo liên kết thanh toán')
    } finally {
      setLoading(false)
    }
  }

  const simulatePaymentSuccess = async (plan: PlanCode) => {
    setError(null)
    setMessage(null)
    if (!userId || !accessToken) {
      setError('Cần đăng nhập để thanh toán.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/payment/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ plan })
      })
      let json: any = null
      try {
        json = await res.json()
      } catch (_) {
        json = null
      }
      if (!res.ok || !json?.success) {
        const msg = json?.error?.message || `Mô phỏng thanh toán thất bại (HTTP ${res.status})`
        throw new Error(msg)
      }
      setMessage(`OK. Thanh toán ${plan} thành công! Subscription đã được cập nhật.`)
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi mô phỏng thanh toán')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ color: '#F8FAFC', fontSize: 28, marginBottom: 12 }}>Gói đăng ký</h1>
      <p style={{ color: '#94A3B8', marginBottom: 24 }}>
        Nâng cấp để mở khóa phân tích AI nâng cao và chat thông minh. Thanh toán demo qua VNPay (sandbox).
      </p>

      {userWarning && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, color: '#FCA5A5', marginBottom: 16 }}>
          {userWarning}
        </div>
      )}

      {message && (
        <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.45)', borderRadius: 10, color: '#34D399', marginBottom: 16 }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)', borderRadius: 10, color: '#F87171', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {PLANS.map(plan => (
          <div key={plan.code}
            style={{
              background: 'rgba(15,23,42,0.85)',
              border: `1px solid ${plan.highlight ? 'rgba(59,130,246,0.6)' : 'rgba(71,85,105,0.4)'}`,
              borderRadius: 16,
              padding: 20,
              boxShadow: plan.highlight ? '0 12px 40px rgba(59,130,246,0.25)' : 'none'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ color: '#E2E8F0', margin: 0, fontSize: 18 }}>{plan.name}</h3>
              {plan.highlight && (
                <span style={{ background: '#38BDF8', color: '#0B1220', padding: '4px 8px', borderRadius: 8, fontWeight: 700, fontSize: 12 }}>Hot</span>
              )}
            </div>
            <div style={{ color: '#38BDF8', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              {plan.price.toLocaleString('vi-VN')}₫
            </div>
            <p style={{ color: '#94A3B8', marginBottom: 8 }}>{plan.desc}</p>
            <p style={{ color: '#CBD5E1', fontSize: 13, marginBottom: 16 }}>{plan.quota}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={loading || !userId}
                onClick={() => startPayment(plan.code, plan.price)}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(59,130,246,0.6)',
                  background: plan.highlight ? 'linear-gradient(135deg, #38BDF8 0%, #6366F1 100%)' : 'rgba(59,130,246,0.15)',
                  color: plan.highlight ? '#0B1220' : '#BFDBFE',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Đang xử lý...' : 'VNPay'}
              </button>
              <button
                disabled={loading || !userId}
                onClick={() => simulatePaymentSuccess(plan.code)}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(34,197,94,0.6)',
                  background: 'rgba(34,197,94,0.15)',
                  color: '#86EFAC',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  fontSize: 12
                }}
              >
                {loading ? '...' : 'Test'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {session && (
        <div style={{ marginTop: 20, padding: 12, borderRadius: 10, border: '1px dashed rgba(59,130,246,0.5)', color: '#E2E8F0' }}>
          Mã giao dịch: <strong>{session.txn_ref}</strong> — liên kết đã mở trong tab mới.
        </div>
      )}
    </div>
  )
}
