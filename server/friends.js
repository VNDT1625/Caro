const FIVE_MINUTES_MS = 5 * 60 * 1000
const MAX_SEARCH_RESULTS = 8

function isOnline(lastActive) {
  if (!lastActive) return false
  const ts = Date.parse(lastActive)
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts <= FIVE_MINUTES_MS
}

async function fetchProfiles(supabase, ids) {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, avatar_url, current_rank, last_active')
    .in('user_id', ids)

  if (error) throw error
  return data || []
}

async function upsertNotification(supabase, targetUserId, payload) {
  try {
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      type: 'friend_request',
      payload,
      read_at: null
    })
  } catch (err) {
    console.warn('Notification insert error', err)
  }
}

function buildOrFilter(userId, statuses) {
  const clauses = []
  statuses.forEach((status) => {
    clauses.push(`and(user_id.eq.${userId},status.eq.${status})`)
    clauses.push(`and(friend_id.eq.${userId},status.eq.${status})`)
  })
  return clauses.join(',')
}

async function resolveFriendPayload(supabase, userId, rows) {
  const friendIds = []
  rows.forEach((row) => {
    const counterpart = row.user_id === userId ? row.friend_id : row.user_id
    if (counterpart && !friendIds.includes(counterpart)) {
      friendIds.push(counterpart)
    }
  })

  const profiles = await fetchProfiles(supabase, friendIds)
  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]))

  return rows.map((row) => {
    const counterpart = row.user_id === userId ? row.friend_id : row.user_id
    const profile = profileMap[counterpart] || null
    return {
      id: row.id,
      friend_id: counterpart,
      status: row.status,
      since: row.created_at,
      profile: profile
        ? {
            user_id: profile.user_id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            current_rank: profile.current_rank,
            last_active: profile.last_active,
            is_online: isOnline(profile.last_active)
          }
        : null
    }
  })
}

