import { NextRequest, NextResponse } from 'next/server'

interface GSTINCheckResponse {
  flag: boolean
  message?: string
  data?: {
    tradeNam?: string
    lgnm?: string
    pradr?: {
      addr?: {
        bnm?: string
        st?: string
        loc?: string
        bno?: string
        dst?: string
        stcd?: string
        city?: string
        flno?: string
        pncd?: string
      }
    }
    stj?: string
    sts?: string
    rgdt?: string
    ctb?: string
    dty?: string
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const gstin = searchParams.get('gstin')

  // Validate GSTIN
  if (!gstin) {
    return NextResponse.json(
      { error: 'GSTIN is required' },
      { status: 400 }
    )
  }

  // Validate GSTIN format (15 alphanumeric characters)
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  if (!gstinRegex.test(gstin.toUpperCase())) {
    return NextResponse.json(
      { error: 'Invalid GSTIN format' },
      { status: 400 }
    )
  }

  const apiKey = process.env.GSTINCHECK_API_KEY
  if (!apiKey) {
    console.error('GSTINCHECK_API_KEY is not configured')
    return NextResponse.json(
      { error: 'GST lookup service is not configured. Please add GSTINCHECK_API_KEY to environment.' },
      { status: 503 }
    )
  }

  try {
    // GSTINCheck API: https://sheet.gstincheck.co.in/check/API_KEY/GSTIN
    const response = await fetch(
      `https://sheet.gstincheck.co.in/check/${apiKey}/${gstin.toUpperCase()}`,
      { method: 'GET' }
    )

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data: GSTINCheckResponse = await response.json()

    if (!data.flag || !data.data) {
      return NextResponse.json(
        { error: data.message || 'GSTIN not found or inactive' },
        { status: 404 }
      )
    }

    const gstData = data.data
    const addr = gstData.pradr?.addr

    // Build address string from components
    const addressParts = [
      addr?.flno,
      addr?.bno,
      addr?.bnm,
      addr?.st,
      addr?.loc,
      addr?.city,
      addr?.dst,
      addr?.pncd ? `- ${addr.pncd}` : null,
    ].filter(Boolean)

    // Extract state code from GSTIN (first 2 characters)
    const stateCode = gstin.substring(0, 2)

    return NextResponse.json({
      tradeName: gstData.tradeNam || '',
      legalName: gstData.lgnm || '',
      address: addressParts.join(', '),
      stateCode: stateCode,
      stateName: addr?.stcd || '',
      pincode: addr?.pncd || '',
      status: gstData.sts || '',
      registrationDate: gstData.rgdt || '',
      businessType: gstData.ctb || '',
      dealerType: gstData.dty || '',
    })
  } catch (error) {
    console.error('GST lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch GST details. Please try again.' },
      { status: 500 }
    )
  }
}
