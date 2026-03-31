import mongoose from 'mongoose'

const ItemSchema = new mongoose.Schema({
  text: { type: String, required: true },
  imageUrl: { type: String, default: '' }
})

const ListSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  items: { type: [ItemSchema], default: [] }
}, { timestamps: true })

export default mongoose.models.List || mongoose.model('List', ListSchema)
