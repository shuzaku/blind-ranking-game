import { Server as SocketIOServer } from 'socket.io'
import type { NitroApp } from 'nitropack'
import {
  getGame, startRanking, revealNext, placeItem,
  computeStats, generateSocialQuestions,
  startSocialPhase, getCurrentSocialQuestion,
  recordSocialAnswer, resolveSocialQuestion,
  advanceSocialQuestion, getFinalResults, getCurrentRevealed
} from '../utils/gameStore'

let io: SocketIOServer | null = null

export default defineNitroPlugin((nitroApp: NitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    if (io) return
    const req = event.node.req
    if (!req.socket?.server) return
    const httpServer = req.socket.server as any
    if (httpServer._ioAttached) return
    httpServer._ioAttached = true

    io = new SocketIOServer(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      path: '/socket.io'
    })

    io.on('connection', (socket) => {

      // ─── HOST ────────────────────────────────────────────────────────────

      socket.on('host-join', ({ code }: { code: string }) => {
        const game = getGame(code)
        if (!game) { socket.emit('error', { message: 'Game not found' }); return }
        game.hostSocketId = socket.id
        socket.join(`game:${code}`)
        socket.join(`host:${code}`)
        socket.emit('host-joined', {
          code: game.code,
          listName: game.listName,
          status: game.status,
          totalItems: game.items.length,
          players: serializePlayers(game)
        })
      })

      socket.on('start-game', ({ code }: { code: string }) => {
        const game = getGame(code)
        if (!game || game.hostSocketId !== socket.id) return
        if (game.players.size === 0) { socket.emit('error', { message: 'Need at least one player' }); return }
        if (game.status !== 'lobby') return

        startRanking(game)
        io!.to(`game:${code}`).emit('game-started', { totalItems: game.items.length })

        const revealed = revealNext(game)
        if (revealed) {
          io!.to(`game:${code}`).emit('item-revealed', {
            item: revealed.item,
            itemIndex: revealed.itemIndex,
            itemNumber: revealed.itemNumber,
            totalItems: game.items.length
          })
        }
      })

      socket.on('reveal-next', ({ code }: { code: string }) => {
        const game = getGame(code)
        if (!game || game.hostSocketId !== socket.id) return
        if (game.status !== 'ranking') return
        doRevealNext(game, code)
      })

      // Host starts social deduction after ranking ends
      socket.on('start-social', ({ code }: { code: string }) => {
        const game = getGame(code)
        if (!game || game.hostSocketId !== socket.id) return
        if (game.status !== 'ranking') return

        const stats = computeStats(game)
        game.stats = stats
        game.socialQuestions = generateSocialQuestions(game, stats)

        if (game.socialQuestions.length === 0) {
          // No questions possible — skip straight to results
          game.status = 'results'
          io!.to(`game:${code}`).emit('game-over', {
            results: getFinalResults(game),
            stats,
            items: game.items
          })
          return
        }

        startSocialPhase(game)
        const firstQuestion = getCurrentSocialQuestion(game)!

        io!.to(`game:${code}`).emit('social-started', {
          stats: serializeStats(stats, game),
          totalQuestions: game.socialQuestions.length
        })

        // Short pause then push first question
        setTimeout(() => {
          io!.to(`game:${code}`).emit('social-question', {
            question: firstQuestion,
            questionNumber: 1,
            totalQuestions: game.socialQuestions.length
          })
        }, 1500)
      })

      // Host manually reveals the answer and moves to next question
      socket.on('reveal-answer', ({ code }: { code: string }) => {
        const game = getGame(code)
        if (!game || game.hostSocketId !== socket.id) return
        if (game.status !== 'social') return

        const result = resolveSocialQuestion(game)

        io!.to(`game:${code}`).emit('social-answer-revealed', {
          correctAnswerId: result.question.correctAnswerId,
          explanation: result.question.explanation,
          correctPlayers: result.correctPlayers,
          scores: result.answererScores,
          runningScores: getRunningScores(game)
        })
      })

      socket.on('next-question', ({ code }: { code: string }) => {
        const game = getGame(code)
        if (!game || game.hostSocketId !== socket.id) return
        if (game.status !== 'social') return

        const hasMore = advanceSocialQuestion(game)
        if (!hasMore) {
          game.status = 'results'
          io!.to(`game:${code}`).emit('game-over', {
            results: getFinalResults(game),
            stats: serializeStats(game.stats!, game),
            items: game.items
          })
          return
        }

        const question = getCurrentSocialQuestion(game)!
        io!.to(`game:${code}`).emit('social-question', {
          question,
          questionNumber: game.currentQuestionIndex + 1,
          totalQuestions: game.socialQuestions.length
        })
      })

      // ─── PLAYER ──────────────────────────────────────────────────────────

      socket.on('player-join', ({ code, name }: { code: string; name: string }) => {
        const game = getGame(code)
        if (!game) { socket.emit('error', { message: 'Game not found. Check the code.' }); return }
        if (game.status !== 'lobby') { socket.emit('error', { message: 'Game already in progress' }); return }
        if (!name?.trim()) { socket.emit('error', { message: 'Enter your name' }); return }

        const playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        game.players.set(playerId, {
          id: playerId,
          name: name.trim().substring(0, 20),
          socketId: socket.id,
          placements: {},
          socialScore: 0,
          connected: true
        })

        socket.join(`game:${code}`)
        socket.join(`player:${playerId}`)
        ;(socket as any)._gameCode = code
        ;(socket as any)._playerId = playerId

        const playerList = serializePlayers(game)
        socket.emit('joined', { playerId, players: playerList, totalItems: game.items.length })
        io!.to(`game:${code}`).emit('player-joined', { players: playerList })
      })

      socket.on('place-item', ({ code, slot }: { code: string; slot: number }) => {
        const game = getGame(code)
        if (!game || game.status !== 'ranking') return
        const playerId = (socket as any)._playerId
        if (!playerId) return

        if (!placeItem(game, playerId, slot)) {
          socket.emit('placement-error', { message: 'Cannot place there' })
          return
        }

        const current = getCurrentRevealed(game)!
        socket.emit('placement-confirmed', { slot, itemIndex: current.itemIndex, item: current.item })

        const activePlayers = Array.from(game.players.values()).filter(p => p.connected)
        const placedCount = game.placedThisRound.size

        io!.to(`host:${code}`).emit('placement-update', {
          playerId,
          playerName: game.players.get(playerId)?.name,
          slot,
          placedCount,
          totalPlayers: activePlayers.length
        })

        if (placedCount >= activePlayers.length) {
          const isLast = game.currentRevealIndex >= game.items.length - 1
          io!.to(`game:${code}`).emit('round-complete', {
            itemNumber: game.currentRevealIndex + 1,
            totalItems: game.items.length,
            isLastItem: isLast
          })

          if (!isLast) {
            setTimeout(() => {
              if (getGame(code)) doRevealNext(game, code)
            }, 2500)
          }
          // If last item, host manually kicks off social phase
        }
      })

      // Player submits a social deduction answer
      socket.on('social-answer', ({ code, answerId }: { code: string; answerId: string }) => {
        const game = getGame(code)
        if (!game || game.status !== 'social') return
        const playerId = (socket as any)._playerId
        if (!playerId) return

        const accepted = recordSocialAnswer(game, playerId, answerId)
        if (accepted) {
          socket.emit('social-answer-accepted')
          const activePlayers = Array.from(game.players.values()).filter(p => p.connected)
          io!.to(`host:${code}`).emit('social-answer-count', {
            count: game.socialAnswers.size,
            total: activePlayers.length
          })
        }
      })

      // ─── DISCONNECT ──────────────────────────────────────────────────────

      socket.on('disconnect', () => {
        const gameCode = (socket as any)._gameCode
        const playerId = (socket as any)._playerId
        if (!gameCode || !playerId) return
        const game = getGame(gameCode)
        if (!game) return
        const player = game.players.get(playerId)
        if (player) {
          player.connected = false
          io!.to(`game:${gameCode}`).emit('player-left', {
            playerId,
            players: serializePlayers(game)
          })
        }
      })
    })

    console.log('[Socket.IO] Server initialized')
  })

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function doRevealNext(game: NonNullable<ReturnType<typeof getGame>>, code: string) {
    const revealed = revealNext(game)
    if (revealed) {
      io!.to(`game:${code}`).emit('item-revealed', {
        item: revealed.item,
        itemIndex: revealed.itemIndex,
        itemNumber: revealed.itemNumber,
        totalItems: game.items.length
      })
    }
  }

  function serializePlayers(game: NonNullable<ReturnType<typeof getGame>>) {
    return Array.from(game.players.values()).map(p => ({
      id: p.id, name: p.name, connected: p.connected
    }))
  }

  function getRunningScores(game: NonNullable<ReturnType<typeof getGame>>) {
    return Array.from(game.players.values())
      .map(p => ({ id: p.id, name: p.name, score: p.socialScore }))
      .sort((a, b) => b.score - a.score)
  }

  function serializeStats(stats: NonNullable<ReturnType<typeof getGame>>['stats'], game: NonNullable<ReturnType<typeof getGame>>) {
    if (!stats) return null
    return {
      items: stats.items.map(s => ({
        itemIndex: s.itemIndex,
        item: s.item,
        avgRank: Math.round(s.avgRank * 10) / 10,
        stdDev: Math.round(s.stdDev * 100) / 100,
        rankCounts: s.rankCounts,
        rankedFirstBy: s.rankedFirstBy,
        rankedLastBy: s.rankedLastBy
      })),
      players: stats.players.map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        avgDeviation: Math.round(p.avgDeviation * 10) / 10,
        hotTakes: p.hotTakes
      })),
      mostControversial: stats.mostControversial ? {
        item: stats.mostControversial.item,
        stdDev: Math.round(stats.mostControversial.stdDev * 100) / 100,
        rankedFirstBy: stats.mostControversial.rankedFirstBy
      } : null,
      mostAgreedUpon: stats.mostAgreedUpon ? {
        item: stats.mostAgreedUpon.item,
        stdDev: Math.round(stats.mostAgreedUpon.stdDev * 100) / 100
      } : null,
      playerRankings: Array.from(game.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        placements: Object.fromEntries(
          Object.entries(p.placements).map(([slot, itemIdx]) => [slot, game.items[itemIdx]])
        )
      }))
    }
  }
})
