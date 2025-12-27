'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Copy, Save, Printer, FileEdit } from 'lucide-react'
import { toast } from 'sonner'
import { Party, Item, CompanySettings, INDIAN_STATES, UNITS, TRANSPORT_MODES } from '@/lib/types'
import { amountToWords } from '@/lib/amount-to-words'
import { toTitleCase } from '@/lib/utils'

interface LineItem {
  id: string
  item_id: string | null
  description: string
  hsn_code: string
  quantity: string
  unit: string
  rate: string
  amount: number
  saveToItems: boolean
}

const emptyLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  item_id: null,
  description: '',
  hsn_code: '',
  quantity: '',
  unit: 'Pc',
  rate: '',
  amount: 0,
  saveToItems: false,
})

export default function NewInvoicePage() {
  const router = useRouter()
  const supabase = createClient()

  // Data for autocomplete
  const [parties, setParties] = useState<Party[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Party search
  const [partySearch, setPartySearch] = useState('')
  const [showPartyDropdown, setShowPartyDropdown] = useState(false)
  const [itemSearchIndex, setItemSearchIndex] = useState<number | null>(null)

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState<string>('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [partyGstin, setPartyGstin] = useState('')

  // Billed To
  const [billedTo, setBilledTo] = useState({
    party_id: '',
    name: '',
    address: '',
    state: '',
    state_code: '',
  })

  // Shipped To
  const [shippedTo, setShippedTo] = useState({
    name: '',
    address: '',
    state: '',
    state_code: '',
    phone: '',
  })

  // Transport
  const [transport, setTransport] = useState({
    mode: '',
    vehicle_number: '',
    gr_rr_number: '',
    place_of_supply: '',
    place_of_supply_state_code: '',
    total_packages: '',
  })

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()])

  // Totals
  const [packagingCharges, setPackagingCharges] = useState('')
  const [reverseCharge, setReverseCharge] = useState(false)
  const [notes, setNotes] = useState('')

  // Calculated values
  const [totals, setTotals] = useState({
    amountBeforeTax: 0,
    subTotal: 0,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: 0,
    igstAmount: 0,
    grandTotal: 0,
    amountInWords: '',
  })

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      const [partiesRes, itemsRes, settingsRes] = await Promise.all([
        supabase.from('parties').select('*').order('name'),
        supabase.from('items').select('*').order('name'),
        supabase.from('company_settings').select('*').eq('id', 1).single(),
      ])

      if (partiesRes.data) setParties(partiesRes.data)
      if (itemsRes.data) setItems(itemsRes.data)
      if (settingsRes.data) {
        setSettings(settingsRes.data)
        setInvoiceNumber(settingsRes.data.next_invoice_number?.toString() || '1')
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  // Calculate totals whenever line items or packaging changes
  const calculateTotals = useCallback(() => {
    const amountBeforeTax = lineItems.reduce((sum, item) => sum + item.amount, 0)
    const packaging = parseFloat(packagingCharges) || 0
    const subTotal = amountBeforeTax + packaging

    // Determine GST type based on place of supply
    const companyStateCode = settings?.state_code || '07'
    const supplyStateCode = transport.place_of_supply_state_code || billedTo.state_code || companyStateCode

    // Get GST rate (use first item's rate or default)
    const gstRate = items.find(i => lineItems.some(li => li.item_id === i.id))?.gst_rate || settings?.default_gst_rate || 18

    let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0

    if (supplyStateCode === companyStateCode) {
      // Intra-state: CGST + SGST
      cgstRate = gstRate / 2
      sgstRate = gstRate / 2
      cgstAmount = Math.round((subTotal * cgstRate / 100) * 100) / 100
      sgstAmount = Math.round((subTotal * sgstRate / 100) * 100) / 100
    } else {
      // Inter-state: IGST
      igstRate = gstRate
      igstAmount = Math.round((subTotal * igstRate / 100) * 100) / 100
    }

    const grandTotal = Math.round((subTotal + cgstAmount + sgstAmount + igstAmount) * 100) / 100

    setTotals({
      amountBeforeTax,
      subTotal,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      grandTotal,
      amountInWords: amountToWords(grandTotal),
    })
  }, [lineItems, packagingCharges, transport.place_of_supply_state_code, billedTo.state_code, settings, items])

  useEffect(() => {
    calculateTotals()
  }, [calculateTotals])

  // Party selection
  const handlePartySelect = (party: Party) => {
    setBilledTo({
      party_id: party.id,
      name: party.name,
      address: party.address || '',
      state: party.state || '',
      state_code: party.state_code || '',
    })
    setPartyGstin(party.gstin || '')
    setPartySearch(party.name)
    setShowPartyDropdown(false)

    // Auto-set place of supply
    if (party.state_code) {
      setTransport(prev => ({
        ...prev,
        place_of_supply: party.state || '',
        place_of_supply_state_code: party.state_code || '',
      }))
    }
  }

  // Copy billed to shipped
  const copyBilledToShipped = () => {
    setShippedTo({
      name: billedTo.name,
      address: billedTo.address,
      state: billedTo.state,
      state_code: billedTo.state_code,
      phone: '',
    })
  }

  // Line item handlers
  const handleItemSelect = (index: number, item: Item) => {
    const newItems = [...lineItems]
    newItems[index] = {
      ...newItems[index],
      item_id: item.id,
      description: item.name,
      hsn_code: item.hsn_code || '',
      unit: item.default_unit,
      rate: item.default_rate?.toString() || '',
      saveToItems: false, // Already exists in master list
    }

    // Calculate amount
    const qty = parseFloat(newItems[index].quantity) || 0
    const rate = parseFloat(newItems[index].rate) || 0
    newItems[index].amount = Math.round(qty * rate * 100) / 100

    setLineItems(newItems)
    setItemSearchIndex(null)
  }

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const newItems = [...lineItems]
    newItems[index] = { ...newItems[index], [field]: value }

    // Recalculate amount
    if (field === 'quantity' || field === 'rate') {
      const qty = parseFloat(field === 'quantity' ? value : newItems[index].quantity) || 0
      const rate = parseFloat(field === 'rate' ? value : newItems[index].rate) || 0
      newItems[index].amount = Math.round(qty * rate * 100) / 100
    }

    setLineItems(newItems)
  }

  const addLineItem = () => {
    setLineItems([...lineItems, emptyLineItem()])
  }

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  // Handle place of supply change
  const handlePlaceOfSupplyChange = (stateCode: string) => {
    const state = INDIAN_STATES.find(s => s.code === stateCode)
    setTransport({
      ...transport,
      place_of_supply: state?.name || '',
      place_of_supply_state_code: stateCode,
    })
  }

  // Save invoice
  const handleSave = async (andPrint: boolean = false, isDraft: boolean = false) => {
    // Validation - less strict for drafts
    let invoiceNum: number | null = null

    if (!isDraft) {
      invoiceNum = parseInt(invoiceNumber)
      if (!invoiceNumber.trim() || isNaN(invoiceNum) || invoiceNum <= 0) {
        toast.error('Please enter a valid invoice number')
        return
      }
    }

    if (!billedTo.name.trim()) {
      toast.error('Please enter party name')
      return
    }

    const validLineItems = lineItems.filter(li => li.description.trim() && li.quantity && li.rate)
    if (validLineItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    setSaving(true)

    try {
      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: isDraft ? null : invoiceNum,
          is_draft: isDraft,
          invoice_date: invoiceDate,
          party_id: billedTo.party_id || null,
          party_gstin: partyGstin || null,
          billed_to_name: toTitleCase(billedTo.name),
          billed_to_address: billedTo.address || null,
          billed_to_state: billedTo.state || null,
          billed_to_state_code: billedTo.state_code || null,
          shipped_to_name: shippedTo.name ? toTitleCase(shippedTo.name) : null,
          shipped_to_address: shippedTo.address || null,
          shipped_to_state: shippedTo.state || null,
          shipped_to_state_code: shippedTo.state_code || null,
          shipped_to_phone: shippedTo.phone || null,
          transport_mode: transport.mode || null,
          vehicle_number: transport.vehicle_number || null,
          gr_rr_number: transport.gr_rr_number || null,
          place_of_supply: transport.place_of_supply || null,
          place_of_supply_state_code: transport.place_of_supply_state_code || null,
          total_packages: transport.total_packages ? parseInt(transport.total_packages) : null,
          amount_before_tax: totals.amountBeforeTax,
          packaging_charges: parseFloat(packagingCharges) || 0,
          sub_total: totals.subTotal,
          cgst_rate: totals.cgstRate || null,
          cgst_amount: totals.cgstAmount || null,
          sgst_rate: totals.sgstRate || null,
          sgst_amount: totals.sgstAmount || null,
          igst_rate: totals.igstRate || null,
          igst_amount: totals.igstAmount || null,
          grand_total: totals.grandTotal,
          amount_in_words: totals.amountInWords,
          reverse_charge: reverseCharge,
          notes: notes || null,
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Save new items to master items list if marked for saving
      const itemsToSave = validLineItems.filter(li => li.saveToItems && !li.item_id && li.description.trim())
      const itemIdMap: Record<string, string> = {} // Map line item id to new master item id

      if (itemsToSave.length > 0) {
        // Check which items already exist by name
        const { data: existingItems } = await supabase
          .from('items')
          .select('id, name')
          .in('name', itemsToSave.map(li => li.description.trim()))

        // Create a map of existing item names (lowercase) to their IDs
        const existingItemMap: Record<string, string> = {}
        existingItems?.forEach(item => {
          existingItemMap[item.name.toLowerCase()] = item.id
        })

        // Filter out items that already exist
        const newItemsToInsert = itemsToSave.filter(li =>
          !existingItemMap[li.description.trim().toLowerCase()]
        )
        const skippedItems = itemsToSave.filter(li =>
          existingItemMap[li.description.trim().toLowerCase()]
        )

        // Map skipped items to their existing IDs
        skippedItems.forEach(li => {
          const existingId = existingItemMap[li.description.trim().toLowerCase()]
          if (existingId) {
            itemIdMap[li.id] = existingId
          }
        })

        // Insert only new items
        if (newItemsToInsert.length > 0) {
          const masterItemsToInsert = newItemsToInsert.map(li => ({
            name: toTitleCase(li.description.trim()),
            hsn_code: li.hsn_code || null,
            default_unit: li.unit,
            default_rate: parseFloat(li.rate) || null,
            gst_rate: settings?.default_gst_rate || 18,
          }))

          const { data: newItems, error: newItemsError } = await supabase
            .from('items')
            .insert(masterItemsToInsert)
            .select()

          if (newItemsError) {
            console.error('Error saving items to master list:', newItemsError)
          } else if (newItems) {
            newItemsToInsert.forEach((li, idx) => {
              if (newItems[idx]) {
                itemIdMap[li.id] = newItems[idx].id
              }
            })
          }
        }

        // Show appropriate messages
        if (newItemsToInsert.length > 0) {
          toast.success(`${newItemsToInsert.length} item(s) saved to master list`)
        }
        if (skippedItems.length > 0) {
          toast.info(`${skippedItems.length} item(s) already exist and were linked`)
        }
      }

      // Create line items (with updated item_ids for newly saved items)
      const lineItemsToInsert = validLineItems.map((li, index) => ({
        invoice_id: invoice.id,
        serial_number: index + 1,
        item_id: itemIdMap[li.id] || li.item_id || null,
        description: toTitleCase(li.description),
        hsn_code: li.hsn_code || null,
        quantity: parseFloat(li.quantity),
        unit: li.unit,
        rate: parseFloat(li.rate),
        amount: li.amount,
      }))

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(lineItemsToInsert)

      if (itemsError) throw itemsError

      // Update next invoice number only if not a draft and we used it or went higher
      if (!isDraft && invoiceNum !== null) {
        const currentNext = settings?.next_invoice_number || 1
        if (invoiceNum >= currentNext) {
          await supabase
            .from('company_settings')
            .update({ next_invoice_number: invoiceNum + 1 })
            .eq('id', 1)
        }
      }

      toast.success(isDraft ? 'Draft saved successfully' : 'Invoice saved successfully')

      if (andPrint && !isDraft) {
        window.open(`/print/${invoice.id}`, '_blank')
      }
      router.push('/invoices')
    } catch (error: unknown) {
      console.error('Error saving invoice:', error)
      const err = error as { message?: string; details?: string; hint?: string; code?: string }

      // Handle specific errors
      if (err?.code === '23505' || err?.message?.includes('duplicate') || err?.message?.includes('unique')) {
        toast.error(`Invoice #${invoiceNum} already exists. Please use a different number.`)
      } else if (err?.code === '42501' || err?.message?.includes('policy')) {
        toast.error('Permission denied. Please check database settings.')
      } else {
        toast.error(err?.message || 'Failed to save invoice')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  const filteredParties = parties.filter(p =>
    p.name.toLowerCase().includes(partySearch.toLowerCase())
  )

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">New Invoice</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(false, true)} disabled={saving}>
            <FileEdit className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button variant="outline" onClick={() => handleSave(false, false)} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button onClick={() => handleSave(true, false)} disabled={saving}>
            <Printer className="mr-2 h-4 w-4" />
            Save & Print
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Invoice Header */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Invoice No.</Label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Invoice number"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Party&apos;s GSTIN</Label>
                <Input
                  value={partyGstin}
                  onChange={(e) => setPartyGstin(e.target.value.toUpperCase())}
                  placeholder="e.g., 27AABCU9603R1ZM"
                  maxLength={15}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billed To / Shipped To */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Billed To</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 relative">
                <Label>Name *</Label>
                <Input
                  value={partySearch}
                  onChange={(e) => {
                    setPartySearch(e.target.value)
                    setBilledTo({ ...billedTo, name: e.target.value })
                    setShowPartyDropdown(true)
                  }}
                  onFocus={() => setShowPartyDropdown(true)}
                  placeholder="Search or enter party name"
                />
                {showPartyDropdown && partySearch && filteredParties.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                    {filteredParties.slice(0, 10).map((party) => (
                      <div
                        key={party.id}
                        className="px-3 py-2 cursor-pointer hover:bg-slate-100"
                        onClick={() => handlePartySelect(party)}
                      >
                        <p className="font-medium">{party.name}</p>
                        {party.gstin && <p className="text-sm text-slate-500">{party.gstin}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={billedTo.address}
                  onChange={(e) => setBilledTo({ ...billedTo, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select
                    value={billedTo.state_code}
                    onValueChange={(code) => {
                      const state = INDIAN_STATES.find(s => s.code === code)
                      setBilledTo({ ...billedTo, state: state?.name || '', state_code: code })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.code} - {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>State Code</Label>
                  <Input value={billedTo.state_code} disabled />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Shipped To</CardTitle>
              <Button variant="ghost" size="sm" onClick={copyBilledToShipped}>
                <Copy className="mr-2 h-4 w-4" />
                Copy from Billed To
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={shippedTo.name}
                  onChange={(e) => setShippedTo({ ...shippedTo, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={shippedTo.address}
                  onChange={(e) => setShippedTo({ ...shippedTo, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select
                    value={shippedTo.state_code}
                    onValueChange={(code) => {
                      const state = INDIAN_STATES.find(s => s.code === code)
                      setShippedTo({ ...shippedTo, state: state?.name || '', state_code: code })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.code} - {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={shippedTo.phone}
                    onChange={(e) => setShippedTo({ ...shippedTo, phone: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transport Details */}
        <Card>
          <CardHeader>
            <CardTitle>Transport Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select
                  value={transport.mode}
                  onValueChange={(value) => setTransport({ ...transport, mode: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORT_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehicle No.</Label>
                <Input
                  value={transport.vehicle_number}
                  onChange={(e) => setTransport({ ...transport, vehicle_number: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label>GR/RR No.</Label>
                <Input
                  value={transport.gr_rr_number}
                  onChange={(e) => setTransport({ ...transport, gr_rr_number: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Place of Supply</Label>
                <Select
                  value={transport.place_of_supply_state_code}
                  onValueChange={handlePlaceOfSupplyChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.code} - {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total Pkg</Label>
                <Input
                  type="number"
                  value={transport.total_packages}
                  onChange={(e) => setTransport({ ...transport, total_packages: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card className="overflow-visible">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="overflow-visible">
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 w-8">#</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-left p-2 w-24">HSN</th>
                    <th className="text-right p-2 w-20">Qty</th>
                    <th className="text-left p-2 w-20">Unit</th>
                    <th className="text-right p-2 w-24">Rate</th>
                    <th className="text-right p-2 w-28">Amount</th>
                    <th className="text-center p-2 w-16" title="Save to Items List">Save</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2">{index + 1}</td>
                      <td className="p-2 relative">
                        <Input
                          value={item.description}
                          onChange={(e) => {
                            updateLineItem(index, 'description', e.target.value)
                            setItemSearchIndex(index)
                          }}
                          onFocus={() => setItemSearchIndex(index)}
                          placeholder="Search or enter item"
                        />
                        {itemSearchIndex === index && item.description && (
                          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
                            {items
                              .filter(i => i.name.toLowerCase().includes(item.description.toLowerCase()))
                              .slice(0, 10)
                              .map((i) => (
                                <div
                                  key={i.id}
                                  className="px-3 py-2 cursor-pointer hover:bg-slate-100"
                                  onClick={() => handleItemSelect(index, i)}
                                >
                                  <p className="font-medium">{i.name}</p>
                                  <p className="text-sm text-slate-500">
                                    HSN: {i.hsn_code || '-'} | ₹{i.default_rate || 0}
                                  </p>
                                </div>
                              ))}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <Input
                          value={item.hsn_code}
                          onChange={(e) => updateLineItem(index, 'hsn_code', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.001"
                          className="text-right"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <Select
                          value={item.unit}
                          onValueChange={(value) => updateLineItem(index, 'unit', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNITS.map((unit) => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          className="text-right"
                          value={item.rate}
                          onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center">
                        {!item.item_id && item.description.trim() && (
                          <Checkbox
                            checked={item.saveToItems}
                            onCheckedChange={(checked) => {
                              const newItems = [...lineItems]
                              newItems[index] = { ...newItems[index], saveToItems: checked as boolean }
                              setLineItems(newItems)
                            }}
                            title="Save this item to the master items list for future use"
                          />
                        )}
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(index)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Additional Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reverseCharge"
                  checked={reverseCharge}
                  onCheckedChange={(checked) => setReverseCharge(checked as boolean)}
                />
                <Label htmlFor="reverseCharge">Tax Subject to Reverse Charge</Label>
              </div>
              <div className="space-y-2">
                <Label>Notes (Internal)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Amount Before Tax</span>
                  <span>₹{totals.amountBeforeTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>PKG/FWDG</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-32 text-right"
                    value={packagingCharges}
                    onChange={(e) => setPackagingCharges(e.target.value)}
                  />
                </div>
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Sub Total</span>
                  <span>₹{totals.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {totals.cgstRate > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>CGST @ {totals.cgstRate}%</span>
                      <span>₹{totals.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST @ {totals.sgstRate}%</span>
                      <span>₹{totals.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
                {totals.igstRate > 0 && (
                  <div className="flex justify-between">
                    <span>IGST @ {totals.igstRate}%</span>
                    <span>₹{totals.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Grand Total</span>
                  <span>₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-sm text-slate-600 border-t pt-2">
                  <strong>In Words:</strong> {totals.amountInWords}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
