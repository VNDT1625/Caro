import { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabase'

export default function CurrencyResult() {
  const { t } = useLanguage()
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [txnRef, setTxnRef] = useState<string | null>(null)
  const [responseCode, setResponseCode] = useState<string | null>(null)
  const [currencyType, setCurrencyType] = useState<string | null>(null)
  const [amount, setAmount] = useState<number>(0)

  useEffect(() => {
    // Parse VNPay response từ hash (#currency-result?vnp_ResponseCode=00...)
    const params = parseParams()
    const vnpResponseCode = params.get('vnp_ResponseCode')
    const vnpTxnRef = params.get('vnp_TxnRef')
    const statusParam = params.get('status')
    const currencyParam = params.get('currency_type')
    const amountParam = params.get('amount')
    
    setTxnRef(vnpTxnRef)
    setResponseCode(vnpResponseCode)
    setCurrencyType(currencyParam)
    setAmount(parseInt(amountParam || '0', 10))

    // Nếu backend đã xử lý (có status=paid trong URL)
    if (statusParam === 'paid') {
      setStatus('success')
      // Dispatch event để update header balance
      refreshBalance()
      return
    }

    if (vnpResponseCode === '00') {
      // Gọi webhook để verify và cộng tiền
      verifyPayment(params).then((result) => {
        if (result.success) {
          setStatus('success')
          setCurrencyType(result.currency_type || currencyParam)
          setAmount(result.amount || parseInt(amountParam || '0', 10))
          refreshBalance()
        } else {
          setStatus('failed')
        }
      })
    } else {
      setStatus('failed')
    }
  }, [])

  const refreshBalance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return

      const { data } = await supabase
        .from('profiles')
        .select('coins, gems')
        .eq('user_id', session.user.id)
        .single()

      if (data) {
        window.dispatchEvent(new CustomEvent('profileUpdated', {
          detail: {
            field: 'currency',
            coins: data.coins || 0,
            gems: data.gems || 0
          }
        }))
      }
    } catch (e) {
      console.warn('Failed to refresh balance:', e)
    }
  }

  const verifyPayment = async (params: URLSearchParams): Promise<{ success: boolean; currency_type?: string; amount?: number }> => {
    try {
      const paramsObj: Record<string, string> = {}
      params.forEach((value, key) => {
        paramsObj[key] = value
      })
      
      const res = await fetch('/api/currency/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paramsObj)
      })
      
      const json = await res.json()
      if (json.success && json.data?.status === 'paid') {
        return {
          success: true,
          currency_type: json.data.currency_type,
          amount: json.data.amount
        }
      }
      return { success: false }
    } catch (e) {
      console.error('Failed to verify payment:', e)
      return { success: false }
    }
  }

  const parseParams = () => {
    // URL mẫu: http://localhost:5173/#currency-result?vnp_ResponseCode=00&vnp_TxnRef=...
    const hash = window.location.hash || ''
    const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : ''
    if (hashQuery) {
      return new URLSearchParams(hashQuery)
    }
    // Fallback: lấy từ search nếu không có hash query
    return new URLSearchParams(window.location.search)
  }

  const getErrorMessage = (code: string | null) => {
    const messages: Record<string, string> = {
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản bị khóa.',
      '13': 'Giao dịch không thành công do: Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch.',
      '51': 'Giao dịch không thành công do: Tài khoản không đủ số dư.',
      '65': 'Giao dịch không thành công do: Tài khoản đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định.',
      '99': 'Lỗi không xác định.',
    }
    return messages[code || ''] || 'Giao dịch thất bại. Vui lòng thử lại.'
  }

  const getCurrencyName = (type: string | null) => {
    if (type === 'gem') return 'Nguyên Thần'
    return 'Tinh Thạch'
  }

  const getCurrencyIcon = (type: string | null) => {
    if (type === 'gem') return '/gem.png'
    return '/coin.png'
  }

  return (
    <div style={{ 
      padding: '60px 20px', 
      maxWidth: 600, 
      margin: '0 auto', 
      textAlign: 'center' 
    }}>
      {status === 'loading' && (
        <div style={{ color: '#94A3B8' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>⏳</div>
          <p>Đang xử lý kết quả thanh toán...</p>
        </div>
      )}

      {status === 'success' && (
        <div>
          <div style={{ 
            fontSize: 72, 
            marginBottom: 20,
            animation: 'bounce 0.5s ease'
          }}>✅</div>
          <h1 style={{ color: '#34D399', fontSize: 28, marginBottom: 12 }}>
            Nạp tiền thành công!
          </h1>
          
          {amount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              marginBottom: 16,
              padding: '16px 24px',
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.35)',
              borderRadius: 12
            }}>
              <img 
                src={getCurrencyIcon(currencyType)} 
                alt="" 
                style={{ width: 32, height: 32 }} 
              />
              <span style={{ 
                color: currencyType === 'gem' ? '#22D3EE' : '#FCD34D', 
                fontSize: 24, 
                fontWeight: 700 
              }}>
                +{amount.toLocaleString()}
              </span>
              <span style={{ color: '#94A3B8', fontSize: 16 }}>
                {getCurrencyName(currencyType)}
              </span>
            </div>
          )}
          
          <p style={{ color: '#94A3B8', marginBottom: 8 }}>
            Mã giao dịch: <strong style={{ color: '#E2E8F0' }}>{txnRef}</strong>
          </p>
          <p style={{ color: '#94A3B8', marginBottom: 24 }}>
            Số dư đã được cập nhật vào tài khoản của bạn.
          </p>
          
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => { window.location.href = '/#currency-shop' }}
              style={{
                padding: '14px 24px',
                borderRadius: 12,
                border: '1px solid rgba(59,130,246,0.6)',
                background: 'rgba(59,130,246,0.15)',
                color: '#BFDBFE',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Nạp thêm
            </button>
            <button
              onClick={() => { window.location.href = '/#shop' }}
              style={{
                padding: '14px 32px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
                color: '#0B1220',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              Đến Tiêu Bảo Các
            </button>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div>
          <div style={{ fontSize: 72, marginBottom: 20 }}>❌</div>
          <h1 style={{ color: '#F87171', fontSize: 28, marginBottom: 12 }}>
            Nạp tiền thất bại
          </h1>
          <p style={{ color: '#FCA5A5', marginBottom: 8 }}>
            {getErrorMessage(responseCode)}
          </p>
          {txnRef && (
            <p style={{ color: '#94A3B8', marginBottom: 24 }}>
              Mã giao dịch: <strong style={{ color: '#E2E8F0' }}>{txnRef}</strong>
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => { window.location.href = '/#currency-shop' }}
              style={{
                padding: '14px 24px',
                borderRadius: 12,
                border: '1px solid rgba(59,130,246,0.6)',
                background: 'rgba(59,130,246,0.15)',
                color: '#BFDBFE',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Thử lại
            </button>
            <button
              onClick={() => { window.location.href = '/#home' }}
              style={{
                padding: '14px 24px',
                borderRadius: 12,
                border: '1px solid rgba(71,85,105,0.4)',
                background: 'rgba(30,41,59,0.6)',
                color: '#94A3B8',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Về trang chủ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
