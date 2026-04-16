import List from '../../models/List'
import { requireAdmin } from '../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'List name is required' })
  }

  const list = await List.findByIdAndUpdate(
    id,
    {
      name: body.name.trim(),
      description: body.description?.trim() || '',
      tags: (body.tags || []).map((t: string) => t.trim().toLowerCase()).filter(Boolean),
      items: (body.items || []).map((item: any) => ({
        text: item.text?.trim() || '',
        imageUrl: item.imageUrl || '',
        youtubeUrl: item.youtubeUrl || ''
      })).filter((item: any) => item.text)
    },
    { new: true }
  ).lean()

  if (!list) throw createError({ statusCode: 404, statusMessage: 'List not found' })
  return list
})
