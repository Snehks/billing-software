// Database Types for Shweta Plastics Billing Software

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'staff'
  is_active: boolean
  created_at: string
  last_login: string | null
}

export interface CompanySettings {
  id: number
  company_name: string
  gstin: string
  address: string
  phone: string
  email: string
  state: string
  state_code: string
  bank_name: string
  account_number: string
  ifsc_code: string
  default_terms: string
  next_invoice_number: number
  next_credit_note_number: number
  default_gst_rate: number
  updated_at: string
}

export interface Party {
  id: string
  name: string
  gstin: string | null
  address: string | null
  state: string | null
  state_code: string | null
  phone: string | null
  email: string | null
  payment_terms: string | null
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  name: string
  hsn_code: string | null
  default_unit: string
  default_rate: number | null
  gst_rate: number
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  invoice_number: number | null  // null for drafts
  is_draft: boolean
  invoice_date: string
  party_id: string | null
  party_gstin: string | null
  billed_to_name: string
  billed_to_address: string | null
  billed_to_state: string | null
  billed_to_state_code: string | null
  shipped_to_name: string | null
  shipped_to_address: string | null
  shipped_to_state: string | null
  shipped_to_state_code: string | null
  shipped_to_phone: string | null
  transport_mode: string | null
  vehicle_number: string | null
  gr_rr_number: string | null
  place_of_supply: string | null
  place_of_supply_state_code: string | null
  total_packages: number | null
  amount_before_tax: number
  packaging_charges: number
  sub_total: number
  cgst_rate: number | null
  cgst_amount: number | null
  sgst_rate: number | null
  sgst_amount: number | null
  igst_rate: number | null
  igst_amount: number | null
  grand_total: number
  amount_in_words: string | null
  reverse_charge: boolean
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  serial_number: number
  item_id: string | null
  description: string
  hsn_code: string | null
  quantity: number
  unit: string
  rate: number
  amount: number
  created_at: string
}

export interface Payment {
  id: string
  invoice_id: string
  payment_date: string
  amount: number
  payment_mode: 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque'
  reference_number: string | null
  notes: string | null
  recorded_by: string | null
  created_at: string
}

export type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid' | 'Overdue'

export interface CreditNote {
  id: string
  credit_note_number: number
  credit_note_date: string
  original_invoice_id: string | null
  party_id: string | null
  party_gstin: string | null
  party_name: string
  party_address: string | null
  party_state: string | null
  party_state_code: string | null
  reason: string
  amount_before_tax: number
  cgst_rate: number | null
  cgst_amount: number | null
  sgst_rate: number | null
  sgst_amount: number | null
  igst_rate: number | null
  igst_amount: number | null
  total_amount: number
  amount_in_words: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreditNoteItem {
  id: string
  credit_note_id: string
  serial_number: number
  item_id: string | null
  description: string
  hsn_code: string | null
  quantity: number
  unit: string
  rate: number
  amount: number
  created_at: string
}

// Indian States with codes for GST
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
] as const

// Units for items
export const UNITS = [
  'Pc',
  'Pcs',
  'Kg',
  'Gm',
  'Ltr',
  'Ml',
  'Box',
  'Dozen',
  'Set',
  'Mtr',
  'Ft',
  'Sq.Ft',
  'Sq.Mtr',
] as const

// Transport modes
export const TRANSPORT_MODES = [
  'Road',
  'Rail',
  'Air',
  'Ship',
] as const

// Payment modes
export const PAYMENT_MODES = [
  'Cash',
  'Bank Transfer',
  'UPI',
  'Cheque',
] as const

// GST Rates
export const GST_RATES = [0, 5, 12, 18, 28] as const

// Payment Terms (days until due)
export const PAYMENT_TERMS = [
  { value: 'COD', label: 'Cash on Delivery', days: 0 },
  { value: 'Net 7', label: 'Net 7 days', days: 7 },
  { value: 'Net 15', label: 'Net 15 days', days: 15 },
  { value: 'Net 30', label: 'Net 30 days', days: 30 },
  { value: 'Net 45', label: 'Net 45 days', days: 45 },
  { value: 'Net 60', label: 'Net 60 days', days: 60 },
] as const

// Credit Note Reasons
export const CREDIT_NOTE_REASONS = [
  'Goods returned',
  'Defective goods',
  'Wrong goods delivered',
  'Rate difference',
  'Quality issue',
  'Discount on settlement',
  'Other',
] as const
