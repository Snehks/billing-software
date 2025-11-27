// Convert number to Indian words (Lakhs, Crores system)

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
]

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
]

function convertTwoDigits(num: number): string {
  if (num < 20) {
    return ones[num]
  }
  const ten = Math.floor(num / 10)
  const one = num % 10
  return tens[ten] + (one ? ' ' + ones[one] : '')
}

function convertThreeDigits(num: number): string {
  const hundred = Math.floor(num / 100)
  const rest = num % 100

  if (hundred === 0) {
    return convertTwoDigits(rest)
  }

  return ones[hundred] + ' Hundred' + (rest ? ' ' + convertTwoDigits(rest) : '')
}

export function amountToWords(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only'

  // Handle negative numbers
  if (amount < 0) {
    return 'Minus ' + amountToWords(Math.abs(amount))
  }

  // Split into rupees and paise
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)

  let words = ''

  if (rupees > 0) {
    // Indian numbering: Crore (10^7), Lakh (10^5), Thousand (10^3), Hundred (10^2)
    const crore = Math.floor(rupees / 10000000)
    const lakh = Math.floor((rupees % 10000000) / 100000)
    const thousand = Math.floor((rupees % 100000) / 1000)
    const hundred = rupees % 1000

    const parts: string[] = []

    if (crore > 0) {
      parts.push(convertTwoDigits(crore) + ' Crore')
    }
    if (lakh > 0) {
      parts.push(convertTwoDigits(lakh) + ' Lakh')
    }
    if (thousand > 0) {
      parts.push(convertTwoDigits(thousand) + ' Thousand')
    }
    if (hundred > 0) {
      parts.push(convertThreeDigits(hundred))
    }

    words = parts.join(' ') + ' Rupees'
  }

  if (paise > 0) {
    if (words) {
      words += ' and '
    }
    words += convertTwoDigits(paise) + ' Paise'
  }

  return words + ' Only'
}

// Format number in Indian style (1,23,456.00)
export function formatIndianCurrency(amount: number): string {
  const [rupees, paise] = amount.toFixed(2).split('.')

  // Indian grouping: last 3 digits, then groups of 2
  let result = ''
  const rupeesNum = rupees.replace('-', '')
  const len = rupeesNum.length

  if (len <= 3) {
    result = rupeesNum
  } else {
    result = rupeesNum.slice(-3)
    let remaining = rupeesNum.slice(0, -3)

    while (remaining.length > 0) {
      const group = remaining.slice(-2)
      result = group + ',' + result
      remaining = remaining.slice(0, -2)
    }
  }

  if (amount < 0) {
    result = '-' + result
  }

  return '₹' + result + '.' + paise
}
