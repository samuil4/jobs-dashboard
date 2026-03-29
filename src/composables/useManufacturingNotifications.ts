import { onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { supabase } from '../lib/supabase'
import type { JobUpdateRecord, UpdateType } from '../types/job'
import { useAuthStore } from '../stores/auth'
import { useJobsStore } from '../stores/jobs'

export function useManufacturingNotifications() {
  const { t } = useI18n()
  const authStore = useAuthStore()
  const jobsStore = useJobsStore()

  let channel: ReturnType<typeof supabase.channel> | null = null

  function getJobName(jobId: string): string {
    const job = jobsStore.jobs.find((j) => j.id === jobId)
    return job?.name ?? jobId
  }

  function handleInsert(payload: { new: JobUpdateRecord }) {
    const record = payload.new
    const updateType = (record.update_type ?? 'production') as UpdateType
    const jobName = getJobName(record.job_id)
    const delta = record.delta ?? 0

    // Skip if the current user made this update
    if (authStore.userId && record.updated_by === authStore.userId) {
      return
    }

    let message: string
    switch (updateType) {
      case 'production':
        message = t('notifications.production', { name: jobName, delta })
        toast.success(message)
        break
      case 'delivery':
        message = t('notifications.delivery', { name: jobName, delta })
        toast.success(message)
        break
      case 'failed_production':
        message = t('notifications.failedProduction', { name: jobName, delta })
        toast.error(message)
        break
      default:
        message = t('notifications.production', { name: jobName, delta })
        toast.info(message)
    }

    // Merge new update into jobs store if job exists
    const job = jobsStore.jobs.find((j) => j.id === record.job_id)
    if (job) {
      const newUpdate: JobUpdateRecord = {
        id: record.id,
        job_id: record.job_id,
        delta: record.delta,
        update_type: record.update_type,
        created_at: record.created_at,
        updated_by: record.updated_by,
        note: record.note,
      }
      jobsStore.mergeJobUpdate(record.job_id, newUpdate)
    }
  }

  function subscribe() {
    if (channel) return
    if (!authStore.isAuthenticated || authStore.isClient) return
    channel = supabase
      .channel('job-updates')
      .on(
        'postgres_changes',
        {
          schema: 'public',
          table: 'job_updates',
          event: 'INSERT',
        },
        handleInsert
      )
      .subscribe()
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  let stopWatch: (() => void) | null = null

  onMounted(() => {
    subscribe()
    stopWatch = watch(
      () => [authStore.isAuthenticated, authStore.userRole] as const,
      ([isAuth, userRole]) => {
        if (isAuth && userRole === 'staff') {
          subscribe()
        } else {
          unsubscribe()
        }
      }
    )
  })

  onUnmounted(() => {
    stopWatch?.()
    unsubscribe()
  })
}
