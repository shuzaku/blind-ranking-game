type SoundName =
  | 'click'
  | 'join'
  | 'success'
  | 'whoosh'
  | 'pop'
  | 'chime'
  | 'playerJoin'
  | 'gameStart'
  | 'itemReveal'
  | 'placement'
  | 'allPlaced'
  | 'roundComplete'
  | 'socialStart'
  | 'answerIn'
  | 'reveal'
  | 'correct'
  | 'wrong'
  | 'tick'
  | 'fanfare'
  | 'countdown'

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playTone(
  frequency: number,
  type: OscillatorType,
  duration: number,
  gainPeak: number,
  detune = 0,
  delay = 0
) {
  if (typeof window === 'undefined') return
  try {
    const ac = getCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.type = type
    osc.frequency.value = frequency
    osc.detune.value = detune
    const start = ac.currentTime + delay
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(gainPeak, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    osc.start(start)
    osc.stop(start + duration)
  } catch {}
}

function playNoise(
  filterFreqStart: number,
  filterFreqEnd: number,
  duration: number,
  gainPeak: number,
  delay = 0
) {
  if (typeof window === 'undefined') return
  try {
    const ac = getCtx()
    const bufferSize = Math.ceil(ac.sampleRate * duration)
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const source = ac.createBufferSource()
    source.buffer = buffer
    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    const start = ac.currentTime + delay
    filter.frequency.setValueAtTime(filterFreqStart, start)
    filter.frequency.exponentialRampToValueAtTime(filterFreqEnd, start + duration)
    filter.Q.value = 0.8
    const gain = ac.createGain()
    gain.gain.setValueAtTime(gainPeak, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(ac.destination)
    source.start(start)
    source.stop(start + duration)
  } catch {}
}

const sounds: Record<SoundName, () => void> = {
  // UI basics
  click: () => {
    playTone(880, 'sine', 0.08, 0.12)
    playTone(1100, 'sine', 0.06, 0.07, 0, 0.04)
  },
  pop: () => {
    playTone(300, 'triangle', 0.12, 0.25)
    playTone(180, 'sine', 0.1, 0.1, 0, 0.06)
  },
  whoosh: () => playNoise(900, 150, 0.28, 0.18),
  chime: () => {
    playTone(1046, 'sine', 0.45, 0.18)
    playTone(1318, 'sine', 0.45, 0.14, 0, 0.08)
    playTone(1568, 'sine', 0.55, 0.2, 0, 0.16)
  },

  // Lobby / navigation
  join: () => {
    playTone(523, 'sine', 0.15, 0.18)
    playTone(659, 'sine', 0.15, 0.18, 0, 0.12)
    playTone(784, 'sine', 0.18, 0.22, 0, 0.24)
  },

  // A player joining the lobby (host hears this)
  playerJoin: () => {
    playTone(440, 'triangle', 0.1, 0.14)
    playTone(660, 'triangle', 0.14, 0.18, 0, 0.08)
    playTone(880, 'sine', 0.18, 0.14, 0, 0.16)
  },

  // Game start — energetic rising sweep
  gameStart: () => {
    playNoise(200, 1200, 0.35, 0.12)
    playTone(261, 'sawtooth', 0.12, 0.1)
    playTone(392, 'sawtooth', 0.12, 0.1, 0, 0.1)
    playTone(523, 'sawtooth', 0.12, 0.12, 0, 0.2)
    playTone(784, 'sine', 0.25, 0.2, 0, 0.3)
    playTone(1046, 'sine', 0.3, 0.22, 0, 0.42)
  },

  // Item revealed — dramatic "dun dun DUN"
  itemReveal: () => {
    playTone(220, 'sawtooth', 0.18, 0.18)
    playTone(220, 'sawtooth', 0.18, 0.18, 0, 0.22)
    playTone(329, 'sine', 0.4, 0.28, 0, 0.44)
    playNoise(600, 300, 0.15, 0.08, 0.44)
  },

  // Player places an item
  placement: () => {
    playTone(523, 'triangle', 0.1, 0.15)
    playTone(659, 'triangle', 0.1, 0.12, 0, 0.07)
  },

  // All players placed (everyone done for a round)
  allPlaced: () => {
    playTone(659, 'sine', 0.12, 0.15)
    playTone(784, 'sine', 0.15, 0.18, 0, 0.1)
    playTone(988, 'sine', 0.2, 0.2, 0, 0.22)
  },

  // All items ranked, round is complete
  roundComplete: () => {
    playNoise(400, 800, 0.2, 0.1)
    playTone(523, 'sine', 0.15, 0.18)
    playTone(659, 'sine', 0.15, 0.18, 0, 0.12)
    playTone(784, 'sine', 0.15, 0.2, 0, 0.24)
    playTone(1046, 'sine', 0.3, 0.25, 0, 0.38)
  },

  // Social round starting
  socialStart: () => {
    playTone(392, 'sine', 0.12, 0.15)
    playTone(523, 'sine', 0.12, 0.15, 0, 0.1)
    playTone(659, 'sine', 0.12, 0.18, 0, 0.2)
    playTone(784, 'sine', 0.2, 0.2, 0, 0.32)
    playNoise(500, 1000, 0.15, 0.06, 0.32)
  },

  // An answer comes in from a player (host hears this)
  answerIn: () => {
    playTone(880, 'sine', 0.07, 0.1)
    playTone(1100, 'sine', 0.06, 0.07, 0, 0.05)
  },

  // Answer is being revealed — drum-roll style
  reveal: () => {
    for (let i = 0; i < 6; i++) {
      playNoise(800, 800, 0.04, 0.08, i * 0.06)
    }
    playTone(523, 'sine', 0.2, 0.2, 0, 0.38)
    playTone(784, 'sine', 0.25, 0.25, 0, 0.52)
  },

  // Player got it correct
  correct: () => {
    playTone(523, 'sine', 0.12, 0.2)
    playTone(659, 'sine', 0.12, 0.22, 0, 0.1)
    playTone(784, 'sine', 0.15, 0.22, 0, 0.2)
    playTone(1047, 'sine', 0.25, 0.28, 0, 0.32)
    playNoise(600, 1200, 0.2, 0.06, 0.32)
  },

  // Player got it wrong
  wrong: () => {
    playTone(300, 'sawtooth', 0.12, 0.2)
    playTone(250, 'sawtooth', 0.18, 0.18, 0, 0.14)
    playTone(200, 'sawtooth', 0.22, 0.15, 0, 0.3)
  },

  // Countdown tick
  tick: () => {
    playTone(660, 'square', 0.06, 0.08)
  },

  // Final results fanfare
  fanfare: () => {
    playNoise(300, 1200, 0.4, 0.1)
    const melody = [523, 523, 523, 659, 523, 659, 784]
    const times  = [0,  0.15, 0.3, 0.45, 0.65, 0.8, 0.95]
    melody.forEach((f, i) => playTone(f, 'sine', 0.2, 0.2, 0, times[i]))
    // harmony
    const harmony = [659, 659, 659, 784, 659, 784, 1047]
    harmony.forEach((f, i) => playTone(f, 'triangle', 0.18, 0.1, 0, times[i]))
  },

  // Countdown tick (alias for auto-advance timer)
  countdown: () => {
    playTone(440, 'square', 0.07, 0.07)
  },

  // Generic success
  success: () => {
    playTone(523, 'sine', 0.15, 0.2)
    playTone(659, 'sine', 0.15, 0.2, 0, 0.12)
    playTone(784, 'sine', 0.15, 0.2, 0, 0.24)
    playTone(1047, 'sine', 0.2, 0.3, 0, 0.36)
  },
}

export function useSound() {
  function play(name: SoundName) {
    if (typeof window === 'undefined') return
    sounds[name]?.()
  }

  return { play }
}
