import type { FormField } from './types'

function normalize(text: string): string {
  return text.replace(/[\s\n\r*:：#：、，,。.]/g, '').toLowerCase()
}

/**
 * 模糊匹配 label
 */
export function matchLabel(target: string, labels: string[]): string | null {
  const n = normalize(target)

  // 精确匹配
  for (const label of labels) {
    if (normalize(label) === n) return label
  }

  // 包含匹配
  for (const label of labels) {
    const nl = normalize(label)
    if (nl.includes(n) || n.includes(nl)) return label
  }

  return null
}

/**
 * 回填单个字段值（直接修改 reactive 数据）
 */
export function fillFieldValue(field: FormField, value: unknown): boolean {
  const item = field._item
  if (!item) return false

  const ct = String(item.componentType || '')

  try {
    switch (ct) {
      case '0': {
        item.value = value
        return true
      }

      case '1': {
        const strValue = String(value ?? '')
        const matched = (item.childrenList || []).find(
          (c: any) => (c.title || c.name || '') === strValue
        )
        if (matched) {
          item.value = matched.title || matched.name || strValue
        } else {
          const fuzzy = (item.childrenList || []).find((c: any) => {
            const t = c.title || c.name || ''
            return normalize(t) === normalize(strValue)
          })
          item.value = fuzzy
            ? fuzzy.title || fuzzy.name || strValue
            : strValue
        }
        return true
      }

      case '2':
      case '4':
      case '7': {
        const values = Array.isArray(value) ? value : [String(value ?? '')]
        const children = item.childrenList || []
        const isChecked: any[] = []
        const checkedTitles: string[] = []

        for (const v of values) {
          const strV = String(v ?? '')
          const matched = children.find((c: any) => (c.title || '') === strV)
          if (matched) {
            matched.isChecked = true
            isChecked.push(matched)
            checkedTitles.push(matched.title || strV)
          }
        }

        item.isChecked = isChecked
        item.value = checkedTitles
        return true
      }

      case '5': {
        item.value = value
        return true
      }

      case '8':
      case '10': {
        if (item.childrenList && item.childrenList.length > 0) {
          if (typeof value === 'object' && value !== null) {
            for (const child of item.childrenList) {
              const childLabel = child.title
              const childValue = (value as Record<string, any>)[childLabel]
              if (childValue !== undefined) {
                child.value = childValue
              }
            }
            return true
          }
          return false
        }
        item.value = value
        return true
      }

      default: {
        console.warn(
          `[VoiceFormFill] Filling unknown componentType: "${ct}", attempting direct value assignment`
        )
        item.value = value
        return true
      }
    }
  } catch (e) {
    console.error(`Fill field "${field.label}" failed:`, e)
    return false
  }
}

/**
 * 根据大模型返回的映射关系，批量回填表单字段
 */
export function fillFormByMapping(
  mapping: Record<string, unknown>,
  fields: FormField[]
): { success: string[]; failed: string[] } {
  const labels = fields.map((f) => f.label)
  const success: string[] = []
  const failed: string[] = []

  for (const [key, value] of Object.entries(mapping)) {
    if (value === null || value === undefined || value === '') continue

    const matchedLabel = matchLabel(key, labels)
    if (!matchedLabel) {
      failed.push(key)
      continue
    }

    const matchedFields = fields.filter((f) => f.label === matchedLabel)
    let anySuccess = false
    for (const field of matchedFields) {
      if (fillFieldValue(field, value)) {
        anySuccess = true
      }
    }

    if (anySuccess) {
      success.push(matchedLabel)
    } else {
      failed.push(key)
    }
  }

  return { success, failed }
}
