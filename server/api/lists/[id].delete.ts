import List from '../../models/List'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const list = await List.findByIdAndDelete(id)
  if (!list) throw createError({ statusCode: 404, statusMessage: 'List not found' })
  return { ok: true }
})
