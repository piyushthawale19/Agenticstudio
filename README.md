# 🎬 Agentic Studio – AI-Powered YouTube Content Agent

<br />

<div align="center">

<img src="https://img.shields.io/badge/Next.js-16.0.3-black" />
<img src="https://img.shields.io/badge/React-19.2.0-blue" />
<img src="https://img.shields.io/badge/TypeScript-5.0-blue" />
<img src="https://img.shields.io/badge/TailwindCSS-4.0-blue" />
<img src="https://img.shields.io/badge/Convex-1.29.1-green" />
<img src="https://img.shields.io/badge/Clerk-6.35.1-red" />

</div>

<br />

<p align="center">
  <img width="1000" src="https://raw.githubusercontent.com/piyushthawale19/Agenticstudio/main/banner.png" alt="Agentic Studio Banner"/>
</p>

<div align="center">
  <h3>Transform your YouTube content with AI-powered analysis, transcription & creative tools</h3>
  <p>🚀 Publish better videos • 🤖 AI insights • 📊 Real-time analytics • 🎨 AI thumbnails & scripts</p>
  <br />
  <a href="#🚀-quick-start"><b>⚡ Get Started</b></a> •
  <a href="#✨-features"><b>✨ Features</b></a> •
  <a href="#🎨-tech-stack"><b>🛠️ Tech Stack</b></a> •
  <a href="#🤝-contributing"><b>🤝 Contributing</b></a>
</div>

---

## ✨ Features

### 🎯 Core Capabilities
- 🔍 **AI Video Analysis** — Understand performance, hooks, retention
- 🗣️ **Smart Transcription** — Auto timestamps + export
- 🎨 **Thumbnail Generator** — AI thumbnails with prompts
- 🧠 **SEO Title Generator** — Viral + CTR-optimized titles
- 🎥 **Script Builder** — Step-by-step YouTube script
- 🤖 **AI Content Agent** — Ask strategies, optimization, ideas

---

### 🔧 Technical Features
- ⚡ Real-Time Updates (Convex Subscriptions)
- 💠 Feature Flags (Schematic)
- 🪙 Usage Tokens Per Action
- 🌓 Dark / Light Mode
- 📱 Fully Responsive
- 🔐 Secure Auth via Clerk
- ☁️ Convex Storage (Images & transcripts)

---

### 🤖 AI Integrations
- **Google Gemini (configurable)**
- **OpenAI DALL·E**
- **YouTube Data API**
- **Clerk Authentication**

---

## 🖼️ UI Preview

> 📌 Replace these images later with real screenshots.

<p align="center">
  <img width="750" src="https://via.placeholder.com/750x400.png?text=Agentic+Studio+Dashboard" alt="Dashboard placeholder"/>
  <br /><br />
  <img width="750" src="https://via.placeholder.com/750x400.png?text=Video+Analysis+Report" alt="Report placeholder"/>
</p>

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Convex account
- Clerk account
- API keys for the AI providers you intend to use (Gemini / OpenAI)
- Google Cloud Console project with YouTube Data API enabled

---

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/piyushthawale19/Agenticstudio.git
   cd Agenticstudio
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Set up environment variables

   ```bash
   cp .env.local.example .env.local
   ```

   Configure the following in `.env.local` (replace placeholders with your own keys — never commit secret keys):

   ```env
   # Clerk (authentication)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_CLERK_ISSUER_BASE_URL=https://your-clerk-domain.clerk.dev

   # Convex
   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   CONVEX_DEPLOYMENT=dev:your-deployment

   # Google / Gemini
   GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key

   # OpenAI (if used)
   OPENAI_API_KEY=sk-...

   # YouTube API
   YOUTUBE_API_KEY=your-youtube-api-key

   # Optional feature flags / services
   NEXT_PUBLIC_SCHEMATIC_PUBLISHABLE_KEY=schematic_key_here
   SCHEMATIC_API_KEY=schematic_server_key_here
   ```

   Notes:
   - Keep secret keys out of source control.
   - Use environment-specific secrets for production.

4. Set up and run Convex locally (if developing with Convex)

   ```bash
   npx convex dev
   ```

5. Run the development server

   ```bash
   npm run dev
   ```

6. Open http://localhost:3000

---

## 📁 Project Structure

