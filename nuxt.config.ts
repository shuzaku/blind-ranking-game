export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  nitro: {
    preset: 'node-server'
  },
  runtimeConfig: {
    mongoUri: 'mongodb://localhost:27017/blind-ranking-game',
    public: {}
  }
})
