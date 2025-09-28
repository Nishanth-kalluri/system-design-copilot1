# System Design Copilot

AI-powered system design assistant using Next.js 14, MongoDB, and Groq AI.

## Features

- **7-step design process**: Requirements → FNFRs → Entities → API → HLD → Deep Dive → Conclusion
- **Human-in-the-loop**: Review and apply AI-generated Excalidraw patches
- **Real-time updates**: Server-sent events for live collaboration
- **Export functionality**: Download designs as ZIP files
- **Username/password authentication**: Secure access with NextAuth

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: NextAuth.js with Credentials provider
- **AI**: Groq Cloud (llama-3.3-70b-versatile)
- **UI**: TailwindCSS + Excalidraw
- **Real-time**: Server-Sent Events (SSE)

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   Create `.env.local`:
   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=changeme-in-prod-random-secret-key-here
   MONGODB_URI=mongodb://localhost:27017/system-design-copilot
   LLM_API_KEY=gsk_your_groq_api_key_here
   SSE_HEARTBEAT_MS=15000
   ```

3. **Start MongoDB**:
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 mongo:latest
   
   # Or install MongoDB locally
   ```

4. **Run the application**:
   ```bash
   npm run dev
   ```

5. **Open browser**:
   Navigate to `http://localhost:3000`

## Usage

1. **Sign up** for a new account
2. **Sign in** with your credentials  
3. Click **"Start Design Session"** to create a new project
4. Follow the 7-step guided process:
   - Provide requirements and constraints
   - Review AI-generated designs
   - Apply suggested Excalidraw patches
   - Export your final design

## API Routes

- `POST /api/auth/register` - Create new user account
- `POST /api/projects` - Create new design project
- `POST /api/runs` - Start/resume design session
- `GET /api/runs/[runId]/events` - Server-sent events stream
- `POST /api/runs/[runId]/step` - Advance to next step
- `POST /api/runs/[runId]/approve` - Apply pending patches
- `GET /api/runs/[runId]/export` - Download design ZIP

## Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Production build
npm run build
npm run start
```

## Acceptance Tests Checklist

- [ ] Sign up creates user with hashed password
- [ ] Sign in with credentials works
- [ ] Root page shows "Start Design Session" when authenticated
- [ ] Creating project redirects to `/projects/[id]`
- [ ] Clicking "Next" advances through steps via SSE
- [ ] HLD step shows pending patch with "Apply Patch" button
- [ ] Apply Patch updates Excalidraw canvas
- [ ] Deep Dive allowed once with optional patch
- [ ] Export downloads ZIP with scene.json + summary.md
- [ ] Page refresh preserves step/messages/canvas state
- [ ] Canvas changes POST to `/user-edit` (server logs)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXTAUTH_URL` | Application URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth secret key | (required) |
| `MONGODB_URI` | MongoDB connection string | (required) |
| `LLM_API_KEY` | Groq API key | (required) |
| `SSE_HEARTBEAT_MS` | SSE heartbeat interval | `15000` |

## License

MIT

---

## RUN GUIDE

### Prerequisites
- Node.js 18+
- MongoDB running locally or accessible remotely
- Groq API account and key

### Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create and fill `.env.local`**:
   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-min-32-chars-long
   MONGODB_URI=mongodb://localhost:27017/system-design-copilot
   LLM_API_KEY=gsk_your_groq_api_key_here
   SSE_HEARTBEAT_MS=15000
   ```

3. **Start MongoDB** (if not already running):
   ```bash
   # Using Docker (recommended)
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or install MongoDB locally and start service
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to `http://localhost:3000`

6. **Test the application**:
   - Click "Sign Up" to create an account
   - Sign in with your credentials
   - Click "Start Design Session" to begin
   - Follow through the 7-step design process
   - Apply patches and export your design

### Quick MongoDB Setup with Docker
If you don't have MongoDB installed:

```bash
# Pull and run MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Verify it's running
docker ps
```

### Getting a Groq API Key
1. Visit https://console.groq.com
2. Sign up for an account
3. Generate an API key
4. Copy the key (starts with `gsk_`) to your `.env.local`

### Troubleshooting
- **MongoDB Connection Issues**: Ensure MongoDB is running on port 27017
- **Groq API Issues**: Verify your API key is valid and has usage remaining
- **Port 3000 in use**: Kill the process using port 3000 or change the port in package.json
- **Build Issues**: Run `npm run typecheck` to identify TypeScript errors

That's it! The System Design Copilot should now be running locally with full functionality including authentication, AI-powered design assistance, real-time updates, and export capabilities.
