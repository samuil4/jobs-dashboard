export interface ClientRecord {
  id: string
  auth_user_id: string
  username: string
  company_name: string
  created_at: string
  updated_at: string
}

export interface ClientSummary extends ClientRecord {
  completed_jobs: number
  jobs_in_production: number
  unstarted_jobs: number
}

export interface ClientFormPayload {
  username: string
  companyName: string
  password?: string | null
}

export interface ClientJobRecord {
  id: string
  name: string
  parts_needed: number
  parts_produced: number
  parts_overproduced: number
  delivered: number
  archived: boolean
  status: 'active' | 'completed' | 'archived'
  updated_at: string
}
