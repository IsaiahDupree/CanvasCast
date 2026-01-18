# PRD: Alignment System (Whisper)

**Subsystem:** Alignment  
**Version:** 1.0  
**Status:** Implemented  
**Owner:** Isaiah  

---

## 1. Overview

The Alignment subsystem extracts word-level timestamps from narration audio using OpenAI Whisper. These timestamps drive caption synchronization and scene transitions in the final video, ensuring cuts happen at natural word boundaries.

### Business Goal
Create perfectly-timed captions and smooth scene transitions that feel professional and don't cut off mid-word.

---

## 2. User Stories

### US-1: Word-Level Captions
**As a** viewer  
**I want** captions that match exactly what's being said  
**So that** the video is accessible and engaging

### US-2: Smooth Scene Transitions
**As a** user  
**I want** scene changes to happen at natural pauses  
**So that** the video doesn't feel choppy

### US-3: Caption Export
**As a** user  
**I want to** download captions as SRT/VTT  
**So that** I can edit them or use on other platforms

---

## 3. Input/Output

### Input
```typescript
interface AlignmentInput {
  audioPath: string;         // Path to narration audio
  expectedText?: string;     // Original script text (for validation)
  language?: string;         // Language code (default: 'en')
}
```

### Output
```typescript
interface AlignmentOutput {
  segments: WordSegment[];
  fullText: string;
  language: string;
  duration: number;          // Total audio duration (seconds)
  srtPath: string;          // Generated SRT file path
  vttPath: string;          // Generated VTT file path
}

interface WordSegment {
  word: string;
  start: number;            // Start time (seconds)
  end: number;              // End time (seconds)
  confidence: number;       // 0-1 confidence score
}
```

---

## 4. Whisper Integration

### API Call
```typescript
async function transcribeWithWhisper(audioPath: string): Promise<WhisperResponse> {
  const audioFile = fs.createReadStream(audioPath);
  
  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularity: ['word'],
    language: 'en',
  });
  
  return response;
}
```

### Response Processing
```typescript
function processWhisperResponse(response: WhisperResponse): WordSegment[] {
  return response.words.map(word => ({
    word: word.word.trim(),
    start: word.start,
    end: word.end,
    confidence: 1.0, // Whisper doesn't provide per-word confidence
  }));
}
```

---

## 5. Functional Requirements

### FR-1: Extract Word Timestamps

**Process:**
1. Receive narration audio path
2. Convert to supported format if needed (WAV 16kHz)
3. Call Whisper API with word-level timestamps
4. Parse and validate response
5. Return structured segments

### FR-2: Generate SRT Captions

**SRT Format:**
```
1
00:00:00,120 --> 00:00:02,340
Stop doing this with your ads

2
00:00:02,500 --> 00:00:05,100
Here's what actually works
```

**Generation:**
```typescript
function generateSRT(segments: WordSegment[], wordsPerLine = 7): string {
  const lines: string[] = [];
  let lineNum = 1;
  let currentWords: WordSegment[] = [];
  
  for (const segment of segments) {
    currentWords.push(segment);
    
    if (currentWords.length >= wordsPerLine || 
        segment.word.match(/[.!?]$/)) {
      const startTime = formatSRTTime(currentWords[0].start);
      const endTime = formatSRTTime(currentWords[currentWords.length - 1].end);
      const text = currentWords.map(w => w.word).join(' ');
      
      lines.push(`${lineNum}`);
      lines.push(`${startTime} --> ${endTime}`);
      lines.push(text);
      lines.push('');
      
      lineNum++;
      currentWords = [];
    }
  }
  
  return lines.join('\n');
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}
```

### FR-3: Generate VTT Captions

**VTT Format:**
```
WEBVTT

00:00.120 --> 00:02.340
Stop doing this with your ads

00:02.500 --> 00:05.100
Here's what actually works
```

