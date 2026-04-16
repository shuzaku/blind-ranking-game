import List from '../../models/List'
import { getGame, createActiveGame } from '../../utils/gameStore'

function generateCode(): string {
  return Math.random().toString(36).substr(2, 4).toUpperCase()
}

export default defineEventHandler(async (event) => {
  const { listId } = await readBody(event)

  if (!listId) {
    throw createError({ statusCode: 400, statusMessage: 'listId is required' })
  }

  const list = await List.findById(listId).lean() as any
  if (!list) {
    throw createError({ statusCode: 404, statusMessage: 'List not found' })
  }

  if (!list.items || list.items.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'List must have at least 3 items' })
  }

  // Generate a unique code
  let code = generateCode()
  let attempts = 0
  while (getGame(code) && attempts < 100) {
    code = generateCode()
    attempts++
  }

  const allItems = list.items.map((item: any) => ({
    text: item.text,
    imageUrl: item.imageUrl || '',
    youtubeUrl: item.youtubeUrl || ''
  }))

  // Randomly pick up to 10 items
  const GAME_SIZE = 10
  const items = allItems.length <= GAME_SIZE
    ? allItems
    : allItems.sort(() => Math.random() - 0.5).slice(0, GAME_SIZE)

  createActiveGame(code, String(list._id), list.name, items)

  return { code, listName: list.name, totalItems: items.length }
})
