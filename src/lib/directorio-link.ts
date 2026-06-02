const GENERIC_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'live.com',
  'icloud.com', 'protonmail.com', 'mail.com', 'aol.com', 'msn.com',
  'ymail.com', 'zoho.com', 'fastmail.com', 'me.com',
])

function extractDomain(url: string): string {
  try {
    const cleaned = url.startsWith('http') ? url : `https://${url}`
    return new URL(cleaned).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return url.toLowerCase().replace(/^www\./, '')
  }
}

export function findEmpresaMatch(
  email: string | undefined | null,
  companyRaw: string | undefined | null,
  empresas: Array<{ id: string; name: string; website: string | null }>
): string | null {
  // 1. Email domain match (skip generic providers)
  if (email?.includes('@')) {
    const domain = email.split('@')[1]?.toLowerCase()
    if (domain && !GENERIC_DOMAINS.has(domain)) {
      const match = empresas.find(e => {
        if (!e.website) return false
        return extractDomain(e.website) === domain
      })
      if (match) return match.id
    }
  }

  // 2. Fuzzy name match
  if (companyRaw?.trim()) {
    const norm = companyRaw.toLowerCase().trim()
    const exact = empresas.find(e => e.name.toLowerCase().trim() === norm)
    if (exact) return exact.id

    const contains = empresas.find(e => {
      const cn = e.name.toLowerCase()
      return cn.includes(norm) || norm.includes(cn)
    })
    if (contains) return contains.id

    const words = norm.split(/[\s\-_,./]+/).filter(w => w.length >= 4)
    if (words.length > 0) {
      const overlap = empresas.find(e => {
        const eWords = e.name.toLowerCase().split(/[\s\-_,./]+/)
        return words.some(w => eWords.includes(w))
      })
      if (overlap) return overlap.id
    }
  }

  return null
}