**Generation:**
```typescript
function generateVTT(segments: WordSegment[], wordsPerLine = 7): string {
  const lines = ['WEBVTT', ''];
  let currentWords: WordSegment[] = [];
  
  for (const segment of segments) {
    currentWords.push(segment);
    
    if (currentWords.length >= wordsPerLine || 
        segment.word.match(/[.!?]$/)) {
      const startTime = formatVTTTime(currentWords[0].start);
      const endTime = formatVTTTime(currentWords[currentWords.length - 1].end);
      const text = currentWords.map(w => w.word).join(' ');
      
      lines.push(`${startTime} --> ${endTime}`);
      lines.push(text);
      lines.push('');
      
      currentWords = [];
    }
  }
  
  return lines.join('\n');
}
```

### FR-4: Scene Boundary Detection

Find optimal cut points between scenes:

```typescript
interface SceneBoundary {
  startWordIndex: number;
  endWordIndex: number;
  startTime: number;
  endTime: number;
}

function findSceneBoundaries(
  segments: WordSegment[],
  sceneNarrations: string[]
): SceneBoundary[] {
  const boundaries: SceneBoundary[] = [];
  let wordIndex = 0;
  
  for (const narration of sceneNarrations) {
    const words = narration.split(/\s+/);
    const startIndex = wordIndex;
    const endIndex = wordIndex + words.length - 1;
    
    // Adjust to end at sentence/phrase boundary
    const adjustedEnd = findNearestPause(segments, endIndex);
    
    boundaries.push({
      startWordIndex: startIndex,
      endWordIndex: adjustedEnd,
      startTime: segments[startIndex].start,
      endTime: segments[adjustedEnd].end,
    });
    
    wordIndex = adjustedEnd + 1;
  }
  
  return boundaries;
}

function findNearestPause(segments: WordSegment[], index: number): number {
  // Look for punctuation or long gap
  for (let i = index; i < Math.min(index + 3, segments.length); i++) {
    if (segments[i].word.match(/[.!?,]$/)) return i;
    if (i < segments.length - 1 && 
        segments[i + 1].start - segments[i].end > 0.3) return i;
  }
  return index;
}
```

---

## 6. Audio Preprocessing

### Format Requirements
- Format: WAV or MP3
- Sample rate: 16kHz (Whisper optimal)
- Channels: Mono
- Max duration: 25 MB file size

### Conversion
```typescript
async function prepareAudioForWhisper(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.[^.]+$/, '_whisper.wav');
  
  await exec(`ffmpeg -i "${inputPath}" \
    -ar 16000 \
    -ac 1 \
    -sample_fmt s16 \
    "${outputPath}"`);
  
  return outputPath;
}
```

---

## 7. Validation

### Text Matching
Compare transcribed text with expected narration:

```typescript
function validateAlignment(
  segments: WordSegment[],
  expectedText: string
): ValidationResult {
  const transcribed = segments.map(s => s.word).join(' ').toLowerCase();
  const expected = expectedText.toLowerCase().replace(/[^\w\s]/g, '');
  
  // Calculate similarity
  const similarity = calculateLevenshteinSimilarity(transcribed, expected);
  
  return {
    valid: similarity > 0.9,
    similarity,
    transcribed,
    expected,
  };
}
```

### Gap Detection
Flag suspicious gaps in audio:

```typescript
function detectGaps(segments: WordSegment[]): Gap[] {
  const gaps: Gap[] = [];
  
  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap > 2.0) { // More than 2 seconds
      gaps.push({
        afterWord: segments[i - 1].word,
        beforeWord: segments[i].word,
        duration: gap,
        position: segments[i - 1].end,
      });
    }
  }
  
  return gaps;
}
```

---

## 8. Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| Audio too long | >25MB file | Split into chunks |
| Language mismatch | Wrong language detected | Force English |
| Low confidence | Unclear audio | Continue with warning |
| API timeout | Network issues | Retry with backoff |

