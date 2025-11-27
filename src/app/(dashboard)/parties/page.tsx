'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Users, Plus, Pencil, Trash2, FileText, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Party, INDIAN_STATES } from '@/lib/types'

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingParty, setEditingParty] = useState<Party | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    gstin: '',
    address: '',
    state: '',
    state_code: '',
    phone: '',
    email: '',
  })

  const supabase = createClient()

  const fetchParties = async () => {
    const { data, error } = await supabase
      .from('parties')
      .select('*')
      .order('name')

    if (error) {
      toast.error('Failed to fetch parties')
      return
    }

    setParties(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchParties()
  }, [])

  const handleStateChange = (stateCode: string) => {
    const state = INDIAN_STATES.find(s => s.code === stateCode)
    setFormData({
      ...formData,
      state_code: stateCode,
      state: state?.name || '',
    })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      gstin: '',
      address: '',
      state: '',
      state_code: '',
      phone: '',
      email: '',
    })
    setEditingParty(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingParty) {
      const { error } = await supabase
        .from('parties')
        .update(formData)
        .eq('id', editingParty.id)

      if (error) {
        toast.error('Failed to update party')
        return
      }

      toast.success('Party updated')
    } else {
      const { error } = await supabase
        .from('parties')
        .insert(formData)

      if (error) {
        toast.error('Failed to add party')
        return
      }

      toast.success('Party added')
    }

    setDialogOpen(false)
    resetForm()
    fetchParties()
  }

  const handleEdit = (party: Party) => {
    setEditingParty(party)
    setFormData({
      name: party.name,
      gstin: party.gstin || '',
      address: party.address || '',
      state: party.state || '',
      state_code: party.state_code || '',
      phone: party.phone || '',
      email: party.email || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this party?')) return

    const { error } = await supabase
      .from('parties')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete party')
      return
    }

    toast.success('Party deleted')
    fetchParties()
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Parties</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Party
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingParty ? 'Edit Party' : 'Add Party'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input
                  id="gstin"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  maxLength={15}
                  placeholder="e.g., 27AABCU9603R1ZM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select value={formData.state_code} onValueChange={handleStateChange}>
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
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                {editingParty ? 'Update Party' : 'Add Party'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Parties</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : parties.length > 0 ? (
            <div className="space-y-2">
              {parties.map((party) => (
                <div key={party.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 group">
                  <Link href={`/parties/${party.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="font-medium">{party.name}</p>
                        <p className="text-sm text-slate-500">
                          {party.gstin && <span className="mr-3">GSTIN: {party.gstin}</span>}
                          {party.state && <span>{party.state}</span>}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                  <div className="flex gap-1 ml-2">
                    <Link href={`/parties/${party.id}`}>
                      <Button variant="ghost" size="icon" title="View Invoices">
                        <FileText className="h-4 w-4 text-slate-500" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(party); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(party.id); }}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-2 text-sm font-medium text-slate-900">No parties yet</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add your customers/parties to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
