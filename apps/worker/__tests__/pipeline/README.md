# Pipeline Step Tests

This directory contains unit tests for all pipeline steps with mocked external APIs.

## Test Coverage

Each pipeline step has comprehensive tests covering:

### 1. Script Generation (`generate-script.test.ts`)
- ✅ Successfully generates script from merged input text
- ✅ Handles missing input text
- ✅ Handles OpenAI API errors
- ✅ Validates response format
- ✅ Calculates estimated duration
- ✅ Incorporates niche preset into prompts

**External Dependencies Mocked:**
- OpenAI GPT-4 API
- Supabase Storage
- Database insertions

### 2. Voice Generation (`generate-voice.test.ts`)
- ✅ Generates TTS audio for all script sections
- ✅ Handles missing script
- ✅ Supports idempotency (skips if audio exists)
- ✅ Handles TTS API errors
- ✅ Calculates total duration
- ✅ Updates context artifacts
- ✅ Respects voice selection from environment

**External Dependencies Mocked:**
- OpenAI TTS API
- FFmpeg (for audio merging)
- File system operations
- Supabase Storage

### 3. Alignment (`run-alignment.test.ts`)
- ✅ Transcribes audio with Whisper
- ✅ Generates word-level timestamps
- ✅ Creates SRT/VTT caption files
- ✅ Handles missing narration
- ✅ Supports idempotency
- ✅ Handles Whisper API errors
- ✅ Updates context with segments and words
- ✅ Supports mock mode for testing
- ✅ Handles audio download errors

**External Dependencies Mocked:**
- OpenAI Whisper API
- Groq Whisper API (fallback)
- File system operations
- Supabase Storage

### 4. Visual Planning (`plan-visuals.test.ts`)
- ✅ Creates visual plan with time-based slots
- ✅ Handles missing script
- ✅ Handles missing Whisper segments
- ✅ Respects image density settings (low/normal/high)
- ✅ Creates proper time ranges for slots
- ✅ Generates image prompts
- ✅ Incorporates visual keywords from script
- ✅ Applies visual presets (photorealistic, cinematic, etc.)
- ✅ Updates context artifacts
- ✅ Groups segments by cadence

**External Dependencies Mocked:**
- Supabase Storage
- Database insertions

**Status:** ✅ All 14 tests passing

### 5. Image Generation (`generate-images.test.ts`)
- ✅ Generates images for all visual slots
- ✅ Handles missing visual plan
- ✅ Processes images in batches (rate limiting)
- ✅ Implements retry logic
- ✅ Handles max retries exceeded
- ✅ Updates context artifacts
- ✅ Supports OpenAI DALL-E
- ✅ Supports Google Gemini Imagen
- ✅ Includes proper metadata in prompts
- ✅ Handles API errors

**External Dependencies Mocked:**
- OpenAI DALL-E API
- Google Gemini Imagen API
- Supabase Storage
- Database insertions

## Running Tests

```bash
# Run all pipeline tests
pnpm test apps/worker/__tests__/pipeline

# Run individual test files
pnpm test apps/worker/__tests__/pipeline/generate-script.test.ts
pnpm test apps/worker/__tests__/pipeline/generate-voice.test.ts
pnpm test apps/worker/__tests__/pipeline/run-alignment.test.ts
pnpm test apps/worker/__tests__/pipeline/plan-visuals.test.ts
pnpm test apps/worker/__tests__/pipeline/generate-images.test.ts
```

## Test Patterns

All tests follow the same structure:

1. **Setup**: Mock external dependencies (APIs, storage, DB)
2. **Arrange**: Create pipeline context with required artifacts
3. **Act**: Call the pipeline step function
4. **Assert**: Verify success/failure and side effects

## Mocking Strategy

- **OpenAI APIs**: Mocked to avoid API costs and ensure deterministic tests
- **File System**: Mocked to avoid disk I/O
- **Supabase**: Mocked to avoid database dependencies
- **External APIs**: All external calls are mocked

## Success Criteria

Each test verifies:
- ✅ Correct return type (`StepResult<T>`)
- ✅ Success/error handling
- ✅ Context artifact updates
- ✅ External API call parameters
- ✅ Error messages for debugging
- ✅ Idempotency where applicable

## Notes

- Tests use Vitest for fast execution
- All external APIs are mocked to ensure tests run without API keys
- Tests cover both happy path and error scenarios
- Idempotency tests ensure steps can be safely retried
