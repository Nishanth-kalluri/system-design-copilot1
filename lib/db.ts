import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

declare global {
  var mongoose: any
}

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable')
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

// Enums
export type RunStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR'
export type Step = 'REQUIREMENTS' | 'FNFRS' | 'ENTITIES' | 'API' | 'HLD' | 'DEEPDIVE' | 'CONCLUSION'
export type Role = 'USER' | 'PRINCIPAL' | 'SYSTEM'

// Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: String,
  image: String,
  passwordHash: { type: String, required: true },
}, {
  timestamps: true,
})

const ProjectSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
}, {
  timestamps: true,
})

const RunSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['RUNNING', 'PAUSED', 'COMPLETED', 'ERROR'], 
    default: 'RUNNING' 
  },
  step: { 
    type: String, 
    enum: ['REQUIREMENTS', 'FNFRS', 'ENTITIES', 'API', 'HLD', 'DEEPDIVE', 'CONCLUSION'], 
    default: 'REQUIREMENTS' 
  },
  deepDiveNo: { type: Number, default: 0 },
  checkpoint: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
})

const MessageSchema = new mongoose.Schema({
  runId: { type: mongoose.Schema.Types.ObjectId, ref: 'Run', required: true },
  role: { 
    type: String, 
    enum: ['USER', 'PRINCIPAL', 'SYSTEM'], 
    required: true 
  },
  content: {
    text: String,
    step: String,
  },
}, {
  timestamps: true,
})

const SceneVersionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  runId: { type: mongoose.Schema.Types.ObjectId, ref: 'Run' },
  version: { type: Number, required: true },
  scene: mongoose.Schema.Types.Mixed,
}, {
  timestamps: true,
})

// Indexes to improve query performance & memory efficiency on large datasets
// (Helps avoid full collection scans that can bloat memory usage locally)
RunSchema.index({ userId: 1, projectId: 1 })
MessageSchema.index({ runId: 1, role: 1, createdAt: 1 })
SceneVersionSchema.index({ projectId: 1, version: -1 })

// Models
export const User = mongoose.models.User || mongoose.model('User', UserSchema)
export const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema)
export const Run = mongoose.models.Run || mongoose.model('Run', RunSchema)
export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema)
export const SceneVersion = mongoose.models.SceneVersion || mongoose.model('SceneVersion', SceneVersionSchema)
// Export a TypeScript type inferred from the Message schema for use as a document shape
export type MessageType = mongoose.InferSchemaType<typeof MessageSchema>
