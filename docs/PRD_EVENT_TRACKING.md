# PRD: Event Tracking System for CanvasCast

**Status:** Active  
**Created:** 2026-01-25  
**Based On:** BlankLogo Event Tracking Pattern

## Overview

Implement sophisticated user event tracking for CanvasCast to optimize the video generation funnel from signup → prompt → generation → download → purchase.

## Event Categories

| Category | Events |
|----------|--------|
| **Acquisition** | `landing_view`, `cta_click`, `pricing_view`, `demo_video_played` |
| **Activation** | `signup_start`, `login_success`, `activation_complete`, `credits_granted` |
| **Core Value** | `project_created`, `prompt_submitted`, `video_generated`, `video_downloaded`, `script_edited`, `voice_selected` |
| **Monetization** | `checkout_started`, `purchase_completed`, `credits_purchased`, `subscription_started` |
| **Retention** | `return_session`, `video_returning_user`, `credits_low_warning` |
| **Reliability** | `error_shown`, `generation_failed`, `render_timeout` |

## Core Value Event Properties

### video_generated
```json
{
  "project_id": "string",
  "prompt_length": "number",
  "duration_seconds": "number",
  "voice_id": "string",
  "style": "string",
  "processing_time_ms": "number",
  "credits_used": "number"
}
```

### video_downloaded
```json
{
  "project_id": "string",
  "format": "mp4 | webm",
  "resolution": "720p | 1080p | 4k",
  "file_size_mb": "number"
}
```

## 4 North Star Milestones

1. **Activated** = `activation_complete` (logged in + credits)
2. **First Value** = first `video_generated`
3. **Aha Moment** = first `video_downloaded`
4. **Monetized** = `purchase_completed`

## Features

| ID | Name | Priority |
|----|------|----------|
| TRACK-001 | Tracking SDK Integration | P1 |
| TRACK-002 | Acquisition Event Tracking | P1 |
| TRACK-003 | Activation Event Tracking | P1 |
| TRACK-004 | Core Value Event Tracking | P1 |
| TRACK-005 | Monetization Event Tracking | P1 |
| TRACK-006 | Retention Event Tracking | P2 |
| TRACK-007 | Error & Performance Tracking | P2 |
| TRACK-008 | User Identification | P1 |
