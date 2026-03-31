import List from '../../models/List'

export default defineEventHandler(async (event) => {
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
      items: (body.items || []).map((item: any) => ({
        text: item.text?.trim() || '',
        imageUrl: item.imageUrl || ''
      })).filter((item: any) => item.text)
    },
    { new: true }
  ).lean()

  if (!list) throw createError({ statusCode: 404, statusMessage: 'List not found' })
  return list
})
