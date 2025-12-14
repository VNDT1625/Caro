export type UsernameValidationError = 'empty' | 'short' | 'long' | 'invalid' | null

const stripDiacritics = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')

/**
 * Chuẩn hóa dữ liệu người dùng nhập và sinh slug không dấu cho cột `username`.
 */
export function normalizeUsernameInput(raw: string) {
  const displayName = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  const slug = stripDiacritics(displayName)
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()

  return { displayName, slug }
}

/**
 * Kiểm tra input, đảm bảo handle không dấu đáp ứng 3-20 ký tự [a-z0-9_].
 */
export function validateUsernameInput(
  raw: string,
  maxLength = 20
): { displayName: string; slug: string; error: UsernameValidationError } {
  const { displayName, slug } = normalizeUsernameInput(raw)

  if (!displayName) return { displayName, slug, error: 'empty' }
  if (displayName.length < 3) return { displayName, slug, error: 'short' }
  if (displayName.length > maxLength) return { displayName, slug, error: 'long' }
  if (slug.length < 3) return { displayName, slug, error: 'invalid' }
  if (slug.length > maxLength) return { displayName, slug, error: 'long' }

  return { displayName, slug, error: null }
}
