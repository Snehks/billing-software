-- Shweta Plastics Billing Software - Database Schema
-- Run this in Supabase SQL Editor (SQL Editor > New Query)

-- Enable extensions FIRST
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 1. USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- ============================================
-- 2. COMPANY SETTINGS (Single row table)
-- ============================================
CREATE TABLE public.company_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensures single row
    company_name TEXT NOT NULL DEFAULT 'Shweta Plastics',
    gstin TEXT NOT NULL DEFAULT '07ADJPT5851A1ZI',
    address TEXT NOT NULL DEFAULT '166, Patparganj Village, Delhi-110091',
    phone TEXT NOT NULL DEFAULT '9811811514, 9873741704',
    email TEXT NOT NULL DEFAULT 'shwetaplastic1@gmail.com',
    state TEXT NOT NULL DEFAULT 'Delhi',
    state_code TEXT NOT NULL DEFAULT '07',
    bank_name TEXT NOT NULL DEFAULT 'HDFC BANK',
    account_number TEXT NOT NULL DEFAULT '50200026301446',
    ifsc_code TEXT NOT NULL DEFAULT 'HDFC 0000925',
    default_terms TEXT DEFAULT 'Our responsibility ceases after the goods leave our godown & despatched entirely at Owner''s risk and responsibility. Subject to Delhi Jurisdiction only.',
    next_invoice_number INTEGER NOT NULL DEFAULT 1,
    default_gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default company settings
INSERT INTO public.company_settings (id) VALUES (1);

-- ============================================
-- 3. PARTIES (Customers)
-- ============================================
CREATE TABLE public.parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    gstin TEXT,
    address TEXT,
    state TEXT,
    state_code TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for autocomplete search
CREATE INDEX idx_parties_name ON public.parties USING gin(name gin_trgm_ops);

-- ============================================
-- 4. ITEMS (Product Master)
-- ============================================
CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    hsn_code TEXT,
    default_unit TEXT NOT NULL DEFAULT 'Pc',
    default_rate DECIMAL(12,2),
    gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for autocomplete search
CREATE INDEX idx_items_name ON public.items USING gin(name gin_trgm_ops);

-- ============================================
-- 5. INVOICES
-- ============================================
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number INTEGER UNIQUE,  -- NULL for drafts
    is_draft BOOLEAN NOT NULL DEFAULT false,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,

    -- Billed To
    party_id UUID REFERENCES public.parties(id),
    party_gstin TEXT,
    billed_to_name TEXT NOT NULL,
    billed_to_address TEXT,
    billed_to_state TEXT,
    billed_to_state_code TEXT,

    -- Shipped To
    shipped_to_name TEXT,
    shipped_to_address TEXT,
    shipped_to_state TEXT,
    shipped_to_state_code TEXT,
    shipped_to_phone TEXT,

    -- Transport
    transport_mode TEXT,
    vehicle_number TEXT,
    gr_rr_number TEXT,
    place_of_supply TEXT,
    place_of_supply_state_code TEXT,
    total_packages INTEGER,

    -- Amounts
    amount_before_tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    packaging_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
    sub_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    cgst_rate DECIMAL(5,2) DEFAULT 0,
    cgst_amount DECIMAL(12,2) DEFAULT 0,
    sgst_rate DECIMAL(5,2) DEFAULT 0,
    sgst_amount DECIMAL(12,2) DEFAULT 0,
    igst_rate DECIMAL(5,2) DEFAULT 0,
    igst_amount DECIMAL(12,2) DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount_in_words TEXT,

    -- Other
    reverse_charge BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,

    -- Metadata
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for searching
CREATE INDEX idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX idx_invoices_date ON public.invoices(invoice_date);
CREATE INDEX idx_invoices_party ON public.invoices(party_id);

-- ============================================
-- 6. INVOICE LINE ITEMS
-- ============================================
CREATE TABLE public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
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

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- ============================================
-- 7. PAYMENTS
-- ============================================
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(12,2) NOT NULL,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'Bank Transfer', 'UPI', 'Cheque')),
    reference_number TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users: Can read own profile, admins can read all
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can insert users" ON public.users
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update users" ON public.users
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Company Settings: All authenticated users can read, only admins can update
CREATE POLICY "Authenticated users can view company settings" ON public.company_settings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can update company settings" ON public.company_settings
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Parties: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage parties" ON public.parties
    FOR ALL USING (auth.role() = 'authenticated');

-- Items: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage items" ON public.items
    FOR ALL USING (auth.role() = 'authenticated');

-- Invoices: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage invoices" ON public.invoices
    FOR ALL USING (auth.role() = 'authenticated');

-- Invoice Items: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage invoice items" ON public.invoice_items
    FOR ALL USING (auth.role() = 'authenticated');

-- Payments: All authenticated users can CRUD
CREATE POLICY "Authenticated users can manage payments" ON public.payments
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 9. FUNCTIONS
-- ============================================

-- Function to get next invoice number and increment
CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS INTEGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    UPDATE public.company_settings
    SET next_invoice_number = next_invoice_number + 1,
        updated_at = NOW()
    WHERE id = 1
    RETURNING next_invoice_number - 1 INTO next_num;

    RETURN next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate payment status
CREATE OR REPLACE FUNCTION get_payment_status(invoice_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    total_paid DECIMAL(12,2);
    invoice_total DECIMAL(12,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM public.payments WHERE invoice_id = invoice_uuid;

    SELECT grand_total INTO invoice_total
    FROM public.invoices WHERE id = invoice_uuid;

    IF total_paid >= invoice_total THEN
        RETURN 'Paid';
    ELSIF total_paid > 0 THEN
        RETURN 'Partial';
    ELSE
        RETURN 'Unpaid';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 10. TRIGRAM EXTENSION (already enabled at top)
-- ============================================
-- pg_trgm extension enabled at top for autocomplete indexes

-- ============================================
-- 11. SAMPLE DATA (Optional - Remove in production)
-- ============================================

-- Sample items
INSERT INTO public.items (name, hsn_code, default_unit, default_rate, gst_rate) VALUES
('Agricultural Spray Pump PVC Nozzle', '8424', 'Pc', 4.30, 18),
('Spray Pump Handle', '8424', 'Pc', 15.00, 18),
('Spray Pump Barrel', '8424', 'Pc', 25.00, 18),
('PVC Pipe Connector', '3917', 'Pc', 5.00, 18),
('Spray Pump Complete Set', '8424', 'Set', 150.00, 18);
