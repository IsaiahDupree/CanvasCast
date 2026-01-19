-- Migration: Storage Buckets and RLS Policies
-- Description: Create storage buckets for generated assets, voice samples, and temp processing
-- Feature: STORAGE-001

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Create generated-assets bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-assets',
  'generated-assets',
  true,
  524288000, -- 500MB in bytes
  ARRAY['video/mp4', 'audio/mpeg', 'image/png', 'image/jpeg', 'text/plain', 'application/zip']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create voice-samples bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-samples',
  'voice-samples',
  false,
  52428800, -- 50MB in bytes
  ARRAY['audio/wav', 'audio/mpeg', 'audio/x-m4a']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create temp-processing bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'temp-processing',
  'temp-processing',
  false,
  1073741824 -- 1GB in bytes
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- =============================================
-- RLS POLICIES FOR generated-assets BUCKET
-- =============================================

-- Anyone can read from generated-assets bucket
CREATE POLICY "Public read access for generated assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-assets');

-- Only service role can write to generated-assets bucket
CREATE POLICY "Service write access for generated assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'generated-assets'
  AND auth.role() = 'service_role'
);

-- Only service role can update objects in generated-assets
CREATE POLICY "Service update access for generated assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'generated-assets'
  AND auth.role() = 'service_role'
);

-- Only service role can delete from generated-assets
CREATE POLICY "Service delete access for generated assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'generated-assets'
  AND auth.role() = 'service_role'
);

-- =============================================
-- RLS POLICIES FOR voice-samples BUCKET
-- =============================================

-- Users can read their own voice samples
CREATE POLICY "User read own voice samples"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'voice-samples'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Users can upload to their own folder in voice-samples
CREATE POLICY "User upload own voice samples"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voice-samples'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Users can update their own voice samples
CREATE POLICY "User update own voice samples"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'voice-samples'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Users can delete their own voice samples
CREATE POLICY "User delete own voice samples"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'voice-samples'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- =============================================
-- RLS POLICIES FOR temp-processing BUCKET
-- =============================================

-- Only service role can read from temp-processing bucket
CREATE POLICY "Service read access for temp processing"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'temp-processing'
  AND auth.role() = 'service_role'
);

-- Only service role can write to temp-processing bucket
CREATE POLICY "Service write access for temp processing"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'temp-processing'
  AND auth.role() = 'service_role'
);

-- Only service role can update temp-processing objects
CREATE POLICY "Service update access for temp processing"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'temp-processing'
  AND auth.role() = 'service_role'
);

-- Only service role can delete from temp-processing bucket
CREATE POLICY "Service delete access for temp processing"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'temp-processing'
  AND auth.role() = 'service_role'
);