```
Agenticstudio/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   ├── video/[videoId]/          # Dynamic video analysis pages
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Homepage
├── components/                   # React components
│   ├── ui/                       # Reusable UI components
│   ├── AiAgentChat.tsx           # AI chat interface
│   ├── ThumbnailGeneration.tsx   # Thumbnail creation
│   ├── TitleGeneration.tsx       # Title suggestions
│   ├── Transcription.tsx         # Video transcription
│   └── YoutubeVideoForm.tsx      # Video URL input
├── actions/                      # Server actions
│   ├── analyseYoutubeVideo.ts    # Video analysis logic
│   ├── createOrGetVideo.ts       # Video management
│   └── geminiImageGeneration.ts  # AI image generation
├── convex/                       # Convex backend
│   ├── schema.ts                 # Database schema
│   ├── videos.ts                 # Video operations
│   ├── titles.ts                 # Title management
│   ├── images.ts                 # Image storage
│   └── transcript.ts             # Transcription data
├── features/                     # Feature flags
├── lib/                          # Utility functions
└── types/                        # TypeScript definitions
```

---

## 🎨 Tech Stack

### Frontend
- Framework: Next.js 16 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- UI Components: Radix UI + Custom components
- State Management: React hooks + Convex
- Authentication: Clerk

### Backend
- Database: Convex (serverless)
- Real-time: Convex subscriptions
- File Storage: Convex file storage

### AI & APIs
- Language Models: Google Gemini (configurable)
- Image Generation: OpenAI DALL·E
- Video Data: YouTube Data API v3

### DevOps
- Deployment: Vercel
- Linting: ESLint
- Package Manager: npm

---

## 🔧 Configuration

### Environment Variables (summary)

| Variable                            | Description                          | Required |
| ----------------------------------- | ------------------------------------ | -------- |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   | Clerk publishable key (client-side)  | ✅       |
| CLERK_SECRET_KEY                    | Clerk secret key (server-side)       | ✅       |
| NEXT_PUBLIC_CONVEX_URL              | Convex deployment URL                | ✅       |
| GOOGLE_GENERATIVE_AI_API_KEY        | Gemini / Google AI API key           | ✅       |
| OPENAI_API_KEY                      | OpenAI API key (if used)             | ❌*      |
| YOUTUBE_API_KEY                     | YouTube Data API key                 | ✅       |
| SCHEMATIC_API_KEY                   | Feature flag service (optional)      | ❌       |

\* OPENAI_API_KEY is optional if you only use Google Gemini.

### Feature Flags

Control available features using Schematic (example):

```typescript
enum FeatureFlag {
  TRANSCRIPTION = "transcription",
  IMAGE_GENERATION = "image-generation",
  ANALYSE_VIDEO = "analysis-video",
  TITLE_GENERATIONS = "title-generations",
  SCRIPT_GENERATION = "script-generation",
}
```

---

## 🚀 Deployment

### Vercel
1. Connect your repository to Vercel.
2. Set environment variables in the Vercel dashboard.
3. Deploy Convex to production:

```bash
npx convex deploy --prod
```

4. Deploy to production on Vercel:

```bash
npx vercel --prod
```

### Convex
```bash
# Development
npx convex dev

# Production
npx convex deploy --prod
```

---

## 📊 Usage & Analytics

### Token System (example)
- Video Analysis: 1 token per video
- Title Generation: 1 token per title
- Thumbnail Generation: 1 token per image
- Transcription: 1 token per video
- AI Chat: Variable based on conversation length

### Real-time Monitoring
- Live token consumption tracking
- Feature usage analytics
- Performance metrics

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Use TypeScript for all new code
- Follow ESLint configuration
- Write meaningful commit messages
- Test features thoroughly
- Update documentation

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Next.js - The React framework
- Convex - Serverless database
- Clerk - Authentication platform
- Google AI - Gemini models
- OpenAI - DALL·E image generation
- Vercel - Deployment platform

---

## 📞 Support

- Issues: https://github.com/piyushthawale19/Agenticstudio/issues
- Discussions: https://github.com/piyushthawale19/Agenticstudio/discussions
- Email: support@agenticstudio.com

---

<div align="center">
  <p>Built with ❤️ using Next.js, Convex, and AI</p>
  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#deployment">Deployment</a> •
    <a href="#contributing">Contributing</a>
  </p>
</div>
