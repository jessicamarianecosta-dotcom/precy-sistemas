export interface BudgetItemFile {
  id: string
  budget_item_id: string
  budget_id: string
  company_id: string
  file_name: string
  file_url: string
  file_path: string
  file_size: number
  mime_type: string | null
  created_at: string
  updated_at: string
}
