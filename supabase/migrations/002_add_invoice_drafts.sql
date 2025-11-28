-- Migration: Add draft support for invoices
-- Run this in Supabase SQL Editor

-- 1. Add is_draft column
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;

-- 2. Make invoice_number nullable (for drafts)
ALTER TABLE public.invoices
ALTER COLUMN invoice_number DROP NOT NULL;

-- 3. Add index for filtering drafts
CREATE INDEX IF NOT EXISTS idx_invoices_is_draft ON public.invoices(is_draft);
