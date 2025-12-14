import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

interface CurrencyPackage {
  id: string
  package_code: string
  name_vi: string
  name_en?: string
  description_vi?: string
  description_en?: string
  currency_type: 'coin' | 'gem'
  amount: number
  bonus_amount: number
  price_vnd: number
  discount_percent: number
  is_featured: boolean
}

interface PaymentSession {
  pay_url: string
  txn_ref: string
  expires_at: number
  package?: CurrencyPackage
}

type PlanCode = 'trial' | 'pro' | 'pro_plus'

const SUBSCRIPTION_PLANS: Array<{
  code: PlanCode
  nameKey: string
  price: number
  descKey: string
  quotaKey: string
  highlight?: boolean
  icon: string
}> = [
  { code: 'trial', nameKey: 'currencyShop.plan.trial', price: 50000, descKey: 'currencyShop.plan.trialDesc', quotaKey: 'currencyShop.plan.trialQuota', icon: '🎯' },
  { code: 'pro', nameKey: 'currencyShop.plan.pro', price: 150000, descKey: 'currencyShop.plan.proDesc', quotaKey: 'currencyShop.plan.proQuota', highlight: true, icon: '⭐' },
  { code: 'pro_plus', nameKey: 'currencyShop.plan.proPlus', price: 390000, descKey: 'currencyShop.plan.proPlusDesc', quotaKey: 'currencyShop.plan.proPlusQuota', icon: '👑' },
]

