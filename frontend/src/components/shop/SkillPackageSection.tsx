import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../contexts/LanguageContext'
import { AudioManager } from '../../lib/AudioManager'

interface SkillPackage {
  id: string
  package_code: string
  name_vi: string
  name_en?: string
  description_vi?: string
  description_en?: string
  cards_count: number
  common_rate: number
  rare_rate: number
  legendary_rate: number
  price_tinh_thach: number
  price_nguyen_than: number
  icon_url?: string
}

interface SkillPackageSectionProps {
  profile: { coins?: number; gems?: number; user_id?: string } | null
  onPurchaseComplete?: () => void
}

export default function SkillPackageSection({ profile, onPurchaseComplete }: SkillPackageSectionProps) {
  const { t, language } = useLanguage()
  const [packages, setPackages] = useState<SkillPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [openResult, setOpenResult] = useState<{ skills: any[]; packageName: string } | null>(null)

  useEffect(() => {
    loadPackages()
  }, [])

  async function loadPackages() {
    try {
      const { data, error } = await supabase
        .from('skill_packages')
        .select('*')
        .eq('is_active', true)
        .order('price_tinh_thach', { ascending: true })
      
      if (!error && data) {
        setPackages(data)
      }
    } catch (err) {
      console.warn('Failed to load skill packages:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handlePurchase(pkg: SkillPackage) {
    if (!profile?.user_id) {
      alert(t('shop.loginMessage'))
      return
    }

    // Check currency
    const useTinhThach = pkg.price_tinh_thach > 0
    const useNguyenThan = pkg.price_nguyen_than > 0
    
    if (useTinhThach && (profile.coins ?? 0) < pkg.price_tinh_thach) {
      alert(t('shop.notEnoughCoins'))
      return
    }
    if (useNguyenThan && (profile.gems ?? 0) < pkg.price_nguyen_than) {
      alert(t('shop.notEnoughGems'))
      return
    }

    setPurchasing(pkg.id)
    console.log('🎴 Starting package purchase for user:', profile.user_id)
    
    try {
      // 1. Roll skills based on drop rates
      const rolledSkills = await rollSkills(pkg)
      console.log('🎲 Rolled skills:', rolledSkills.map(s => ({ id: s.id, code: s.skill_code })))
      
      // 2. Deduct currency
      if (useTinhThach) {
        await supabase
          .from('profiles')
          .update({ coins: (profile.coins ?? 0) - pkg.price_tinh_thach })
          .eq('user_id', profile.user_id)
      }
      if (useNguyenThan) {
        await supabase
          .from('profiles')
          .update({ gems: (profile.gems ?? 0) - pkg.price_nguyen_than })
          .eq('user_id', profile.user_id)
      }

      // 3. Add skills to user_skills (unlock them)
      for (const skill of rolledSkills) {
        // Upsert - insert if not exists, or update if exists
        const { error: upsertError } = await supabase
          .from('user_skills')
          .upsert({
            user_id: profile.user_id,
            skill_id: skill.id,
            is_unlocked: true,
            unlocked_at: new Date().toISOString(),
            unlock_method: 'package'
          }, {
            onConflict: 'user_id,skill_id',
            ignoreDuplicates: false // Update if exists
          })
        
        if (upsertError) {
          console.error('Failed to unlock skill:', skill.skill_code, upsertError)
        } else {
          console.log('Unlocked skill:', skill.skill_code)
        }
      }

      // 4. Record purchase
      await supabase
        .from('user_package_purchases')
        .insert({
          user_id: profile.user_id,
          package_id: pkg.id,
          price_paid_tinh_thach: pkg.price_tinh_thach,
          price_paid_nguyen_than: pkg.price_nguyen_than,
          skills_received: rolledSkills.map(s => ({
            skill_id: s.id,
            skill_code: s.skill_code,
            rarity: s.rarity
          }))
        })

      // 5. Show result
      AudioManager.playSoundEffect('purchase')
      setOpenResult({
        skills: rolledSkills,
        packageName: language === 'en' ? (pkg.name_en || pkg.name_vi) : pkg.name_vi
      })

      // 6. Refresh profile and skills
      onPurchaseComplete?.()
      window.dispatchEvent(new CustomEvent('profileUpdated'))
      window.dispatchEvent(new CustomEvent('skillsUpdated')) // Trigger reload skills

    } catch (err) {
      console.error('Package purchase failed:', err)
      alert(t('shop.purchaseFailed'))
    } finally {
      setPurchasing(null)
    }
  }

  async function rollSkills(pkg: SkillPackage): Promise<any[]> {
    // Fetch all skills grouped by rarity
    const { data: allSkills } = await supabase
      .from('skills')
      .select('id, skill_code, name_vi, name_en, rarity, icon_url')
      .eq('is_active', true)

    if (!allSkills || allSkills.length === 0) {
      throw new Error('No skills available')
    }

    const commonSkills = allSkills.filter(s => s.rarity === 'common')
    const rareSkills = allSkills.filter(s => s.rarity === 'rare')
    const legendarySkills = allSkills.filter(s => s.rarity === 'legendary')

    const result: any[] = []
    
    for (let i = 0; i < pkg.cards_count; i++) {
      const roll = Math.random()
      let pool: any[]
      let rolledRarity: string

      if (roll < pkg.legendary_rate && legendarySkills.length > 0) {
        pool = legendarySkills
        rolledRarity = 'legendary'
      } else if (roll < pkg.legendary_rate + pkg.rare_rate && rareSkills.length > 0) {
        pool = rareSkills
        rolledRarity = 'rare'
      } else {
        pool = commonSkills.length > 0 ? commonSkills : allSkills
        rolledRarity = 'common'
      }

      const randomIndex = Math.floor(Math.random() * pool.length)
      result.push({ ...pool[randomIndex], rolledRarity })
    }

    return result
  }

  function getRarityColor(rarity: string): string {
    switch (rarity) {
      case 'legendary': return '#fbbf24'
      case 'rare': return '#a855f7'
      case 'common': return '#9ca3af'
      default: return '#9ca3af'
    }
  }

  function getPackageGradient(code: string): string {
    switch (code) {
      case 'PKG_KHAI_XUAN': return 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      case 'PKG_KHAI_THIEN': return 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
      case 'PKG_VO_CUC': return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
      default: return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
    }
  }

  if (loading) {
    return <div className="skill-packages-loading">{t('common.loading')}</div>
  }

  if (packages.length === 0) {
    return null
  }

  return (
    <div className="skill-packages-section">
      <h2 className="skill-packages-title">
        🎴 {t('shop.skillPackages') || 'Gói Skill'}
      </h2>
      <p className="skill-packages-subtitle">
        {t('shop.skillPackagesDesc') || 'Mở gói để nhận skill ngẫu nhiên cho deck của bạn'}
      </p>

      <div className="skill-packages-grid">
        {packages.map(pkg => {
          const name = language === 'en' ? (pkg.name_en || pkg.name_vi) : pkg.name_vi
          const desc = language === 'en' ? (pkg.description_en || pkg.description_vi) : pkg.description_vi
          const isPurchasing = purchasing === pkg.id
          
          return (
            <div 
              key={pkg.id} 
              className="skill-package-card"
              style={{ background: getPackageGradient(pkg.package_code) }}
            >
              <div className="skill-package-header">
                <h3>{name}</h3>
                <span className="skill-package-count">{pkg.cards_count} {t('shop.cards') || 'thẻ'}</span>
              </div>

              <div className="skill-package-rates">
                <div className="rate-item">
                  <span className="rate-label" style={{ color: '#9ca3af' }}>Thường</span>
                  <span className="rate-value">{(pkg.common_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="rate-item">
                  <span className="rate-label" style={{ color: '#a855f7' }}>Hiếm</span>
                  <span className="rate-value">{(pkg.rare_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="rate-item">
                  <span className="rate-label" style={{ color: '#fbbf24' }}>Cực Hiếm</span>
                  <span className="rate-value">{(pkg.legendary_rate * 100).toFixed(1)}%</span>
                </div>
              </div>

              <p className="skill-package-desc">{desc}</p>

              <div className="skill-package-price">
                {pkg.price_tinh_thach > 0 && (
                  <span className="price-item">
                    <img src="/coin.png" alt="Tinh Thạch" style={{ width: 20, height: 20 }} />
                    {pkg.price_tinh_thach.toLocaleString()}
                  </span>
                )}
                {pkg.price_nguyen_than > 0 && (
                  <span className="price-item">
                    <img src="/gem.png" alt="Nguyên Thần" style={{ width: 20, height: 20 }} />
                    {pkg.price_nguyen_than.toLocaleString()}
                  </span>
                )}
              </div>

              <button
                className="skill-package-buy-btn"
                disabled={isPurchasing}
                onClick={() => handlePurchase(pkg)}
              >
                {isPurchasing ? t('common.loading') : (t('shop.openPack') || 'Mở Gói')}
              </button>
            </div>
          )
        })}
      </div>

      {/* Result Modal */}
      {openResult && (
        <div className="skill-package-result-overlay" onClick={() => setOpenResult(null)}>
          <div className="skill-package-result-modal" onClick={e => e.stopPropagation()}>
            <h3>🎉 {openResult.packageName}</h3>
            <p>{t('shop.youReceived') || 'Bạn nhận được:'}</p>
            
            <div className="skill-package-result-cards">
              {openResult.skills.map((skill, idx) => (
                <div 
                  key={idx} 
                  className="result-skill-card"
                  style={{ borderColor: getRarityColor(skill.rarity) }}
                >
                  <div className="result-skill-rarity" style={{ color: getRarityColor(skill.rarity) }}>
                    {skill.rarity === 'legendary' ? '⭐ Cực Hiếm' : 
                     skill.rarity === 'rare' ? '💎 Hiếm' : '📜 Thường'}
                  </div>
                  <div className="result-skill-name">
                    {language === 'en' ? (skill.name_en || skill.name_vi) : skill.name_vi}
                  </div>
                  <div className="result-skill-code">{skill.skill_code}</div>
                </div>
              ))}
            </div>

            <button className="result-close-btn" onClick={() => setOpenResult(null)}>
              {t('common.close') || 'Đóng'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
