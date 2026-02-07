# Image Generation Providers

This document explains how to configure and use different AI image generation providers in Prompt Guessr.

## Overview

The game supports multiple image generation providers through an abstract `ImageProvider` interface. This allows you to easily swap providers or set up fallback strategies.

## Available Providers

### 1. MockImageProvider (Default)
- **Cost**: Free
- **Speed**: Instant (~0.5-1.5s simulated delay)
- **Quality**: Placeholder images from picsum.photos
- **Use case**: Development and testing

**No setup required** - this is the default provider.

---

### 2. HuggingFaceProvider
- **Cost**: FREE tier available (rate-limited)
- **Speed**: 5-15 seconds per image
- **Quality**: High (Stable Diffusion XL)
- **Use case**: MVP testing, free production start

**Setup:**
1. Create account at [Hugging Face](https://huggingface.co/join)
2. Generate access token at [Settings → Tokens](https://huggingface.co/settings/tokens)
3. Add to `.env`:
   ```
   HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
   ```

**Rate Limits (Free Tier):**
- ~5-10 requests per minute
- May queue during high load
- Automatically retries when model is loading

---

### 3. OpenAIProvider
- **Cost**: Paid (~$0.016-$0.020 per image)
- **Speed**: Fast (~10 seconds per image)
- **Quality**: Very good (DALL-E 2/3)
- **Use case**: Reliable fallback, production

**Setup:**
1. Create account at [OpenAI](https://platform.openai.com/signup)
2. Add credits to your account
3. Generate API key at [API Keys](https://platform.openai.com/api-keys)
4. Add to `.env`:
   ```
   OPENAI_API_KEY=sk-xxxxxxxxxxxxx
   ```

**Models:**
- `dall-e-2`: Cheaper, batch generation (recommended)
- `dall-e-3`: Higher quality, slower, one at a time

**Pricing (DALL-E 2):**
- 512×512: $0.018 per image
- Typical game (48 images): ~$0.86

---

---

## Configuration

The image service is configured via environment variables in `.env`:

```env
# Which provider to use as primary (mock, huggingface, openai)
IMAGE_PROVIDER=mock

# Enable automatic fallback to another provider if primary fails
ENABLE_FALLBACK=false

# Which provider to use as fallback (huggingface, openai)
FALLBACK_PROVIDER=openai

# API Keys
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
OPENAI_API_KEY=sk_xxxxxxxxxxxxx
```

### Configuration Examples

#### Development (Default - Mock Images)

No setup needed! Just run:
```bash
npm run dev
```

Default: `IMAGE_PROVIDER=mock` with no fallback.

---

#### Production Option 1: HuggingFace Only (Free)
```env
IMAGE_PROVIDER=huggingface
ENABLE_FALLBACK=false
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
```

Use this for testing AI generation without costs.

---

#### Production Option 2: OpenAI Only (Paid, Reliable)
```env
IMAGE_PROVIDER=openai
ENABLE_FALLBACK=false
OPENAI_API_KEY=sk_xxxxxxxxxxxxx
```

Use this for guaranteed reliability if budget allows.

---

#### Production Option 3: Fallback Strategy (Recommended)
```env
IMAGE_PROVIDER=huggingface
ENABLE_FALLBACK=true
FALLBACK_PROVIDER=openai
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
OPENAI_API_KEY=sk_xxxxxxxxxxxxx
```

**How it works:**
1. Attempts HuggingFace first (free)
2. If rate limited or fails, automatically falls back to OpenAI
3. Logs which provider succeeded

This gives you the best of both worlds: free when possible, reliable when needed.

---

#### Alternative Fallback: OpenAI → HuggingFace
```env
IMAGE_PROVIDER=openai
ENABLE_FALLBACK=true
FALLBACK_PROVIDER=huggingface
OPENAI_API_KEY=sk_xxxxxxxxxxxxx
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
```

Use this if you want OpenAI quality by default but have HuggingFace as a free backup.

---

## Testing the Setup

### 1. Start the server
```bash
cd prompt-guessr-backend
npm run dev
```

### 2. Check logs
You should see:
```
✨ Image service initialized
```

And during image generation, you'll see logs like:
```
[INFO] Initializing image service with provider: huggingface
[INFO] Fallback enabled: openai
```

### 3. Play a test game
- Create a room
- Submit a prompt
- Watch the server logs to see which provider is used

Example log output:
```
[INFO] Attempting image generation with huggingface
[INFO] Successfully generated 4 images with huggingface
```

Or if fallback triggered:
```
[INFO] Attempting image generation with huggingface
[WARN] Provider huggingface failed: Rate limit exceeded
[INFO] Attempting image generation with openai
[INFO] Successfully generated 4 images with openai
```

---

## Advanced Usage

### Manually Setting a Provider (for testing)

In code, you can override the environment-configured provider:

```typescript
import { 
  setImageProvider, 
  HuggingFaceProvider,
  OpenAIProvider
} from './services/image-service';

// Use only HuggingFace (ignores env config)
setImageProvider(new HuggingFaceProvider());

// Use only OpenAI with DALL-E 3
setImageProvider(new OpenAIProvider(undefined, 'dall-e-3', '1024x1024'));
```

**Note**: Fallback logic is now handled automatically by the image service based on `ENABLE_FALLBACK` env var. You don't need to create a fallback provider manually.
```

### Creating a Custom Provider

Implement the `ImageProvider` interface:

```typescript
export class MyCustomProvider implements ImageProvider {
  async generateImages(
    prompt: string,
    count: number,
    playerId: string
  ): Promise<GeneratedImage[]> {
    // Your implementation
  }

  getProviderName(): string {
    return 'my-custom-provider';
  }
}

// Use it
setImageProvider(new MyCustomProvider());
```

---

## Cost & Performance Comparison

| Provider | Cost/Game* | Speed | Quality | Reliability |
|----------|-----------|-------|---------|-------------|
| Mock | $0 | Instant | ⭐ | ⭐⭐⭐⭐⭐ |
| HuggingFace | $0 | 5-15s | ⭐⭐⭐⭐ | ⭐⭐⭐ (rate limits) |
| OpenAI (DALL-E 2) | $0.86 | ~10s | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| OpenAI (DALL-E 3) | $3.84 | ~15s | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Fallback Strategy** | $0-$0.86 | Varies | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Fallback requires `ENABLE_FALLBACK=true` in .env

*Assumes 4 players × 3 rounds × 4 images = 48 images per game

---

## Troubleshooting

### "All image providers failed"
- Check your API keys in `.env`
- Verify API keys are valid (test in provider dashboards)
- Check if you have credits (OpenAI) or quota (HuggingFace)

### "Rate limit exceeded" (HuggingFace)
- Normal on free tier
- Should automatically fall back to OpenAI if configured
- Consider upgrading to HuggingFace Pro ($9/month, higher limits)

### Images not displaying
- Check browser console for CORS errors
- HuggingFace returns base64 data URLs (no CORS issues)
- OpenAI returns temporary URLs (valid for 1 hour)
- For production, upload to S3/R2 and use permanent URLs

### Slow generation
- Normal! AI image generation takes 5-20 seconds
- HuggingFace: First request may be slow (model loading)
- Consider pre-generating images if prompts are known
- Use DALL-E 2 instead of DALL-E 3 for batching

---

## Future Enhancements

Planned improvements:
- [ ] Upload images to S3/R2 for permanent storage
- [ ] Add Replicate provider (cheaper than OpenAI)
- [ ] Add Stability.ai provider
- [ ] Retry logic with exponential backoff
- [ ] Image quality/resolution selection
- [ ] Caching for identical prompts
- [ ] Admin dashboard to monitor provider usage/costs

---

## Questions?

Check the main README or open an issue!
