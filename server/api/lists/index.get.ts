import List from '../../models/List'

export default defineEventHandler(async () => {
  const lists = await List.find({}, 'name description items createdAt')
    .sort({ createdAt: -1 })
    .lean()
  return lists
})
