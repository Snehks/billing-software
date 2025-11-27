'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from 'sonner'
import { CompanySettings, INDIAN_STATES, GST_RATES } from '@/lib/types'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<Partial<CompanySettings>>({
    company_name: '',
    gstin: '',
    address: '',
    phone: '',
    email: '',
    state: '',
    state_code: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    default_terms: '',
    next_invoice_number: 1,
    default_gst_rate: 18,
  })

  const supabase = createClient()

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (error) {
        toast.error('Failed to fetch settings')
        setLoading(false)
        return
      }

      if (data) {
        setSettings(data)
      }
      setLoading(false)
    }

    fetchSettings()
  }, [])

  const handleStateChange = (stateCode: string) => {
    const state = INDIAN_STATES.find(s => s.code === stateCode)
    setSettings({
      ...settings,
      state_code: stateCode,
      state: state?.name || '',
    })
  }

  const handleSave = async () => {
    setSaving(true)

    const { error } = await supabase
      .from('company_settings')
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    if (error) {
      toast.error('Failed to save settings')
      setSaving(false)
      return
    }

    toast.success('Settings saved')
    setSaving(false)
  }

  if (loading) {
    return <p>Loading...</p>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your company details and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>This information appears on your invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input
                  id="gstin"
                  value={settings.gstin}
                  onChange={(e) => setSettings({ ...settings, gstin: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select value={settings.state_code} onValueChange={handleStateChange}>
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
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle>Bank Details</CardTitle>
            <CardDescription>Bank information for payment collection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={settings.bank_name}
                  onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  value={settings.account_number}
                  onChange={(e) => setSettings({ ...settings, account_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifsc_code">IFSC Code</Label>
                <Input
                  id="ifsc_code"
                  value={settings.ifsc_code}
                  onChange={(e) => setSettings({ ...settings, ifsc_code: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Settings</CardTitle>
            <CardDescription>Default settings for new invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="next_invoice_number">Next Invoice Number</Label>
                <Input
                  id="next_invoice_number"
                  type="number"
                  min="1"
                  value={settings.next_invoice_number}
                  onChange={(e) => setSettings({ ...settings, next_invoice_number: parseInt(e.target.value) || 1 })}
                />
                <p className="text-sm text-slate-500">The next invoice will be numbered starting from this</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_gst_rate">Default GST Rate</Label>
                <Select
                  value={settings.default_gst_rate?.toString()}
                  onValueChange={(value) => setSettings({ ...settings, default_gst_rate: parseFloat(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((rate) => (
                      <SelectItem key={rate} value={rate.toString()}>
                        {rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_terms">Default Terms & Conditions</Label>
              <Textarea
                id="default_terms"
                rows={3}
                value={settings.default_terms}
                onChange={(e) => setSettings({ ...settings, default_terms: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}
