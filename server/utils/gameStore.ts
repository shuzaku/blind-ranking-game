export interface GameItem {
  text: string
  imageUrl: string
  youtubeUrl?: string
}

export interface Player {
  id: string
  name: string
  socketId: string
  placements: Record<number, number> // slot (1-indexed) -> item array index
  socialScore: number
  connected: boolean
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface ItemStat {
  itemIndex: number
  item: GameItem
  avgRank: number
  stdDev: number
  rankCounts: number[] // index = slot (1-based), value = how many players gave that rank
  rankedFirstBy: string[]  // player names who put this at #1
  rankedLastBy: string[]   // player names who put this at #N
}

export interface PlayerStat {
  playerId: string
  playerName: string
  avgDeviation: number // avg distance from group consensus
  hotTakes: Array<{
    item: GameItem
    playerRank: number
    groupAvg: number
  }>
}

export interface GameStats {
  items: ItemStat[]
  players: PlayerStat[]
  mostControversial: ItemStat | null
  mostAgreedUpon: ItemStat | null
}

// ── Social Deduction ──────────────────────────────────────────────────────────

export interface SocialQuestion {
  id: string
  prompt: string
  category: string
  options: Array<{ id: string; label: string; imageUrl?: string }>
  correctAnswerId: string
  explanation: string
  subjectPlayerId?: string // player being asked about (excluded from special scoring)
  // Defense round fields
  defensePlayerId?: string  // player who must defend
  defenseItem?: string      // item text being defended
  defensePosition?: 'first' | 'last'
}

export interface SocialRoundResult {
  question: SocialQuestion
  answererScores: Record<string, number> // playerId -> points earned this question
  correctPlayers: string[] // player ids who got it right
  mysteryBonusAwarded: boolean // true if the subject fooled most players
  defenseResult?: {
    defenderWon: boolean
    agreeCount: number
    disagreeCount: number
  }
}

// ── Game ──────────────────────────────────────────────────────────────────────

export interface ActiveGame {
  code: string
  listId: string
  listName: string
  hostSocketId: string | null
  players: Map<string, Player>
  status: 'lobby' | 'ranking' | 'social' | 'results'
  items: GameItem[]
  revealOrder: number[]
  currentRevealIndex: number  // -1 = not started
  placedThisRound: Set<string>

  // Social deduction
  stats: GameStats | null
  socialQuestions: SocialQuestion[]
  currentQuestionIndex: number
  socialAnswers: Map<string, string>  // playerId -> answerId for current question
  socialHistory: SocialRoundResult[]
}

// ── Storage ───────────────────────────────────────────────────────────────────

const games = new Map<string, ActiveGame>()

export const getGame = (code: string) => games.get(code.toUpperCase())
export const deleteGame = (code: string) => games.delete(code.toUpperCase())

export function createActiveGame(
  code: string,
  listId: string,
  listName: string,
  items: GameItem[]
): ActiveGame {
  const game: ActiveGame = {
    code: code.toUpperCase(),
    listId,
    listName,
    hostSocketId: null,
    players: new Map(),
    status: 'lobby',
    items,
    revealOrder: [],
    currentRevealIndex: -1,
    placedThisRound: new Set(),
    stats: null,
    socialQuestions: [],
    currentQuestionIndex: -1,
    socialAnswers: new Map(),
    socialHistory: []
  }
  games.set(code.toUpperCase(), game)
  return game
}

// ── Ranking Phase ─────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function startRanking(game: ActiveGame): void {
  game.status = 'ranking'
  game.revealOrder = shuffle(game.items.map((_, i) => i))
  game.currentRevealIndex = -1
  game.placedThisRound = new Set()
  for (const player of game.players.values()) {
    player.placements = {}
    player.socialScore = 0
  }
}

export interface RevealedItem {
  item: GameItem
  itemIndex: number
  itemNumber: number
}

export function revealNext(game: ActiveGame): RevealedItem | null {
  if (game.currentRevealIndex >= game.revealOrder.length - 1) return null
  game.currentRevealIndex++
  game.placedThisRound = new Set()
  const itemIndex = game.revealOrder[game.currentRevealIndex]
  return { item: game.items[itemIndex], itemIndex, itemNumber: game.currentRevealIndex + 1 }
}

export function getCurrentRevealed(game: ActiveGame): RevealedItem | null {
  if (game.currentRevealIndex < 0) return null
  const itemIndex = game.revealOrder[game.currentRevealIndex]
  return { item: game.items[itemIndex], itemIndex, itemNumber: game.currentRevealIndex + 1 }
}

