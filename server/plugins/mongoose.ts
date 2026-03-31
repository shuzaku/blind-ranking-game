import mongoose from 'mongoose'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const uri = config.mongoUri as string

  try {
    await mongoose.connect(uri)
    console.log('[MongoDB] Connected to', uri)
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err)
  }
})
