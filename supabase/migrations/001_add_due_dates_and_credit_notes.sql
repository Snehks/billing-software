-- Migration: Add due dates, payment terms, and credit notes
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD DUE DATE TO INVOICES
-- ============================================
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id);

-- ============================================
-- 2. ADD PAYMENT TERMS TO PARTIES
-- ============================================
ALTER TABLE public.parties
ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Net 30';

-- ============================================
-- 3. CREATE CREDIT NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credit_note_number INTEGER NOT NULL UNIQUE,
    credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Reference to original invoice (optional)
    original_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,

    -- Party info
    party_id UUID REFERENCES public.parties(id),
    party_gstin TEXT,
    party_name TEXT NOT NULL,
    party_address TEXT,
    party_state TEXT,
    party_state_code TEXT,

    -- Reason for credit note
    reason TEXT NOT NULL,

    -- Amounts (same structure as invoice for GST compliance)
    amount_before_tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    cgst_rate DECIMAL(5,2) DEFAULT 0,
    cgst_amount DECIMAL(12,2) DEFAULT 0,
    sgst_rate DECIMAL(5,2) DEFAULT 0,
    sgst_amount DECIMAL(12,2) DEFAULT 0,
    igst_rate DECIMAL(5,2) DEFAULT 0,
    igst_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount_in_words TEXT,

    -- Other
    notes TEXT,

    -- Metadata
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_credit_notes_number ON public.credit_notes(credit_note_number);
CREATE INDEX IF NOT EXISTS idx_credit_notes_date ON public.credit_notes(credit_note_date);
CREATE INDEX IF NOT EXISTS idx_credit_notes_party ON public.credit_notes(party_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON public.credit_notes(original_invoice_id);

-- Enable RLS
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Authenticated users can manage credit notes" ON public.credit_notes
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 4. CREDIT NOTE LINE ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_note_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
    serial_number INTEGER NOT NULL,
    item_id UUID REFERENCES public.items(id),
    description TEXT NOT NULL,
    hsn_code TEXT,
    quantity DECIMAL(12,3) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'Pc',
    rate DECIMAL(12,2) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_note_items_credit_note ON public.credit_note_items(credit_note_id);

-- Enable RLS
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Authenticated users can manage credit note items" ON public.credit_note_items
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 5. ADD NEXT CREDIT NOTE NUMBER TO COMPANY SETTINGS
-- ============================================
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS next_credit_note_number INTEGER NOT NULL DEFAULT 1;

-- ============================================
-- 6. FUNCTION TO GET NEXT CREDIT NOTE NUMBER
-- ============================================
CREATE OR REPLACE FUNCTION get_next_credit_note_number()
RETURNS INTEGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    UPDATE public.company_settings
    SET next_credit_note_number = next_credit_note_number + 1,
        updated_at = NOW()
    WHERE id = 1
    RETURNING next_credit_note_number - 1 INTO next_num;

    RETURN next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. UPDATE PAYMENT STATUS FUNCTION TO INCLUDE CREDIT NOTES
-- ============================================
CREATE OR REPLACE FUNCTION get_payment_status(invoice_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    total_paid DECIMAL(12,2);
    total_credits DECIMAL(12,2);
    invoice_total DECIMAL(12,2);
    net_due DECIMAL(12,2);
BEGIN
    -- Sum of payments
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM public.payments WHERE invoice_id = invoice_uuid;

    -- Sum of credit notes against this invoice
    SELECT COALESCE(SUM(total_amount), 0) INTO total_credits
    FROM public.credit_notes WHERE original_invoice_id = invoice_uuid;

    -- Invoice total
    SELECT grand_total INTO invoice_total
    FROM public.invoices WHERE id = invoice_uuid;

    -- Net amount due (invoice - credits)
    net_due := invoice_total - total_credits;

    IF total_paid >= net_due THEN
        RETURN 'Paid';
    ELSIF total_paid > 0 THEN
        RETURN 'Partial';
    ELSE
        RETURN 'Unpaid';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. FUNCTION TO CHECK IF INVOICE IS OVERDUE
-- ============================================
CREATE OR REPLACE FUNCTION get_invoice_overdue_status(invoice_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    inv_due_date DATE;
    payment_status TEXT;
BEGIN
    SELECT due_date INTO inv_due_date
    FROM public.invoices WHERE id = invoice_uuid;

    -- If no due date set, not overdue
    IF inv_due_date IS NULL THEN
        RETURN false;
    END IF;

    -- Get payment status
    SELECT get_payment_status(invoice_uuid) INTO payment_status;

    -- Overdue if past due date and not fully paid
    IF inv_due_date < CURRENT_DATE AND payment_status != 'Paid' THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