export function placeItem(game: ActiveGame, playerId: string, slot: number): boolean {
  const player = game.players.get(playerId)
  if (!player) return false
  if (game.currentRevealIndex < 0) return false
  const current = getCurrentRevealed(game)
  if (!current) return false
  if (slot < 1 || slot > game.items.length) return false
  if (player.placements[slot] !== undefined) return false
  if (game.placedThisRound.has(playerId)) return false
  player.placements[slot] = current.itemIndex
  game.placedThisRound.add(playerId)
  return true
}

// ── Stats Computation ─────────────────────────────────────────────────────────

export function computeStats(game: ActiveGame): GameStats {
  const players = Array.from(game.players.values())
  const n = game.items.length

  const itemStats: ItemStat[] = game.items.map((item, itemIdx) => {
    const ranks: number[] = []
    for (const player of players) {
      for (const [slotStr, idx] of Object.entries(player.placements)) {
        if (idx === itemIdx) { ranks.push(parseInt(slotStr)); break }
      }
    }
    const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0
    const variance = ranks.reduce((acc, r) => acc + Math.pow(r - avgRank, 2), 0) / (ranks.length || 1)
    const rankCounts = new Array(n + 1).fill(0)
    for (const r of ranks) rankCounts[r]++

    return {
      itemIndex: itemIdx,
      item,
      avgRank,
      stdDev: Math.sqrt(variance),
      rankCounts,
      rankedFirstBy: players.filter(p => p.placements[1] === itemIdx).map(p => p.name),
      rankedLastBy: players.filter(p => p.placements[n] === itemIdx).map(p => p.name)
    }
  })

  const playerStats: PlayerStat[] = players.map(player => {
    let totalDev = 0
    const hotTakes: PlayerStat['hotTakes'] = []

    for (const [slotStr, itemIdx] of Object.entries(player.placements)) {
      const slot = parseInt(slotStr)
      const avgRank = itemStats[itemIdx].avgRank
      const dev = Math.abs(slot - avgRank)
      totalDev += dev
      if (dev >= 1.5) {
        hotTakes.push({ item: game.items[itemIdx], playerRank: slot, groupAvg: Math.round(avgRank * 10) / 10 })
      }
    }

    hotTakes.sort((a, b) =>
      Math.abs(b.playerRank - b.groupAvg) - Math.abs(a.playerRank - a.groupAvg)
    )

    return {
      playerId: player.id,
      playerName: player.name,
      avgDeviation: n > 0 ? totalDev / n : 0,
      hotTakes: hotTakes.slice(0, 3)
    }
  })

  const sorted = [...itemStats].sort((a, b) => b.stdDev - a.stdDev)

  return {
    items: itemStats,
    players: playerStats,
    mostControversial: sorted[0] ?? null,
    mostAgreedUpon: sorted[sorted.length - 1] ?? null
  }
}

// ── Social Question Generation ────────────────────────────────────────────────