### Chunked Processing
```typescript
async function processLongAudio(audioPath: string): Promise<WordSegment[]> {
  const segments: WordSegment[] = [];
  const chunks = await splitAudio(audioPath, 300); // 5-minute chunks
  
  let timeOffset = 0;
  for (const chunk of chunks) {
    const chunkSegments = await transcribeWithWhisper(chunk.path);
    
    // Adjust timestamps
    for (const segment of chunkSegments) {
      segments.push({
        ...segment,
        start: segment.start + timeOffset,
        end: segment.end + timeOffset,
      });
    }
    
    timeOffset += chunk.duration;
  }
  
  return segments;
}
```

---

## 9. Configuration

```typescript
const ALIGNMENT_CONFIG = {
  model: 'whisper-1',
  language: 'en',
  
  // Caption formatting
  wordsPerLine: 7,
  maxCharsPerLine: 42,
  
  // Quality thresholds
  minSimilarity: 0.85,
  maxGapSeconds: 3.0,
  
  // Processing
  sampleRate: 16000,
  maxFileSizeMB: 25,
  chunkDurationSeconds: 300,
};
```

---

## 10. Metrics

| Metric | Description |
|--------|-------------|
| `alignment_duration_ms` | Processing time |
| `alignment_word_count` | Words transcribed |
| `alignment_accuracy` | Similarity to expected |
| `alignment_gap_count` | Suspicious gaps found |

---

## 11. Files

| File | Purpose |
|------|---------|
| `apps/worker/src/pipeline/steps/run-alignment.ts` | Main alignment logic |
| `apps/worker/src/lib/whisper.ts` | Whisper API client |
| `apps/worker/src/lib/captions.ts` | SRT/VTT generation |

---

## 12. System Integration

### Communicates With

| Subsystem | Direction | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| **Pipeline** | Pipeline → Alignment | Function call | Trigger alignment |
| **Voice** | Voice → Alignment | Context artifacts | Provide audio file |
| **Script** | Script → Alignment | Context artifacts | Expected text for validation |
| **Render** | Alignment → Render | Context artifacts | Word timestamps for captions |
| **Packaging** | Alignment → Packaging | Context artifacts | SRT/VTT files |
| **OpenAI Whisper** | Alignment → External | HTTP API | Transcription |

### Inbound Interfaces

```typescript
// From Voice (via ctx.artifacts)
const audioPath = ctx.artifacts.narrationPath;

// From Script (for validation)
const expectedText = ctx.artifacts.script.narrationText;

// Pipeline calls alignment
const result = await runAlignment(ctx);
```

### Outbound Interfaces

```typescript
// To Render subsystem (via ctx.artifacts)
ctx.artifacts.whisperSegments = [
  { word: 'Hello', start: 0.0, end: 0.5 },
  { word: 'world', start: 0.6, end: 1.1 },
  // ...
];

// To Packaging subsystem
ctx.artifacts.captionsSrtPath = '/jobs/xxx/captions.srt';
ctx.artifacts.captionsVttPath = '/jobs/xxx/captions.vtt';

// To External Whisper API
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-1',
  response_format: 'verbose_json',
  timestamp_granularity: ['word']
});
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ALIGNMENT SUBSYSTEM                          │
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │    Voice     │────►│   Whisper    │────►│  Generate    │    │
│  │  (audio.mp3) │     │     API      │     │  SRT/VTT     │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│                              │                    │             │
│                              ▼                    ▼             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    ctx.artifacts                          │  │
│  │  whisperSegments: [{ word, start, end }, ...]            │  │
│  │  captionsSrtPath: '/jobs/xxx/captions.srt'               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       ┌───────────┐                   ┌───────────┐
       │  RENDER   │                   │ PACKAGING │
       │ (caption  │                   │ (SRT/VTT  │
       │ timing)   │                   │ files)    │
       └───────────┘                   └───────────┘
```