export default function CurrencyShop({ userId }: { userId?: string | null }) {
  const { t, language } = useLanguage()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [packages, setPackages] = useState<CurrencyPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<PaymentSession | null>(null)
  const [mainTab, setMainTab] = useState<'currency' | 'subscription'>('currency')
  const [activeTab, setActiveTab] = useState<'coin' | 'gem'>('coin')
  const [balance, setBalance] = useState<{ coins: number; gems: number }>({ coins: 0, gems: 0 })

  useEffect(() => {
    supabase.auth.getSession().then((res) => {
      const token = res.data.session?.access_token || null
      setAccessToken(token)
    }).catch(() => setAccessToken(null))
  }, [])

  // Load packages
  useEffect(() => {
    async function loadPackages() {
      setLoading(true)
      try {
        const res = await fetch('/api/currency/packages')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setPackages(json.data)
        }
      } catch (err) {
        console.warn('Failed to load packages:', err)
      } finally {
        setLoading(false)
      }
    }
    loadPackages()
  }, [])

  // Load balance from Supabase directly
  useEffect(() => {
    async function loadBalance() {
      if (!userId) return
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('coins, gems')
          .eq('user_id', userId)
          .single()
        if (!error && data) {
          setBalance({ coins: data.coins || 0, gems: data.gems || 0 })
        }
      } catch (err) {
        console.warn('Failed to load balance:', err)
      }
    }
    loadBalance()
  }, [userId])

  const filteredPackages = packages.filter(p => p.currency_type === activeTab)

  const getPackageName = (pkg: CurrencyPackage) => {
    return language === 'en' && pkg.name_en ? pkg.name_en : pkg.name_vi
  }

  const getPackageDesc = (pkg: CurrencyPackage) => {
    return language === 'en' && pkg.description_en ? pkg.description_en : pkg.description_vi
  }

  // Currency names
  const coinName = t('shop.coins') || 'Tinh Thạch'
  const gemName = t('shop.gems') || 'Nguyên Thần'

  const startPurchase = async (pkg: CurrencyPackage) => {
    setError(null)
    setMessage(null)
    if (!userId || !accessToken) {
      setError(t('shop.needLogin') || 'Cần đăng nhập để mua')
      return
    }
    setPurchasing(pkg.package_code)
    try {
      const res = await fetch('/api/currency/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ package_code: pkg.package_code })
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || t('currencyShop.paymentFailed'))
      }
      setSession(json.data)
      setMessage(t('currencyShop.paymentCreated'))
      window.open(json.data.pay_url, '_blank')
    } catch (err: any) {
      setError(err?.message || t('currencyShop.paymentError'))
    } finally {
      setPurchasing(null)
    }
  }

  const testPurchase = async (pkg: CurrencyPackage) => {
    setError(null)
    setMessage(null)
    if (!userId || !accessToken) {
      setError(t('shop.needLogin') || 'Cần đăng nhập để mua')
      return
    }
    setPurchasing(pkg.package_code)
    try {
      const res = await fetch('/api/currency/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ package_code: pkg.package_code })
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || t('currencyShop.testFailed'))
      }
      const total = json.data.credited || 0
      const typeName = json.data.currency_type === 'gem' ? gemName : coinName
      setMessage(t('currencyShop.testSuccess', { amount: total, currency: typeName }))
      
      // Calculate new balance
      const newCoins = json.data.currency_type === 'coin' ? balance.coins + total : balance.coins
      const newGems = json.data.currency_type === 'gem' ? balance.gems + total : balance.gems
      
      // Update local state
      setBalance({ coins: newCoins, gems: newGems })
      
      // Dispatch event to update header
      window.dispatchEvent(new CustomEvent('profileUpdated', {
        detail: {
          field: 'currency',
          coins: newCoins,
          gems: newGems
        }
      }))
    } catch (err: any) {
      setError(err?.message || t('currencyShop.testError'))
    } finally {
      setPurchasing(null)
    }
  }

  // Subscription payment
  const startSubscription = async (plan: PlanCode, price: number) => {
    setError(null)
    setMessage(null)
    if (!userId || !accessToken) {
      setError(t('currencyShop.needLogin'))
      return
    }
    setPurchasing(plan)
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
      try { json = await res.json() } catch (_) { json = null }
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || `Thanh toán thất bại (HTTP ${res.status})`)
      }
      setSession(json.data)
      setMessage(t('currencyShop.paymentCreated'))
      window.open(json.data.pay_url, '_blank')
    } catch (err: any) {
      setError(err?.message || t('currencyShop.paymentError'))
    } finally {
      setPurchasing(null)
    }
  }

  const testSubscription = async (plan: PlanCode) => {
    setError(null)
    setMessage(null)
    if (!userId || !accessToken) {
      setError(t('currencyShop.needLogin'))
      return
    }
    setPurchasing(plan)
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
      try { json = await res.json() } catch (_) { json = null }
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || t('currencyShop.paymentFailed'))
      }
      setMessage(t('currencyShop.subscriptionSuccess', { plan }))
    } catch (err: any) {
      setError(err?.message || t('currencyShop.subscriptionError'))
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          marginBottom: 20,
          background: 'rgba(71,85,105,0.3)',
          border: '1px solid rgba(71,85,105,0.5)',
          borderRadius: 8,
          color: '#94A3B8',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          transition: 'all 0.2s'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(71,85,105,0.5)'
          e.currentTarget.style.color = '#E2E8F0'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(71,85,105,0.3)'
          e.currentTarget.style.color = '#94A3B8'
        }}
      >
        ← {t('common.back') || 'Quay lại'}
      </button>

      <h1 style={{ color: '#F8FAFC', fontSize: 28, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>✨</span> {t('currencyShop.title')}
      </h1>
      <p style={{ color: '#94A3B8', marginBottom: 24 }}>
        {t('currencyShop.subtitle')}
      </p>

      {/* Main Tabs: Currency vs Subscription */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => setMainTab('currency')}
          style={{
            padding: '12px 28px',
            borderRadius: 12,
            border: mainTab === 'currency' ? '2px solid #38BDF8' : '1px solid rgba(71,85,105,0.4)',
            background: mainTab === 'currency' ? 'rgba(56,189,248,0.15)' : 'rgba(15,23,42,0.85)',
            color: mainTab === 'currency' ? '#38BDF8' : '#94A3B8',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'all 0.2s'
          }}
        >
          <span>💰</span> {t('currencyShop.tabCurrency')}
        </button>
        <button
          onClick={() => setMainTab('subscription')}
          style={{
            padding: '12px 28px',
            borderRadius: 12,
            border: mainTab === 'subscription' ? '2px solid #A855F7' : '1px solid rgba(71,85,105,0.4)',
            background: mainTab === 'subscription' ? 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(99,102,241,0.15) 100%)' : 'rgba(15,23,42,0.85)',
            color: mainTab === 'subscription' ? '#A855F7' : '#94A3B8',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'all 0.2s'
          }}
        >
          <span>⭐</span> {t('currencyShop.tabSubscription')}
        </button>
      </div>

      {/* Balance display - only show for currency tab */}
      {mainTab === 'currency' && (
        <div style={{ 
          display: 'flex', 
          gap: 16, 
          marginBottom: 24,
          padding: '16px 20px',
          background: 'rgba(15,23,42,0.85)',
          borderRadius: 12,
          border: '1px solid rgba(71,85,105,0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/coin.png" alt={coinName} style={{ width: 24, height: 24 }} />
            <span style={{ color: '#FCD34D', fontWeight: 700, fontSize: 18 }}>{balance.coins.toLocaleString()}</span>
            <span style={{ color: '#94A3B8', fontSize: 14 }}>{coinName}</span>
          </div>
          <div style={{ width: 1, background: 'rgba(71,85,105,0.4)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/gem.png" alt={gemName} style={{ width: 24, height: 24 }} />
            <span style={{ color: '#22D3EE', fontWeight: 700, fontSize: 18 }}>{balance.gems.toLocaleString()}</span>
            <span style={{ color: '#94A3B8', fontSize: 14 }}>{gemName}</span>
          </div>
        </div>
      )}

      {!userId && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, color: '#FCA5A5', marginBottom: 16 }}>
          {t('currencyShop.needLogin')}
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

      {/* Currency Tab Content */}
      {mainTab === 'currency' && (
        <>
          {/* Sub-tabs for coin/gem */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => setActiveTab('coin')}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                border: activeTab === 'coin' ? '2px solid #FCD34D' : '1px solid rgba(71,85,105,0.4)',
                background: activeTab === 'coin' ? 'rgba(252,211,77,0.15)' : 'rgba(15,23,42,0.85)',
                color: activeTab === 'coin' ? '#FCD34D' : '#94A3B8',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <img src="/coin.png" alt="" style={{ width: 20, height: 20 }} />
              {coinName}
            </button>
            <button
              onClick={() => setActiveTab('gem')}
              style={{
                padding: '10px 24px',
                borderRadius: 10,
                border: activeTab === 'gem' ? '2px solid #22D3EE' : '1px solid rgba(71,85,105,0.4)',
                background: activeTab === 'gem' ? 'rgba(34,211,238,0.15)' : 'rgba(15,23,42,0.85)',
                color: activeTab === 'gem' ? '#22D3EE' : '#94A3B8',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <img src="/gem.png" alt="" style={{ width: 20, height: 20 }} />
              {gemName}
            </button>
          </div>

          {loading ? (
        <div style={{ color: '#94A3B8', padding: 40, textAlign: 'center' }}>{t('currencyShop.loading')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filteredPackages.map(pkg => {
            const totalAmount = pkg.amount + (pkg.bonus_amount || 0)
            const isCoin = pkg.currency_type === 'coin'
            const accentColor = isCoin ? '#FCD34D' : '#22D3EE'
            const currencyName = isCoin ? coinName : gemName
            
            return (
              <div
                key={pkg.id || pkg.package_code}
                style={{
                  background: 'rgba(15,23,42,0.85)',
                  border: pkg.is_featured ? `2px solid ${accentColor}` : '1px solid rgba(71,85,105,0.4)',
                  borderRadius: 16,
                  padding: 20,
                  position: 'relative',
                  boxShadow: pkg.is_featured ? `0 12px 40px ${isCoin ? 'rgba(252,211,77,0.2)' : 'rgba(34,211,238,0.2)'}` : 'none'
                }}
              >
                {pkg.is_featured && (
                  <span style={{
                    position: 'absolute',
                    top: -10,
                    right: 16,
                    background: accentColor,
                    color: '#0B1220',
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12
                  }}>
                    {t('currencyShop.hot')}
                  </span>
                )}

                {pkg.discount_percent > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -10,
                    left: 16,
                    background: '#EF4444',
                    color: '#FFF',
                    padding: '4px 8px',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 11
                  }}>
                    -{pkg.discount_percent}%
                  </span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, marginTop: pkg.is_featured || pkg.discount_percent > 0 ? 8 : 0 }}>
                  <img 
                    src={isCoin ? '/coin.png' : '/gem.png'} 
                    alt="" 
                    style={{ width: 48, height: 48, filter: `drop-shadow(0 4px 8px ${isCoin ? 'rgba(252,211,77,0.4)' : 'rgba(34,211,238,0.4)'})` }} 
                  />
                  <div>
                    <div style={{ color: '#E2E8F0', fontSize: 18, fontWeight: 700 }}>
                      {getPackageName(pkg)}
                    </div>
                    {pkg.bonus_amount > 0 && (
                      <div style={{ color: '#34D399', fontSize: 13, fontWeight: 600 }}>
                        +{pkg.bonus_amount} {t('currencyShop.bonus')}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 12, minHeight: 36 }}>
                  {getPackageDesc(pkg) || `Nhận ${totalAmount} ${currencyName}`}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                  <span style={{ color: accentColor, fontSize: 28, fontWeight: 800 }}>
                    {pkg.price_vnd.toLocaleString('vi-VN')}
                  </span>
                  <span style={{ color: '#94A3B8', fontSize: 14 }}>₫</span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    disabled={!!purchasing || !userId}
                    onClick={() => startPurchase(pkg)}
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: `1px solid ${accentColor}60`,
                      background: pkg.is_featured 
                        ? `linear-gradient(135deg, ${accentColor} 0%, ${isCoin ? '#F59E0B' : '#6366F1'} 100%)`
                        : `${accentColor}20`,
                      color: pkg.is_featured ? '#0B1220' : accentColor,
                      fontWeight: 700,
                      cursor: purchasing || !userId ? 'not-allowed' : 'pointer',
                      opacity: purchasing || !userId ? 0.6 : 1
                    }}
                  >
                    {purchasing === pkg.package_code ? t('currencyShop.processing') : 'VNPay'}
                  </button>
                  <button
                    disabled={!!purchasing || !userId}
                    onClick={() => testPurchase(pkg)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: '1px solid rgba(34,197,94,0.6)',
                      background: 'rgba(34,197,94,0.15)',
                      color: '#86EFAC',
                      fontWeight: 700,
                      cursor: purchasing || !userId ? 'not-allowed' : 'pointer',
                      opacity: purchasing || !userId ? 0.6 : 1,
                      fontSize: 12
                    }}
                  >
                    Test
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
        </>
      )}

      {/* Subscription Tab Content */}
      {mainTab === 'subscription' && (
        <>
          <div style={{ 
            padding: '16px 20px', 
            marginBottom: 24,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(99,102,241,0.08) 100%)',
            borderRadius: 12,
            border: '1px solid rgba(168,85,247,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>🎯</span>
              <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{t('currencyShop.upgradeTitle')}</span>
            </div>
            <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>
              {t('currencyShop.upgradeDesc')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {SUBSCRIPTION_PLANS.map(plan => (
              <div key={plan.code}
                style={{
                  background: 'rgba(15,23,42,0.85)',
                  border: plan.highlight ? '2px solid #A855F7' : '1px solid rgba(71,85,105,0.4)',
                  borderRadius: 16,
                  padding: 24,
                  position: 'relative',
                  boxShadow: plan.highlight ? '0 12px 40px rgba(168,85,247,0.25)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {plan.highlight && (
                  <span style={{
                    position: 'absolute',
                    top: -10,
                    right: 16,
                    background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
                    color: '#FFF',
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12
                  }}>
                    {t('currencyShop.popular')}
                  </span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: plan.highlight 
                      ? 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)' 
                      : 'rgba(71,85,105,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24
                  }}>
                    {plan.icon}
                  </div>
                  <div>
                    <h3 style={{ color: '#E2E8F0', margin: 0, fontSize: 18, fontWeight: 700 }}>{t(plan.nameKey)}</h3>
                    <p style={{ color: '#94A3B8', margin: '4px 0 0', fontSize: 13 }}>{t(plan.descKey)}</p>
                  </div>
                </div>

                <div style={{ 
                  padding: '12px 16px', 
                  background: 'rgba(30,41,59,0.5)', 
                  borderRadius: 10, 
                  marginBottom: 16 
                }}>
                  <div style={{ color: '#CBD5E1', fontSize: 13 }}>{t(plan.quotaKey)}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                  <span style={{ 
                    color: plan.highlight ? '#A855F7' : '#38BDF8', 
                    fontSize: 28, 
                    fontWeight: 800 
                  }}>
                    {plan.price.toLocaleString('vi-VN')}
                  </span>
                  <span style={{ color: '#94A3B8', fontSize: 14 }}>₫</span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    disabled={!!purchasing || !userId}
                    onClick={() => startSubscription(plan.code, plan.price)}
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: plan.highlight ? 'none' : '1px solid rgba(168,85,247,0.5)',
                      background: plan.highlight 
                        ? 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)' 
                        : 'rgba(168,85,247,0.15)',
                      color: plan.highlight ? '#FFF' : '#C4B5FD',
                      fontWeight: 700,
                      cursor: purchasing || !userId ? 'not-allowed' : 'pointer',
                      opacity: purchasing || !userId ? 0.6 : 1
                    }}
                  >
                    {purchasing === plan.code ? t('currencyShop.processing') : 'VNPay'}
                  </button>
                  <button
                    disabled={!!purchasing || !userId}
                    onClick={() => testSubscription(plan.code)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: '1px solid rgba(34,197,94,0.6)',
                      background: 'rgba(34,197,94,0.15)',
                      color: '#86EFAC',
                      fontWeight: 700,
                      cursor: purchasing || !userId ? 'not-allowed' : 'pointer',
                      opacity: purchasing || !userId ? 0.6 : 1,
                      fontSize: 12
                    }}
                  >
                    Test
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {session && (
        <div style={{ marginTop: 20, padding: 12, borderRadius: 10, border: '1px dashed rgba(59,130,246,0.5)', color: '#E2E8F0' }}>
          {t('currencyShop.txnRef')}: <strong>{session.txn_ref}</strong> — {t('currencyShop.linkOpened')}.
        </div>
      )}
    </div>
  )
}