export function generateSocialQuestions(game: ActiveGame, stats: GameStats): SocialQuestion[] {
  const players = Array.from(game.players.values())
  const n = game.items.length
  const questions: SocialQuestion[] = []
  const playerOptions = players.map(p => ({ id: p.id, label: p.name }))

  // Q type 1: "Which item did [player] rank #1?"
  for (const player of players) {
    const top1 = player.placements[1]
    if (top1 === undefined) continue
    questions.push({
      id: `top1_${player.id}`,
      category: 'Hot Take',
      prompt: `Which item did ${player.name} rank #1?`,
      options: game.items.map((item, idx) => ({
        id: String(idx),
        label: item.text,
        imageUrl: item.imageUrl || undefined
      })),
      correctAnswerId: String(top1),
      explanation: `${player.name} put "${game.items[top1].text}" at the top!`,
      subjectPlayerId: player.id
    })
  }

  // Q type 2: "Who ranked [item] at #1?" — only when a unique answer exists
  for (const stat of stats.items) {
    if (stat.rankedFirstBy.length === 1) {
      const correctPlayer = players.find(p => p.name === stat.rankedFirstBy[0])
      if (!correctPlayer) continue
      questions.push({
        id: `first_${stat.itemIndex}`,
        category: 'Agree or Disagree',
        prompt: `Who ranked "${stat.item.text}" at #1?`,
        options: playerOptions,
        correctAnswerId: correctPlayer.id,
        explanation: `${correctPlayer.name} was the only one who put "${stat.item.text}" first!`,
        subjectPlayerId: correctPlayer.id
      })
    }
  }

  // Q type 3: "Who ranked [item] LAST?" — unique answer
  for (const stat of stats.items) {
    if (stat.rankedLastBy.length === 1) {
      const correctPlayer = players.find(p => p.name === stat.rankedLastBy[0])
      if (!correctPlayer) continue
      questions.push({
        id: `last_${stat.itemIndex}`,
        category: 'Harsh Critic',
        prompt: `Who ranked "${stat.item.text}" dead last?`,
        options: playerOptions,
        correctAnswerId: correctPlayer.id,
        explanation: `${correctPlayer.name} put "${stat.item.text}" at the bottom!`,
        subjectPlayerId: correctPlayer.id
      })
    }
  }

  // Q type 4: Hot take — "How did [player] rank [controversial item]?"
  if (stats.mostControversial && players.length >= 2) {
    for (const player of players) {
      const controversialIdx = stats.mostControversial.itemIndex
      const rank = player.placements[controversialIdx + 1] !== undefined
        ? Object.entries(player.placements).find(([, v]) => v === controversialIdx)?.[0]
        : undefined
      if (rank === undefined) continue

      const slotNum = parseInt(rank)
      const groupAvg = stats.mostControversial.avgRank
      const diff = Math.abs(slotNum - groupAvg)
      if (diff < 1.5) continue // only ask if it's a genuine hot take

      // Generate rank options (nearby +/- 2 slots plus correct)
      const optionSlots = new Set<number>([slotNum])
      for (let delta = 1; optionSlots.size < Math.min(4, n); delta++) {
        if (slotNum - delta >= 1) optionSlots.add(slotNum - delta)
        if (slotNum + delta <= n) optionSlots.add(slotNum + delta)
      }
      const rankOptions = Array.from(optionSlots).sort((a, b) => a - b).map(s => ({
        id: String(s),
        label: `#${s}`
      }))

      questions.push({
        id: `hottake_${player.id}_${controversialIdx}`,
        category: 'Spicy Take',
        prompt: `The group disagreed most on "${stats.mostControversial.item.text}". How did ${player.name} rank it?`,
        options: rankOptions,
        correctAnswerId: String(slotNum),
        explanation: `${player.name} ranked "${stats.mostControversial.item.text}" at #${slotNum}! Group average was #${groupAvg.toFixed(1)}.`,
        subjectPlayerId: player.id
      })
      break // one of these is enough
    }
  }

  // Q type 5: "Which item was most controversial?" — multiple choice
  if (stats.items.length >= 3) {
    const byControversy = [...stats.items].sort((a, b) => b.stdDev - a.stdDev)
    const top4 = byControversy.slice(0, 4)
    questions.push({
      id: 'most_controversial',
      category: 'Group Insight',
      prompt: 'Which item caused the most disagreement?',
      options: top4.map(s => ({
        id: String(s.itemIndex),
        label: s.item.text,
        imageUrl: s.item.imageUrl || undefined
      })),
      correctAnswerId: String(byControversy[0].itemIndex),
      explanation: `"${byControversy[0].item.text}" had the widest spread of rankings!`
    })
  }

  // Q type 6: "Who had the most unique taste?" — highest avg deviation
  if (players.length >= 3) {
    const mostUnique = [...stats.players].sort((a, b) => b.avgDeviation - a.avgDeviation)[0]
    if (mostUnique) {
      questions.push({
        id: 'most_unique',
        category: 'Group Insight',
        prompt: 'Who had the most unique / contrarian taste?',
        options: playerOptions,
        correctAnswerId: mostUnique.playerId,
        explanation: `${mostUnique.playerName} deviated the most from the group consensus!`,
        subjectPlayerId: mostUnique.playerId
      })
    }
  }

  const shuffled = shuffle(questions).slice(0, Math.min(8, questions.length))

  // Defense round: pick a random player with a #1 or last-place ranked item
  const eligiblePlayers = players.filter(p => {
    return p.placements[1] !== undefined || p.placements[n] !== undefined
  })
  if (eligiblePlayers.length > 0) {
    const defender = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)]
    const position: 'first' | 'last' = Math.random() < 0.5 ? 'first' : 'last'
    const itemIdx = position === 'first' ? defender.placements[1] : defender.placements[n]
    if (itemIdx !== undefined) {
      const itemText = game.items[itemIdx].text
      const defenseQ: SocialQuestion = {
        id: `defense_${defender.id}`,
        category: 'defense',
        prompt: `${defender.name} ranked "${itemText}" ${position === 'first' ? '#1' : 'last'}. Do you agree with their choice?`,
        options: [
          { id: 'agree', label: '👍 Agree' },
          { id: 'disagree', label: '👎 Disagree' }
        ],
        correctAnswerId: '', // determined at resolve time by majority
        explanation: '',
        defensePlayerId: defender.id,
        defenseItem: itemText,
        defensePosition: position
      }
      // Insert defense round at a random position among the shuffled questions
      const insertAt = Math.floor(Math.random() * (shuffled.length + 1))
      shuffled.splice(insertAt, 0, defenseQ)
    }
  }

  return shuffled
}

