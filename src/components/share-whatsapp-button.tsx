'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle, Send, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface ShareWhatsAppButtonProps {
  invoiceNumber: number
  partyName: string
  grandTotal: number
  dueDate?: string | null
  partyPhone?: string | null
  invoiceId: string
}

export function ShareWhatsAppButton({
  invoiceNumber,
  partyName,
  grandTotal,
  dueDate,
  partyPhone,
  invoiceId,
}: ShareWhatsAppButtonProps) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState(partyPhone?.replace(/\D/g, '') || '')
  const [copied, setCopied] = useState(false)

  // Generate invoice URL (this would be the print URL or a shareable link)
  const invoiceUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/print/${invoiceId}`
    : ''

  // Format the message
  const formatAmount = (amount: number) =>
    `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const defaultMessage = `Dear ${partyName},

Please find below the invoice details from Shweta Plastics:

📄 Invoice #${invoiceNumber}
💰 Amount: ${formatAmount(grandTotal)}${dueDate ? `
📅 Due Date: ${formatDate(dueDate)}` : ''}

View Invoice: ${invoiceUrl}

Thank you for your business!

Regards,
Shweta Plastics`

  const [message, setMessage] = useState(defaultMessage)

  const handleShare = () => {
    // Format phone number (remove non-digits, add country code if needed)
    let formattedPhone = phone.replace(/\D/g, '')
    if (formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone // Add India country code
    }

    const encodedMessage = encodeURIComponent(message)

    // Open WhatsApp with pre-filled message
    if (formattedPhone) {
      window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank')
    } else {
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank')
    }

    setOpen(false)
    toast.success('Opening WhatsApp...')
  }

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    toast.success('Message copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Share on WhatsApp
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Phone Number (Optional)</Label>
            <Input
              placeholder="e.g., 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={12}
            />
            <p className="text-xs text-slate-500">
              Leave empty to open WhatsApp without a specific contact
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Message</Label>
              <Button variant="ghost" size="sm" onClick={handleCopyMessage}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleShare}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