function registerFriendRoutes(app, { supabaseAdmin, requireAuth }) {
  if (!supabaseAdmin) {
    console.warn('Supabase admin client missing - friend routes disabled')
    return
  }

  app.get('/friends/list', requireAuth, async (req, res) => {
    const userId = req.user.id
    try {
      const { data, error } = await supabaseAdmin
        .from('friendships')
        .select('id,user_id,friend_id,status,created_at')
        .or(buildOrFilter(userId, ['accepted']))

      if (error) throw error
      const friends = await resolveFriendPayload(supabaseAdmin, userId, data || [])
      res.json({ friends, total: friends.length })
    } catch (err) {
      console.error('friends/list error', err)
      res.status(500).json({ error: 'Không thể tải danh sách đạo hữu' })
    }
  })

  app.get('/friends/requests', requireAuth, async (req, res) => {
    const userId = req.user.id
    try {
      const { data: incomingRows, error: incomingError } = await supabaseAdmin
        .from('friendships')
        .select('id,user_id,friend_id,status,created_at')
        .eq('friend_id', userId)
        .eq('status', 'pending')

      if (incomingError) throw incomingError

      const { data: outgoingRows, error: outgoingError } = await supabaseAdmin
        .from('friendships')
        .select('id,user_id,friend_id,status,created_at')
        .eq('user_id', userId)
        .eq('status', 'pending')

      if (outgoingError) throw outgoingError

      const incoming = await resolveFriendPayload(supabaseAdmin, userId, incomingRows || [])
      const outgoing = await resolveFriendPayload(supabaseAdmin, userId, outgoingRows || [])

      res.json({ incoming, outgoing })
    } catch (err) {
      console.error('friends/requests error', err)
      res.status(500).json({ error: 'Không thể tải lời mời' })
    }
  })

  app.get('/friends/search', requireAuth, async (req, res) => {
    const userId = req.user.id
    const keyword = (req.query.q || '').toString().trim()
    if (!keyword) {
      return res.json({ results: [] })
    }
    try {
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('user_id, username, display_name, avatar_url, current_rank, last_active')
        .or(`username.ilike.%${keyword}%,display_name.ilike.%${keyword}%`)
        .neq('user_id', userId)
        .limit(MAX_SEARCH_RESULTS)

      if (error) throw error

      const targetIds = profiles ? profiles.map((p) => p.user_id) : []
      let existing = []
      if (targetIds.length) {
        const { data: existingRows, error: existingError } = await supabaseAdmin
          .from('friendships')
          .select('id,user_id,friend_id,status')
          .in('user_id', [userId, ...targetIds])
          .in('friend_id', [userId, ...targetIds])

        if (!existingError && existingRows) {
          existing = existingRows
        }
      }

      const results = (profiles || []).map((profile) => {
        const relation = existing.find((row) => {
          return (
            (row.user_id === userId && row.friend_id === profile.user_id) ||
            (row.friend_id === userId && row.user_id === profile.user_id)
          )
        })

        return {
          profile: {
            user_id: profile.user_id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            current_rank: profile.current_rank,
            last_active: profile.last_active,
            is_online: isOnline(profile.last_active)
          },
          status: relation ? relation.status : null,
          request_id: relation ? relation.id : null
        }
      })

      res.json({ results })
    } catch (err) {
      console.error('friends/search error', err)
      res.status(500).json({ error: 'Không thể tìm kiếm đạo hữu' })
    }
  })

  app.post('/friends/request', requireAuth, async (req, res) => {
    const userId = req.user.id
    const targetUsername = (req.body?.target_username || '').trim()
    if (!targetUsername) {
      return res.status(400).json({ error: 'Cần username đạo hữu' })
    }

    try {
      const { data: targetProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('user_id, username, display_name')
        .eq('username', targetUsername)
        .single()

      if (profileError || !targetProfile) {
        return res.status(404).json({ error: 'Không tìm thấy đạo hữu' })
      }

      if (targetProfile.user_id === userId) {
        return res.status(400).json({ error: 'Không thể kết bạn với chính mình' })
      }

      const { data: existingRows, error: existingError } = await supabaseAdmin
        .from('friendships')
        .select('id,status,user_id,friend_id')
        .or(buildOrFilter(userId, ['pending', 'accepted', 'blocked']))

      if (existingError) throw existingError

      const duplicate = (existingRows || []).find((row) => {
        return (
          (row.user_id === userId && row.friend_id === targetProfile.user_id) ||
          (row.friend_id === userId && row.user_id === targetProfile.user_id)
        )
      })

      if (duplicate) {
        return res.status(409).json({ error: `Đã có trạng thái ${duplicate.status}` })
      }

      const { data: insertRow, error: insertError } = await supabaseAdmin
        .from('friendships')
        .insert({
          user_id: userId,
          friend_id: targetProfile.user_id,
          status: 'pending'
        })
        .select('id,user_id,friend_id,status,created_at')
        .single()

      if (insertError) throw insertError

      await upsertNotification(supabaseAdmin, targetProfile.user_id, {
        from: userId,
        username: req.user.email || null,
        type: 'friend_request'
      })

      res.json({ request: insertRow })
    } catch (err) {
      console.error('friends/request error', err)
      res.status(500).json({ error: 'Không thể gửi lời mời' })
    }
  })

  app.post('/friends/respond', requireAuth, async (req, res) => {
    const userId = req.user.id
    const { request_id: requestId, action } = req.body || {}
    if (!requestId || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Thiếu request_id hoặc action' })
    }

    try {
      const { data: requestRow, error: fetchError } = await supabaseAdmin
        .from('friendships')
        .select('id,user_id,friend_id,status')
        .eq('id', requestId)
        .single()

      if (fetchError || !requestRow) {
        return res.status(404).json({ error: 'Không tìm thấy lời mời' })
      }

      if (requestRow.friend_id !== userId) {
        return res.status(403).json({ error: 'Không có quyền xử lý lời mời này' })
      }

      if (requestRow.status !== 'pending') {
        return res.status(400).json({ error: 'Lời mời không còn hiệu lực' })
      }

      const nextStatus = action === 'accept' ? 'accepted' : 'rejected'

      const { data: updatedRow, error: updateError } = await supabaseAdmin
        .from('friendships')
        .update({ status: nextStatus })
        .eq('id', requestId)
        .select('id,user_id,friend_id,status,updated_at')
        .single()

      if (updateError) throw updateError

      res.json({ request: updatedRow })
    } catch (err) {
      console.error('friends/respond error', err)
      res.status(500).json({ error: 'Không thể cập nhật lời mời' })
    }
  })

  app.post('/friends/remove', requireAuth, async (req, res) => {
    const userId = req.user.id
    const targetId = req.body?.friend_id
    if (!targetId) {
      return res.status(400).json({ error: 'Thiếu friend_id' })
    }

    try {
      const { data: rows, error } = await supabaseAdmin
        .from('friendships')
        .select('id,user_id,friend_id,status')
        .or(buildOrFilter(userId, ['accepted', 'pending']))

      if (error) throw error

      const record = (rows || []).find((row) => {
        return (
          (row.user_id === userId && row.friend_id === targetId) ||
          (row.friend_id === userId && row.user_id === targetId)
        )
      })

      if (!record) {
        return res.status(404).json({ error: 'Không tồn tại kết nối' })
      }

      const { error: deleteError } = await supabaseAdmin
        .from('friendships')
        .delete()
        .eq('id', record.id)

      if (deleteError) throw deleteError

      res.json({ removed: record.id })
    } catch (err) {
      console.error('friends/remove error', err)
      res.status(500).json({ error: 'Không thể hủy kết bạn' })
    }
  })

  app.post('/friends/block', requireAuth, async (req, res) => {
    const userId = req.user.id
    const targetId = req.body?.friend_id
    if (!targetId) {
      return res.status(400).json({ error: 'Thiếu friend_id' })
    }

    try {
      const { data: rows, error } = await supabaseAdmin
        .from('friendships')
        .select('id,user_id,friend_id,status')
        .or(buildOrFilter(userId, ['pending', 'accepted', 'rejected']))

      if (error) throw error

      let record = (rows || []).find((row) => {
        return (
          (row.user_id === userId && row.friend_id === targetId) ||
          (row.friend_id === userId && row.user_id === targetId)
        )
      })

      if (record) {
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('friendships')
          .update({ status: 'blocked' })
          .eq('id', record.id)
          .select('id,user_id,friend_id,status')
          .single()

        if (updateError) throw updateError
        record = updated
      } else {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('friendships')
          .insert({ user_id: userId, friend_id: targetId, status: 'blocked' })
          .select('id,user_id,friend_id,status')
          .single()

        if (insertError) throw insertError
        record = inserted
      }

      res.json({ blocked: record })
    } catch (err) {
      console.error('friends/block error', err)
      res.status(500).json({ error: 'Không thể chặn đạo hữu' })
    }
  })
}

module.exports = { registerFriendRoutes }