// ── Social Phase Actions ──────────────────────────────────────────────────────

export function startSocialPhase(game: ActiveGame): void {
  game.status = 'social'
  game.currentQuestionIndex = 0
  game.socialAnswers = new Map()
  game.socialHistory = []
}

export function getCurrentSocialQuestion(game: ActiveGame): SocialQuestion | null {
  if (game.currentQuestionIndex < 0 || game.currentQuestionIndex >= game.socialQuestions.length) {
    return null
  }
  return game.socialQuestions[game.currentQuestionIndex]
}

export function recordSocialAnswer(game: ActiveGame, playerId: string, answerId: string): boolean {
  if (!game.socialAnswers.has(playerId)) {
    game.socialAnswers.set(playerId, answerId)
    return true
  }
  return false // already answered
}

export function resolveSocialQuestion(game: ActiveGame): SocialRoundResult {
  const question = getCurrentSocialQuestion(game)!
  const scores: Record<string, number> = {}

  // ── Defense round ──────────────────────────────────────────────────────────
  if (question.category === 'defense' && question.defensePlayerId) {
    let agreeCount = 0
    let disagreeCount = 0

    for (const [playerId, answerId] of game.socialAnswers.entries()) {
      if (playerId === question.defensePlayerId) continue // defender doesn't vote
      if (answerId === 'agree') agreeCount++
      else disagreeCount++
      scores[playerId] = 0 // default; overwritten below
    }

    const defenderWon = agreeCount > disagreeCount
    const winningSide = defenderWon ? 'agree' : disagreeCount > agreeCount ? 'disagree' : null

    // Award voter points to the winning side (ties → no bonus)
    if (winningSide) {
      for (const [playerId, answerId] of game.socialAnswers.entries()) {
        if (playerId === question.defensePlayerId) continue
        if (answerId === winningSide) {
          scores[playerId] = 300
          const player = game.players.get(playerId)
          if (player) player.socialScore += 300
        }
      }
    }

    // Defender always earns +200 for making their case
    const defender = game.players.get(question.defensePlayerId)
    if (defender) {
      defender.socialScore += 200
      scores[question.defensePlayerId] = 200
    }

    const result: SocialRoundResult = {
      question: { ...question, correctAnswerId: winningSide ?? '' },
      answererScores: scores,
      correctPlayers: winningSide
        ? Array.from(game.socialAnswers.entries())
            .filter(([pid, ans]) => pid !== question.defensePlayerId && ans === winningSide)
            .map(([pid]) => pid)
        : [],
      mysteryBonusAwarded: false,
      defenseResult: { defenderWon, agreeCount, disagreeCount }
    }
    game.socialHistory.push(result)
    game.socialAnswers = new Map()
    return result
  }

  // ── Normal question ────────────────────────────────────────────────────────
  const correct: string[] = []

  for (const [playerId, answerId] of game.socialAnswers.entries()) {
    if (answerId === question.correctAnswerId) {
      scores[playerId] = 300
      correct.push(playerId)
      const player = game.players.get(playerId)
      if (player) player.socialScore += 300
    } else {
      scores[playerId] = 0
    }
  }

  // If the subject was mostly guessed wrong, give them a mystery bonus
  let mysteryBonusAwarded = false
  if (question.subjectPlayerId) {
    const subjectCorrectGuessers = correct.filter(id => id !== question.subjectPlayerId)
    const totalAnswerers = game.socialAnswers.size
    const wrongGuessers = totalAnswerers - subjectCorrectGuessers.length

    if (wrongGuessers > subjectCorrectGuessers.length) {
      const subject = game.players.get(question.subjectPlayerId)
      if (subject) {
        subject.socialScore += 150
        scores[question.subjectPlayerId] = (scores[question.subjectPlayerId] ?? 0) + 150
        mysteryBonusAwarded = true
      }
    }
  }

  const result: SocialRoundResult = {
    question,
    answererScores: scores,
    correctPlayers: correct,
    mysteryBonusAwarded
  }
  game.socialHistory.push(result)
  game.socialAnswers = new Map()
  return result
}

export function advanceSocialQuestion(game: ActiveGame): boolean {
  game.currentQuestionIndex++
  game.socialAnswers = new Map()
  return game.currentQuestionIndex < game.socialQuestions.length
}

export function getFinalResults(game: ActiveGame) {
  return Array.from(game.players.values())
    .map(p => ({
      id: p.id,
      name: p.name,
      socialScore: p.socialScore,
      placements: { ...p.placements }
    }))
    .sort((a, b) => b.socialScore - a.socialScore)
}
