# 🎬 Agentic Studio - AI-Powered YouTube Content Agent

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-16.0.3-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2.0-blue" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4.0-blue" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Convex-1.29.1-green" alt="Convex" />
  <img src="https://img.shields.io/badge/Clerk-6.35.1-red" alt="Clerk" />
</div>

<div align="center">
  <h3>Transform your YouTube content with AI-powered analysis, transcription, and creative assistance</h3>
  <p>🚀 Get started in seconds • 🤖 AI-driven insights • 📊 Real-time analytics • 🎨 Creative generation</p>
</div>

---

## ✨ Features

### 🎯 Core Capabilities

- **AI Video Analysis** - Deep insights into content performance and engagement
- **Smart Transcription** - Accurate video transcriptions with timestamps
- **Thumbnail Generation** - AI-powered eye-catching thumbnail creation
- **Title Generation** - SEO-optimized, attention-grabbing title suggestions
- **Script Generation** - Step-by-step shooting scripts for content recreation
- **AI Agent Chat** - Interactive conversations about your content strategy

### 🔧 Technical Features

- **Real-time Updates** - Live polling for instant results
- **Feature Flags** - Granular control over available features
- **Usage Tracking** - Token-based consumption monitoring
- **Responsive Design** - Works seamlessly on all devices
- **Dark/Light Mode** - Theme switching support

### 🤖 AI Integration

- **Google Gemini 2.0 Flash** - Advanced language model for content analysis
- **OpenAI DALL-E** - High-quality image generation
- **YouTube Data API** - Comprehensive video metadata extraction
- **Clerk Authentication** - Secure user management

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Convex account
- Clerk account
- Google Cloud Console (for YouTube API)
- OpenAI API key

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/agenticstudio.git
   cd agenticstudio
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.local.example .env.local
   ```

   Configure the following in `.env.local`:

   ```env
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   CLERK_ISSUE_URL=https://your-domain.clerk.accounts.dev

   # Convex Database
   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   CONVEX_DEPLOYMENT=dev:your-deployment

   # AI APIs
   GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
   OPENAI_API_KEY=sk-proj-...
   GEMINI_API_KEY=AIzaSy...
   GEMINI_API_KEY_IMG=AIzaSy...

   # YouTube API
   YOUTUBE_API_KEY=AIzaSy...

   # Feature Flags (Optional)
   NEXT_PUBLIC_SCHEMATIC_PUBLISHABLE_KEY=api_...
   SCHEMATIC_API_KEY=sch_dev_...
   ```

4. **Set up Convex**

   ```bash
   npx convex dev
   ```

5. **Run the development server**

   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

---

## 📁 Project Structure

```
agenticstudio/
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

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Radix UI + Custom components
- **State Management**: React hooks + Convex
- **Authentication**: Clerk

### Backend

- **Database**: Convex (serverless)
- **Real-time**: Convex subscriptions
- **Authentication**: Clerk
- **File Storage**: Convex file storage

### AI & APIs

- **Language Models**: Google Gemini 2.0 Flash
- **Image Generation**: OpenAI DALL-E
- **Video Data**: YouTube Data API v3
- **Feature Flags**: Schematic

### DevOps

- **Deployment**: Vercel
- **Linting**: ESLint
- **Package Manager**: npm

---

## 🔧 Configuration

### Environment Variables

| Variable                            | Description          | Required |
| ----------------------------------- | -------------------- | -------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk authentication | ✅       |
| `CLERK_SECRET_KEY`                  | Clerk server key     | ✅       |
| `NEXT_PUBLIC_CONVEX_URL`            | Convex database URL  | ✅       |
| `GOOGLE_GENERATIVE_AI_API_KEY`      | Gemini API key       | ✅       |
| `OPENAI_API_KEY`                    | OpenAI API key       | ✅       |
| `YOUTUBE_API_KEY`                   | YouTube Data API key | ✅       |
| `SCHEMATIC_API_KEY`                 | Feature flags        | ❌       |

### Feature Flags

Control available features using Schematic:

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

### Vercel Deployment

1. **Connect your repository**

   ```bash
   npx vercel
   ```

2. **Set environment variables** in Vercel dashboard

3. **Deploy Convex**

   ```bash
   npx convex deploy --prod
   ```

4. **Deploy to production**
   ```bash
   npx vercel --prod
   ```

### Convex Deployment

```bash
# Development
npx convex dev

# Production
npx convex deploy --prod
```

---

## 📊 Usage & Analytics

### Token System

- **Video Analysis**: 1 token per video
- **Title Generation**: 1 token per title
- **Thumbnail Generation**: 1 token per image
- **Transcription**: 1 token per video
- **AI Chat**: Variable based on conversation length

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

- **Next.js** - The React framework
- **Convex** - Serverless database
- **Clerk** - Authentication platform
- **Google AI** - Gemini models
- **OpenAI** - DALL-E image generation
- **Vercel** - Deployment platform

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/agenticstudio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/agenticstudio/discussions)
- **Email**: support@agenticstudio.com

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
#   A g e n t i c s t u d i o  
 