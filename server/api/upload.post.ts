import { readMultipartFormData } from 'h3'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

let s3: S3Client | null = null

function getS3Client(config: ReturnType<typeof useRuntimeConfig>) {
  if (!s3) {
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId as string,
        secretAccessKey: config.r2SecretAccessKey as string
      }
    })
  }
  return s3
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
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

  const ext = file.filename?.split('.').pop()?.toLowerCase() || 'jpg'
  const key = `uploads/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`

  const client = getS3Client(config)
  await client.send(new PutObjectCommand({
    Bucket: config.r2Bucket as string,
    Key: key,
    Body: file.data,
    ContentType: file.type || 'image/jpeg'
  }))

  return { url: `${config.r2PublicUrl}/${key}` }
})
