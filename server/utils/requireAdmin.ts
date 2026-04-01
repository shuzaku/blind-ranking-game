import type { H3Event } from 'h3'

export function requireAdmin(event: H3Event) {
  const config = useRuntimeConfig()
  const pin = getHeader(event, 'x-admin-pin')
  if (!pin || pin !== config.adminPin) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
