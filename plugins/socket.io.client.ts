import { io, type Socket } from 'socket.io-client'

export default defineNuxtPlugin(() => {
  const socket: Socket = io({
    path: '/socket.io',
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  })

  return {
    provide: { socket }
  }
})
