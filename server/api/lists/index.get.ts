import List from '../../models/List'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const filter: Record<string, any> = {}
  if (query.tag) filter.tags = query.tag

  const lists = await List.find(filter, 'name description tags items createdAt')
    .sort({ createdAt: -1 })
    .lean()
  return lists
})
