import { readMultipartFormData } from 'h3'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  if (!formData?.length) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const file = formData.find(f => f.name === 'image')
  if (!file?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'No image field found' })
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (file.type && !allowedTypes.includes(file.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Only JPEG, PNG, GIF, and WebP allowed' })
  }

  const uploadsDir = join(process.cwd(), 'public', 'uploads')
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true })
  }

  const ext = file.filename?.split('.').pop()?.toLowerCase() || 'jpg'
  const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`
  await writeFile(join(uploadsDir, filename), file.data)

  return { url: `/uploads/${filename}` }
})
