export default defineEventHandler(async (event) => {
  const { pin } = await readBody(event)
  const config = useRuntimeConfig()

  if (!pin || pin !== config.adminPin) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid PIN' })
  }

  return { ok: true }
})
