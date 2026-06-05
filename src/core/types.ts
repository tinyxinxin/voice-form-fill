/**
 * 表单字段元数据（传给大模型）
 */
export interface FieldMeta {
  label: string
  type: 'input' | 'number' | 'select' | 'checkbox' | 'date'
  options?: string[]
}

/**
 * 表单字段（含原始对象引用，用于回填）
 */
export interface FormField extends FieldMeta {
  _item: Record<string, any>
}

/**
 * 填充结果
 */
export interface FillResult {
  success: string[]
  failed: string[]
}
