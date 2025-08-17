# StoryShort Deployment Guide

This guide covers deploying StoryShort to production environments, with a focus on Vercel deployment and handling FFmpeg requirements.

## 🚀 Quick Deployment (Vercel)

### Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Supabase Project**: Set up your Supabase project
4. **OpenAI API Key**: Get your API key from OpenAI

### Step 1: Prepare Your Repository

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial StoryShort deployment"
   git push origin main
   ```

2. **Verify Files**:
   - `vercel.json` (Vercel configuration)
   - `package.json` (Dependencies)
   - `.env.local` (Local environment variables - don't commit this)

### Step 2: Deploy to Vercel

1. **Connect Repository**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

3. **Set Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Deploy**: Click "Deploy"

### Step 3: Post-Deployment Setup

1. **Verify Deployment**:
   - Check that your app is accessible
   - Test basic functionality

2. **Set up Custom Domain** (optional):
   - Go to Project Settings → Domains
   - Add your custom domain

## 🔧 FFmpeg Deployment Options

### Option 1: External Rendering Service (Recommended)

For production, use an external rendering service instead of FFmpeg on Vercel:

1. **Cloud Rendering Services**:
   - **Render**: [render.com](https://render.com)
   - **Railway**: [railway.app](https://railway.app)
   - **DigitalOcean App Platform**: [digitalocean.com](https://digitalocean.com)

2. **Implementation**:
   ```javascript
   // Modify render-video API to use external service
   const renderResponse = await fetch('https://your-render-service.com/render', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ videoId, assets })
   });
   ```

### Option 2: Supabase Edge Functions

Use Supabase Edge Functions for video rendering:

1. **Create Edge Function**:
   ```bash
   supabase functions new render-video
   ```

2. **Deploy Function**:
   ```bash
   supabase functions deploy render-video
   ```

3. **Update API Route**:
   ```javascript
   // Call Supabase Edge Function instead of local FFmpeg
   const { data, error } = await supabase.functions.invoke('render-video', {
     body: { videoId, assets }
   });
   ```

### Option 3: Background Job Queue

Implement a job queue system:

1. **Use Bull/BullMQ**:
   ```bash
   npm install bull
   ```

2. **Set up Redis** (on Railway, Upstash, etc.)

3. **Create Job Processor**:
   ```javascript
   const Queue = require('bull');
   const videoQueue = new Queue('video-rendering', process.env.REDIS_URL);

   videoQueue.process(async (job) => {
     const { videoId } = job.data;
     // FFmpeg processing here
   });
   ```

## 🌐 Alternative Deployment Platforms

### Railway Deployment

1. **Connect Repository**:
   - Go to [railway.app](https://railway.app)
   - Connect your GitHub repository

2. **Environment Variables**:
   - Add all required environment variables
   - Railway supports FFmpeg out of the box

3. **Deploy**:
   - Railway will automatically detect Next.js
   - Deploy with `railway up`

### DigitalOcean App Platform

1. **Create App**:
   - Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
   - Create new App Platform app

2. **Configure**:
   - Connect GitHub repository
   - Set environment variables
   - Choose plan with FFmpeg support

3. **Deploy**:
   - DigitalOcean handles the deployment

### Self-Hosted (Docker)

1. **Create Dockerfile**:
   ```dockerfile
   FROM node:18-alpine
   
   # Install FFmpeg
   RUN apk add --no-cache ffmpeg
   
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   
   COPY . .
   RUN npm run build
   
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Docker Compose**:
   ```yaml
   version: '3.8'
   services:
     storyshort:
       build: .
       ports:
         - "4000:4000"
       environment:
         - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
         - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
         - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
         - OPENAI_API_KEY=${OPENAI_API_KEY}
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

## 🔒 Security Considerations

### Environment Variables

1. **Never Commit Secrets**:
   - Add `.env.local` to `.gitignore`
   - Use platform-specific secret management

2. **Vercel Secrets**:
   ```bash
   vercel env add OPENAI_API_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   ```

3. **Supabase RLS**:
   - Enable Row Level Security
   - Configure proper policies
   - Use service role key only on server

### API Security

1. **Rate Limiting**:
   ```javascript
   import rateLimit from 'express-rate-limit';
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });
   ```

2. **CORS Configuration**:
   ```javascript
   // next.config.js
   module.exports = {
     async headers() {
       return [
         {
           source: '/api/:path*',
           headers: [
             { key: 'Access-Control-Allow-Origin', value: '*' },
             { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
           ],
         },
       ];
     },
   };
   ```

## 📊 Monitoring & Analytics

### Vercel Analytics

1. **Enable Analytics**:
   - Go to Project Settings → Analytics
   - Enable Web Analytics

2. **Custom Events**:
   ```javascript
   import { track } from '@vercel/analytics';
   
   track('video_generated', { videoId, duration });
   ```

### Error Monitoring

1. **Sentry Integration**:
   ```bash
   npm install @sentry/nextjs
   ```

2. **Configure Sentry**:
   ```javascript
   // sentry.client.config.js
   import * as Sentry from '@sentry/nextjs';
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     tracesSampleRate: 1.0,
   });
   ```

## 🔧 Performance Optimization

### Image Optimization

1. **Next.js Image Component**:
   ```javascript
   import Image from 'next/image';
   
   <Image
     src={imageUrl}
     alt="Scene"
     width={1080}
     height={1920}
     priority
   />
   ```

2. **CDN Configuration**:
   - Use Supabase CDN for assets
   - Configure proper cache headers

### Caching Strategy

1. **API Response Caching**:
   ```javascript
   // Cache generated assets
   export async function GET(request) {
     const response = await generateAssets();
     
     return new Response(JSON.stringify(response), {
       headers: {
         'Cache-Control': 'public, max-age=3600',
       },
     });
   }
   ```

2. **Static Generation**:
   ```javascript
   // Generate static pages where possible
   export async function generateStaticParams() {
     return [
       { id: '1' },
       { id: '2' },
     ];
   }
   ```

## 🚨 Troubleshooting

### Common Issues

1. **FFmpeg Not Found**:
   ```bash
   # Check if FFmpeg is installed
   ffmpeg -version
   
   # Install if missing
   # Windows: choco install ffmpeg
   # macOS: brew install ffmpeg
   # Linux: sudo apt install ffmpeg
   ```

2. **Environment Variables**:
   ```bash
   # Verify environment variables
   vercel env ls
   
   # Add missing variables
   vercel env add VARIABLE_NAME
   ```

3. **Build Failures**:
   ```bash
   # Check build logs
   vercel logs
   
   # Test locally
   npm run build
   ```

### Performance Issues

1. **Function Timeouts**:
   - Increase `maxDuration` in `vercel.json`
   - Use background jobs for long-running tasks

2. **Memory Issues**:
   - Optimize image processing
   - Implement streaming for large files

3. **Cold Starts**:
   - Use edge functions where possible
   - Implement proper caching

## 📈 Scaling Considerations

### Horizontal Scaling

1. **Load Balancing**:
   - Use multiple instances
   - Implement proper session management

2. **Database Scaling**:
   - Supabase handles scaling automatically
   - Monitor connection limits

### Cost Optimization

1. **Function Optimization**:
   - Minimize execution time
   - Use appropriate memory limits

2. **Storage Optimization**:
   - Implement file cleanup
   - Use compression where possible

3. **API Usage**:
   - Cache API responses
   - Implement usage limits

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

### Automated Testing

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

## 📞 Support

### Getting Help

1. **Documentation**: Check this guide and README.md
2. **GitHub Issues**: Report bugs and feature requests
3. **Community**: Join our Discord server
4. **Email**: Contact support team

### Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

---

*This deployment guide is updated regularly. For the latest information, check the repository.* 