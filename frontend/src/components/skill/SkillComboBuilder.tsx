import React, { useState, useEffect } from 'react'
import {
  Skill,
  Season,
  SkillCombo,
  getCurrentSeason,
  getUserSkills,
  getUserCombos,
  saveCombo,
  getRecommendedCombo,
  RARITY_COLORS,
  LOCAL_SKILLS
} from '../../lib/skillApi'
import SkillCard from './SkillCard'
import { supabase } from '../../lib/supabase'

interface SkillComboBuilderProps {
  onSave?: (combo: SkillCombo) => void
  onClose?: () => void
}

const MAX_SKILLS = 15
const MIN_COMMON = 10
const MAX_RARE = 5
const MAX_LEGENDARY = 3 // cuc hiem

export default function SkillComboBuilder({ onSave, onClose }: SkillComboBuilderProps) {
  const [season, setSeason] = useState<Season | null>(null)
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([])
  const [presetSlot, setPresetSlot] = useState(1)
  const [presetName, setPresetName] = useState('Default')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [rarityFilter, setRarityFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const { season: currentSeason } = await getCurrentSeason()
      setSeason(currentSeason)

      const { data: { session } } = await supabase.auth.getSession()
      
      // Load user's unlocked skills instead of all season skills
      let skills: Skill[] = []
      if (session?.access_token) {
        try {
          skills = await getUserSkills(session.access_token)
        } catch (err) {
          console.warn('Failed to load user skills, using starter skills')
        }
      }
      
      // Fallback to starter skills if no unlocked skills
      if (skills.length === 0) {
        // Use starter skills from LOCAL_SKILLS as fallback
        const starterSkills = LOCAL_SKILLS.filter(s => s.is_starter)
        skills = starterSkills.map(s => ({
          ...s,
          icon_url: undefined,
          preview_animation: undefined,
          effect_color: undefined
        })) as Skill[]
      }
      
      setAllSkills(skills)

      if (session?.access_token) {
        const combos = await getUserCombos(session.access_token, currentSeason.id)
        const active = combos.find(c => c.is_active)
        if (active) {
          setSelectedSkillIds(active.skill_ids)
          setPresetSlot(active.preset_slot)
          setPresetName(active.preset_name)
        }
      }
    } catch (err) {
      setError('Khong tai duoc danh sach skill')
    } finally {
      setLoading(false)
    }
  }

  const getValidationErrors = (): string[] => {
    const errors: string[] = []
    const selectedSkills = allSkills.filter(s => selectedSkillIds.includes(s.id))

    if (selectedSkillIds.length !== MAX_SKILLS) {
      errors.push(`Can chon dung ${MAX_SKILLS} skill (hien ${selectedSkillIds.length})`)
    }

    const commonCount = selectedSkills.filter(s => s.rarity === 'common').length
    const rareCount = selectedSkills.filter(s => s.rarity === 'rare').length
    const legendaryCount = selectedSkills.filter(s => s.rarity === 'legendary').length

    if (commonCount < MIN_COMMON) errors.push(`Can it nhat ${MIN_COMMON} skill thuong`)
    if (rareCount > MAX_RARE) errors.push(`Toi da ${MAX_RARE} skill hiem`)
    if (legendaryCount > MAX_LEGENDARY) errors.push(`Toi da ${MAX_LEGENDARY} skill cuc hiem`)

    return errors
  }

  const toggleSkill = (skillId: string) => {
    setSelectedSkillIds(prev => {
      if (prev.includes(skillId)) {
        return prev.filter(id => id !== skillId)
      }
      if (prev.length >= MAX_SKILLS) return prev
      return [...prev, skillId]
    })
  }

  const handleSave = async () => {
    const errors = getValidationErrors()
    if (errors.length > 0) {
      setError(errors.join('. '))
      return
    }

    try {
      setSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not logged in')

      const result = await saveCombo(session.access_token, selectedSkillIds, presetSlot, presetName, season?.id)
      if (result.success && result.combo) {
        onSave?.(result.combo)
        onClose?.()
      } else {
        setError(result.errors?.join('. ') || 'Luu combo that bai')
      }
    } catch (err) {
      setError('Luu combo that bai')
    } finally {
      setSaving(false)
    }
  }

  const handleLoadRecommended = async (playstyle: 'aggressive' | 'defensive' | 'balanced') => {
    try {
      const { skill_ids } = await getRecommendedCombo(playstyle)
      setSelectedSkillIds(skill_ids.slice(0, MAX_SKILLS))
    } catch (err) {
      setError('Khong tai duoc goi y combo')
    }
  }

  const filteredSkills = allSkills.filter(skill => {
    if (categoryFilter && skill.category !== categoryFilter) return false
    if (rarityFilter && skill.rarity !== rarityFilter) return false
    if (searchQuery) {
      const name = skill.name_vi.toLowerCase()
      if (!name.includes(searchQuery.toLowerCase())) return false
    }
    return true
  })

  const selectedSkills = allSkills.filter(s => selectedSkillIds.includes(s.id))
  const stats = {
    total: selectedSkillIds.length,
    common: selectedSkills.filter(s => s.rarity === 'common').length,
    rare: selectedSkills.filter(s => s.rarity === 'rare').length,
    legendary: selectedSkills.filter(s => s.rarity === 'legendary').length
  }

  const validationErrors = getValidationErrors()

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e293b, #0f172a)',
      borderRadius: 16,
      padding: 20,
      maxWidth: 900,
      maxHeight: '90vh',
      overflow: 'auto',
      color: '#E2E8F0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Xay deck skill (15 la)</h2>
          {season && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94A3B8' }}>
              Mua {season.season_number}: {season.name} - {allSkills.length} skills
            </p>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 24, cursor: 'pointer' }}>×</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.15)', fontSize: 12 }}>
          Tong: {stats.total}/{MAX_SKILLS}
        </div>
        <div style={{ padding: '6px 12px', borderRadius: 8, background: (RARITY_COLORS.common || '#9CA3AF') + '30', fontSize: 12 }}>
          Thuong: {stats.common} (min {MIN_COMMON})
        </div>
        <div style={{ padding: '6px 12px', borderRadius: 8, background: (RARITY_COLORS.rare || '#3B82F6') + '30', fontSize: 12 }}>
          Hiem: {stats.rare}/{MAX_RARE}
        </div>
        <div style={{ padding: '6px 12px', borderRadius: 8, background: (RARITY_COLORS.legendary || '#F59E0B') + '30', fontSize: 12 }}>
          Cuc hiem: {stats.legendary}/{MAX_LEGENDARY}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Tim skill..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(15,23,42,0.5)', color: '#E2E8F0', fontSize: 12 }}
        />
        <select value={categoryFilter || ''} onChange={e => setCategoryFilter(e.target.value || null)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(15,23,42,0.5)', color: '#E2E8F0', fontSize: 12 }}>
          <option value="">Tat ca loai</option>
          <option value="attack">Attack</option>
          <option value="defense">Defense</option>
          <option value="utility">Utility</option>
          <option value="special">Special</option>
        </select>
        <select value={rarityFilter || ''} onChange={e => setRarityFilter(e.target.value || null)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(15,23,42,0.5)', color: '#E2E8F0', fontSize: 12 }}>
          <option value="">Tat ca do hiem</option>
          <option value="common">Common</option>
          <option value="rare">Rare</option>
          <option value="legendary">Cuc hiem</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => handleLoadRecommended('aggressive')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #EF4444', background: 'rgba(239,68,68,0.1)', color: '#F87171', fontSize: 11, cursor: 'pointer' }}>
          Combo tan cong
        </button>
        <button onClick={() => handleLoadRecommended('defensive')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #22C55E', background: 'rgba(34,197,94,0.1)', color: '#4ADE80', fontSize: 11, cursor: 'pointer' }}>
          Combo phong thu
        </button>
        <button onClick={() => handleLoadRecommended('balanced')} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #3B82F6', background: 'rgba(59,130,246,0.1)', color: '#60A5FA', fontSize: 11, cursor: 'pointer' }}>
          Combo can bang
        </button>
        <button onClick={() => setSelectedSkillIds([])} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #94A3B8', background: 'transparent', color: '#94A3B8', fontSize: 11, cursor: 'pointer' }}>
          Xoa het
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, maxHeight: 300, overflow: 'auto', padding: 8, background: 'rgba(15,23,42,0.3)', borderRadius: 12 }}>
        {filteredSkills.map(skill => (
          <SkillCard
            key={skill.id}
            skill={skill}
            selected={selectedSkillIds.includes(skill.id)}
            onClick={() => toggleSkill(skill.id)}
            size="small"
          />
        ))}
      </div>

      {validationErrors.length > 0 && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 16 }}>
          {validationErrors.map((err, i) => (
            <div key={i} style={{ fontSize: 12, color: '#F87171' }}>• {err}</div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', marginBottom: 16, fontSize: 12, color: '#F87171' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          type="text"
          value={presetName}
          onChange={e => setPresetName(e.target.value)}
          placeholder="Ten preset"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(15,23,42,0.5)', color: '#E2E8F0' }}
        />
        <select value={presetSlot} onChange={e => setPresetSlot(Number(e.target.value))} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(15,23,42,0.5)', color: '#E2E8F0' }}>
          <option value={1}>Slot 1</option>
          <option value={2}>Slot 2</option>
          <option value={3}>Slot 3</option>
        </select>
        <button
          onClick={handleSave}
          disabled={saving || validationErrors.length > 0}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: validationErrors.length > 0 ? '#475569' : 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            color: '#fff',
            fontWeight: 700,
            cursor: validationErrors.length > 0 ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? '...' : 'Luu combo'}
        </button>
      </div>
    </div>
  )
}
