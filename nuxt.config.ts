export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  nitro: {
    preset: 'node-server'
  },
  runtimeConfig: {
    mongoUri: 'mongodb://localhost:27017/blind-ranking-game',
    adminPin: '1234',
    r2AccountId: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    r2Bucket: 'blind-rankings',
    r2PublicUrl: 'https://pub-09afdbc3cae549cd97d8c85edf38a49a.r2.dev',
    public: {}
  }
})
