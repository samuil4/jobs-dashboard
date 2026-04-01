export type Assignee = 'Samuil' | 'Oleksii' | 'Veselin'

export type JobStatus = 'active' | 'completed' | 'archived'

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface JobRecord {
  id: string
  name: string
  parts_needed: number
  parts_produced: number
  parts_overproduced: number
  notes: string | null
  delivered: number
  parts_failed: number
  archived: boolean
  status: JobStatus
  priority: JobPriority
  assignee: Assignee
  created_at: string
  updated_at: string
  client_id: string | null
  client?: {
    id: string
    username: string
    company_name: string
  } | null
  has_share_password?: boolean
}

export interface JobWithHistory extends JobRecord {
  job_updates: JobUpdateRecord[]
}

export type UpdateType = 'production' | 'delivery' | 'failed_production'

export interface JobUpdateRecord {
  id: string
  job_id: string
  delta: number
  update_type?: UpdateType
  created_at: string
  updated_by?: string | null
  note?: string | null
}

export interface NewJobPayload {
  name: string
  partsNeeded: number
  assignee: Assignee
  priority: JobPriority
  clientId?: string | null
  sharePassword?: string | null
}

export interface UpdateJobPayload {
  name: string
  partsNeeded: number
  assignee: Assignee
  priority: JobPriority
  clientId?: string | null
  sharePassword?: string | null
}

export interface JobShareData {
  id: string
  name: string
  parts_needed: number
  parts_produced: number
  parts_overproduced: number
  delivered: number
}

