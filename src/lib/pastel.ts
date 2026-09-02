export interface PastelSpec { bg: string; fg: string; border: string; name: string }

export const PASTEL: Record<string, PastelSpec> = {
  'pastel-blue-purple': { bg: '#D8D5FA', fg: '#5C5CE0', border: '#C8C2F0', name: '蓝紫' },
  'pastel-blue':        { bg: '#D5E0FA', fg: '#2563EB', border: '#BDD0F0', name: '浅蓝' },
  'pastel-green':       { bg: '#D8EFD5', fg: '#16A34A', border: '#BCE0B5', name: '浅绿' },
  'pastel-mint':        { bg: '#D5F0EA', fg: '#0D9488', border: '#B5E0D5', name: '薄荷' },
  'pastel-pink':        { bg: '#FBD5DC', fg: '#EC4899', border: '#F0BCC8', name: '浅粉' },
  'pastel-orange':      { bg: '#FCE5D2', fg: '#EA580C', border: '#F0CBB0', name: '浅橙' },
  'pastel-yellow':      { bg: '#FAEFD5', fg: '#CA8A04', border: '#EFD9B0', name: '浅黄' },
  'pastel-lavender':    { bg: '#EFE5FA', fg: '#9333EA', border: '#D8C8F0', name: '薰衣草' },
  'pastel-warmgray':    { bg: '#E5E0D5', fg: '#78716C', border: '#D0C8B5', name: '暖灰' },
  'pastel-gray':        { bg: '#E5E5EA', fg: '#52525B', border: '#D0D0D8', name: '中灰' },
}

export const PASTEL_KEYS = Object.keys(PASTEL)
export function getPastel(key?: string | null): PastelSpec {
  return PASTEL[key || 'pastel-blue-purple'] || PASTEL['pastel-blue-purple']
}