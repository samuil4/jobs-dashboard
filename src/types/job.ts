export type Assignee = 'Samuil' | 'Oleksii' | 'Veselin'

export type JobStatus = 'active' | 'completed' | 'archived'

export interface JobRecord {
  id: string
  name: string
  parts_needed: number
  parts_produced: number
  parts_overproduced: number
  archived: boolean
  status: JobStatus
  assignee: Assignee
  created_at: string
  updated_at: string
}

export interface JobWithHistory extends JobRecord {
  job_updates: JobUpdateRecord[]
}

export interface JobUpdateRecord {
  id: string
  job_id: string
  delta: number
  created_at: string
  updated_by?: string | null
  note?: string | null
}

export interface NewJobPayload {
  name: string
  partsNeeded: number
  assignee: Assignee
}

export interface UpdateJobPayload {
  name: string
  partsNeeded: number
  assignee: Assignee
}

