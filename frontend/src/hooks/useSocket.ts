/**
 * useSocket Hook
 * 
 * Manages Socket.IO connection to the game server.
 * Provides a singleton socket instance for the entire app.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { supabase } from '../lib/supabase'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000'

// Singleton socket instance
let socketInstance: Socket | null = null
let connectionPromise: Promise<Socket> | null = null

interface UseSocketOptions {
  autoConnect?: boolean
  roomId?: string | null
}

interface UseSocketReturn {
  socket: Socket | null
  isConnected: boolean
  error: string | null
  connect: () => Promise<Socket | null>
  disconnect: () => void
  emit: (event: string, data: any) => void
  on: (event: string, handler: (...args: any[]) => void) => void
  off: (event: string, handler?: (...args: any[]) => void) => void
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true, roomId } = options
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const handlersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map())

  const connect = useCallback(async (): Promise<Socket | null> => {
    // Return existing connection if available
    if (socketInstance?.connected) {
      socketRef.current = socketInstance
      setIsConnected(true)
      return socketInstance
    }

    // Wait for existing connection attempt
    if (connectionPromise) {
      return connectionPromise
    }

    connectionPromise = (async () => {
      try {
        // Get auth token
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        // Create socket connection
        socketInstance = io(SOCKET_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        })

        return new Promise<Socket>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Socket connection timeout'))
          }, 10000)

          socketInstance!.on('connect', () => {
            clearTimeout(timeout)
            console.log('✅ Socket connected:', socketInstance!.id)
            setIsConnected(true)
            setError(null)
            socketRef.current = socketInstance
            resolve(socketInstance!)
          })

          socketInstance!.on('connect_error', (err) => {
            clearTimeout(timeout)
            console.error('❌ Socket connection error:', err.message)
            setError(err.message)
            setIsConnected(false)
            reject(err)
          })

          socketInstance!.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason)
            setIsConnected(false)
          })
        })
      } catch (err: any) {
        console.error('Socket connection failed:', err)
        setError(err.message)
        connectionPromise = null
        return null
      }
    })()

    const result = await connectionPromise
    connectionPromise = null
    return result
  }, [])

  const disconnect = useCallback(() => {
    if (socketInstance) {
      socketInstance.disconnect()
      socketInstance = null
      socketRef.current = null
      setIsConnected(false)
    }
  }, [])

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    } else {
      console.warn('Socket not connected, cannot emit:', event)
    }
  }, [])

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set())
    }
    handlersRef.current.get(event)!.add(handler)

    if (socketRef.current) {
      socketRef.current.on(event, handler)
    }
  }, [])

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (handler) {
      handlersRef.current.get(event)?.delete(handler)
      socketRef.current?.off(event, handler)
    } else {
      handlersRef.current.delete(event)
      socketRef.current?.off(event)
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      // Clean up handlers but don't disconnect (singleton)
      handlersRef.current.forEach((handlers, event) => {
        handlers.forEach(handler => {
          socketRef.current?.off(event, handler)
        })
      })
      handlersRef.current.clear()
    }
  }, [autoConnect, connect])

  // Join room when roomId changes
  useEffect(() => {
    if (roomId && socketRef.current?.connected) {
      socketRef.current.emit('join_room', { roomId })
      console.log('📍 Joined room:', roomId)
    }
  }, [roomId, isConnected])

  return {
    socket: socketRef.current,
    isConnected,
    error,
    connect,
    disconnect,
    emit,
    on,
    off
  }
}

export default useSocket
