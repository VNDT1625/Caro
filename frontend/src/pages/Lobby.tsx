import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Lobby() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [roomInfo, setRoomInfo] = useState<any>(null)

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      setUser(data.session?.user ?? null)
    }
    getSession()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => { listener?.subscription.unsubscribe() }
  }, [])

  const signUp = async () => {
    setMessage('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setMessage(error.message)
    else setMessage('Signup email sent (check inbox)')
  }

  const signIn = async () => {
    setMessage('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    else setMessage('Signed in')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setMessage('Signed out')
  }

  const createRoom = async () => {
    setMessage('')
    // get access token
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    try {
      const res = await fetch((import.meta.env.VITE_API_URL ?? '') + '/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ name: 'Lobby room from frontend' })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Create room failed')
      setRoomInfo(json.room ?? json)
      setMessage('Room created: ' + (json.id ?? json.room?.id))
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  const [joinId, setJoinId] = useState('')
  const joinRoom = async () => {
    setMessage('')
    if (!joinId) return setMessage('Nhập ID phòng để tham gia')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    try {
      const res = await fetch((import.meta.env.VITE_API_URL ?? '') + '/api/rooms/' + joinId + '/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({})
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Join room failed')
      setRoomInfo(json.room ?? json)
      // remember current room and navigate to room page
      try { localStorage.setItem('currentRoomId', json.room?.id ?? json.id ?? joinId) } catch(e) {}
      window.location.hash = '#room'
      setMessage('Joined room')
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  return (
    <div className="app-container">
      {/* Breadcrumb Navigation */}
      <nav style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '13px', 
        color: 'var(--color-muted)',
        marginBottom: '16px',
        paddingLeft: '24px'
      }}>
        <a 
          href="#home" 
          style={{ 
            color: 'var(--color-muted)', 
            textDecoration: 'none',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}
        >
          Chánh Điện
        </a>
        <span style={{ color: 'var(--color-muted)' }}>›</span>
        <span style={{ color: 'var(--color-text)' }}>Lobby</span>
      </nav>
      
      <div className="panel glass-card energy-border">
        <h2 style={{ marginTop: 0 }}>Lobby</h2>

        {!user ? (
          <div>
            <p style={{ color: 'var(--color-muted)' }}>Log in or Sign up to create a room.</p>
            <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
            <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <div style={{ marginTop: 8 }}>
              <button onClick={signIn}>Sign In</button>
              <button onClick={signUp} style={{ marginLeft: 8 }}>Sign Up</button>
            </div>
          </div>
        ) : (
          <div>
            <p>Signed in as <strong>{user.email ?? user.id}</strong></p>
            <button onClick={signOut}>Sign Out</button>
          </div>
        )}

        <hr />

        <div style={{ marginTop: 10 }}>
          <button onClick={createRoom}>Create Room (call backend)</button>
        </div>

        <div style={{ marginTop: 10 }}>
          <input placeholder="Room ID to join" value={joinId} onChange={e => setJoinId(e.target.value)} />
          <button style={{ marginLeft: 8 }} onClick={joinRoom}>Join Room</button>
        </div>

        {roomInfo && (
          <div style={{ marginTop: 12 }}>
            <h4>Room</h4>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(roomInfo, null, 2)}</pre>
          </div>
        )}

        {message && <p style={{ color: 'var(--color-muted)' }}>{message}</p>}
      </div>
    </div>
  )
}
