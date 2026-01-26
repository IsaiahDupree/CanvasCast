# PRD: Growth Data Plane for CanvasCast

**Status:** Active  
**Created:** 2026-01-25  
**Priority:** P0  
**Reference:** `autonomous-coding-dashboard/harness/prompts/PRD_GROWTH_DATA_PLANE.md`

## Overview

Implement the Growth Data Plane for CanvasCast: unified event tracking for video generation funnel from signup → prompt → generation → download → purchase.

## CanvasCast-Specific Events

| Event | Source | Segment Trigger |
|-------|--------|-----------------|
| `landing_view` | web | - |
| `demo_video_played` | web | warm_lead |
| `signup_completed` | web | new_signup |
| `credits_granted` | app | - |
| `prompt_submitted` | app | activated |
| `video_generated` | app | first_value |
| `video_downloaded` | app | aha_moment |
| `checkout_started` | web | checkout_started |
| `credits_purchased` | stripe | - |
| `subscription_started` | stripe | - |
| `email.clicked` | resend | newsletter_clicker |

## Segments for CanvasCast

1. **signup_no_prompt_24h** → email: "Create your first AI video in 60 seconds"
2. **video_generated_no_download_48h** → email: "Your video is ready to download"
3. **low_credits_high_usage** → email: "Get more credits before you run out"
4. **pricing_viewed_2plus_not_paid** → email: "Which plan fits your video needs?" + Meta
5. **demo_watched_not_signed_up** → email: "Turn your ideas into videos"

## Features

| ID | Name | Priority |
|----|------|----------|
| GDP-001 | Supabase Schema Setup | P0 |
| GDP-002 | Person & Identity Tables | P0 |
| GDP-003 | Unified Events Table | P0 |
| GDP-004 | Resend Webhook Edge Function | P0 |
| GDP-005 | Email Event Tracking | P0 |
| GDP-006 | Click Redirect Tracker | P1 |
| GDP-007 | Stripe Webhook Integration | P1 |
| GDP-008 | Subscription Snapshot | P1 |
| GDP-009 | PostHog Identity Stitching | P1 |
| GDP-010 | Meta Pixel + CAPI Dedup | P1 |
| GDP-011 | Person Features Computation | P1 |
| GDP-012 | Segment Engine | P1 |
