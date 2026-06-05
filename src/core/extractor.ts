import type { FormField } from './types'

/**
 * 从 childrenList 递归提取表单字段结构
 */
export function extractFormStructure(
  childrenList: Record<string, any>[],
  parentTitle?: string
): FormField[] {
  const fields: FormField[] = []

  for (const item of childrenList) {
    const ct = String(item.componentType ?? '')
    const title = parentTitle ? `${parentTitle}-${item.title}` : item.title

    switch (ct) {
      case '0': {
        const isNumber = item.pattern === '5'
        fields.push({
          label: title,
          type: isNumber ? 'number' : 'input',
          _item: item,
        })
        break
      }

      case '1': {
        const options = (item.childrenList || []).map(
          (c: any) => c.title || c.name || ''
        )
        fields.push({
          label: title,
          type: 'select',
          options,
          _item: item,
        })
        break
      }

      case '2':
      case '4':
      case '7': {
        const options = (item.childrenList || []).map(
          (c: any) => c.title || ''
        )
        fields.push({
          label: title,
          type: 'checkbox',
          options,
          _item: item,
        })
        break
      }

      case '5': {
        fields.push({
          label: title,
          type: 'date',
          _item: item,
        })
        break
      }

      case '8':
      case '10': {
        if (item.childrenList?.length) {
          for (const child of item.childrenList) {
            const childTitle = item.title
              ? `${item.title}-${child.title || ''}`
              : child.title || ''
            fields.push({
              label: childTitle,
              type: 'input',
              _item: child,
            })
          }
        }
        break
      }

      default:
        console.warn(
          `[VoiceFormFill] Unknown componentType: "${ct}", title: "${item.title}", treating as input`
        )
        fields.push({
          label: title,
          type: 'input',
          _item: item,
        })
        break
    }
  }

  return fields
}
