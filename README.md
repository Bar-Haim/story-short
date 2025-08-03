# StoryShort - AI-Powered Video Generation MVP

StoryShort is a Next.js 15 application that demonstrates an AI-powered video generation interface. Users can input their stories through a textarea and generate videos with a simulated progress indicator.

## Features

- **Modern UI**: Beautiful, responsive design with dark mode support
- **Story Input**: Large textarea for entering story content
- **Generate Button**: Interactive button that simulates video generation
- **Progress Indicator**: Real-time progress bar with status messages
- **AI Script Generation**: OpenAI-powered script creation with hook, body, and CTA sections
- **Text-to-Speech**: ElevenLabs-powered voice generation for scripts
- **Background Image Generation**: OpenRouter-powered image creation for video backgrounds
- **Database Integration**: Supabase for storing video requests and tracking status
- **TypeScript**: Full TypeScript support for better development experience
- **Tailwind CSS**: Modern styling with utility-first CSS framework

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key
- ElevenLabs API key
- OpenRouter API key
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd storyshort
```

2. Install dependencies:
```bash
npm install
```

3. Set up Supabase:
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Settings → API to get your project URL and anon key
   - Run the SQL schema in the SQL Editor:
   ```sql
   -- Copy and paste the contents of supabase-schema.sql
   ```

4. Set up environment variables:
```bash
# Create a .env.local file in the root directory
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env.local
echo "ELEVENLABS_API_KEY=your_elevenlabs_api_key_here" >> .env.local
echo "OPENROUTER_API_KEY=your_openrouter_api_key_here" >> .env.local
echo "NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url" >> .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key" >> .env.local
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Database Schema

### Videos Table
```sql
CREATE TABLE videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'script_generated', 'rendering', 'completed', 'failed')),
  input_text TEXT NOT NULL,
  script JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Status Flow
1. **pending**: Initial state when video request is created
2. **script_generated**: Script has been successfully generated
3. **rendering**: Video is being rendered (future feature)
4. **completed**: Video generation is complete (future feature)
5. **failed**: An error occurred during processing

## API Routes

### POST /api/generate-script

Generates a 40-second video script using OpenAI's GPT-4 model and stores it in Supabase.

**Request Body:**
```json
{
  "userText": "Your story or content here"
}
```

**Response:**
```json
{
  "success": true,
  "videoId": "uuid-of-created-video",
  "script": {
    "hook": "Attention-grabbing opening",
    "body": "Main story content",
    "cta": "Call to action"
  },
  "rawScript": "Complete generated script",
  "characterCount": 450
}
```

**Features:**
- Creates video record in Supabase with 'pending' status
- Summarizes long inputs to meet 40-second limit
- Updates status to 'script_generated' on success
- Updates status to 'failed' on error

### POST /api/generate-voice

Converts text to speech using ElevenLabs TTS API.

**Request Body:**
```json
{
  "text": "The script text to convert to speech"
}
```

**Response:**
- **Success**: Audio file (audio/mpeg)
- **Error**: JSON error response

### POST /api/generate-image

Generates background images using OpenRouter's DALL-E 3 integration.

**Request Body:**
```json
{
  "text": "The script text to base the image on",
  "style": "cinematic",
  "sceneType": "background"
}
```

**Response:**
- **Success**: Image file (image/png)
- **Error**: JSON error response

## Project Structure

```
storyshort/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main application page
│   │   ├── layout.tsx            # Root layout component
│   │   ├── globals.css           # Global styles
│   │   └── api/
│   │       ├── generate-script/
│   │       │   └── route.ts      # Script generation API
│   │       ├── generate-voice/
│   │       │   └── route.ts      # Voice generation API
│   │       └── generate-image/
│   │           └── route.ts      # Image generation API
│   └── lib/
│       └── supabase.ts           # Supabase client configuration
├── public/                       # Static assets
├── supabase-schema.sql           # Database schema
├── package.json                  # Dependencies and scripts
└── README.md                     # This file
```

## Usage

1. **Enter Your Story**: Type or paste your story content into the large textarea
2. **Generate Video**: Click the "Generate Video" button to start the process
3. **Monitor Progress**: Watch the progress bar and status messages as the video generates
4. **View Result**: Once complete, the video generation simulation will finish

## Technology Stack

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **React Hooks**: State management with useState
- **OpenAI API**: GPT-4 for script generation
- **ElevenLabs API**: Text-to-speech conversion
- **OpenRouter API**: DALL-E 3 for image generation
- **Supabase**: Database and backend services

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Environment Variables

Create a `.env.local` file in the root directory with:

```
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can get API keys from:
- OpenAI: https://platform.openai.com/api-keys
- ElevenLabs: https://elevenlabs.io/
- OpenRouter: https://openrouter.ai/
- Supabase: https://supabase.com/

### Database Setup

1. Create a new Supabase project
2. Run the SQL commands from `supabase-schema.sql` in the SQL Editor
3. Copy your project URL and anon key to `.env.local`

### Customization

The application is designed to be easily customizable:

- **Styling**: Modify Tailwind classes in `src/app/page.tsx`
- **Functionality**: Add real AI video generation API calls in the `handleGenerate` function
- **Progress Simulation**: Adjust the progress timing in the interval logic
- **Script Generation**: Modify the prompt in `/api/generate-script/route.ts`
- **Voice Generation**: Change voice settings in `/api/generate-voice/route.ts`
- **Image Generation**: Adjust image prompts and styles in `/api/generate-image/route.ts`
- **Database**: Modify the schema in `supabase-schema.sql`

## Future Enhancements

- Integration with real AI video generation APIs
- User authentication and video history
- Multiple video format options
- Advanced story editing features
- Video preview and download functionality
- Multiple voice options and customization
- Video rendering with generated scripts, voiceovers, and backgrounds
- Custom image style presets
- Batch image generation for different scenes
- Real-time status updates via Supabase subscriptions

## License

This project is open source and available under the [MIT License](LICENSE).
