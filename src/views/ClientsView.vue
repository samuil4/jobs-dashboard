<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConfirmModal from '../components/ConfirmModal.vue'
import ClientFormModal from '../components/clients/ClientFormModal.vue'
import { useClientsStore } from '../stores/clients'

const clientsStore = useClientsStore()
const { t } = useI18n()

const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const editingClientId = ref<string | null>(null)
const modalSubmitting = ref(false)
const deletingClientId = ref<string | null>(null)
const deleteModal = reactive({
  show: false,
  clientId: null as string | null,
  companyName: '',
})

const modalInitialValues = computed(() => {
  if (!editingClientId.value) return undefined
  const client = clientsStore.clients.find((item) => item.id === editingClientId.value)
  if (!client) return undefined
  return {
    username: client.username,
    companyName: client.company_name,
  }
})

onMounted(async () => {
  await clientsStore.fetchClients()
})

function openCreateModal() {
  modalMode.value = 'create'
  editingClientId.value = null
  showModal.value = true
}

const openCreateClientModalRef = inject<Ref<(() => void) | null>>('openCreateClientModal')
if (openCreateClientModalRef) {
  openCreateClientModalRef.value = openCreateModal
}

function openEditModal(clientId: string) {
  modalMode.value = 'edit'
  editingClientId.value = clientId
  showModal.value = true
}

async function handleModalSubmit(payload: {
  username: string
  companyName: string
  password?: string | null
}) {
  if (modalSubmitting.value) return

  modalSubmitting.value = true
  try {
    if (modalMode.value === 'create') {
      await clientsStore.createClient(payload)
    } else if (editingClientId.value) {
      await clientsStore.updateClient(editingClientId.value, payload)
    }
    showModal.value = false
  } catch (err) {
    console.error(err)
    alert(t(modalMode.value === 'create' ? 'errors.createClient' : 'errors.updateClient'))
  } finally {
    modalSubmitting.value = false
  }
}

function handleDelete(clientId: string) {
  const client = clientsStore.clients.find((item) => item.id === clientId)
  if (!client) return
  deleteModal.clientId = clientId
  deleteModal.companyName = client.company_name
  deleteModal.show = true
}

function closeDeleteModal() {
  deleteModal.show = false
  deleteModal.clientId = null
  deleteModal.companyName = ''
}

async function confirmDelete() {
  if (!deleteModal.clientId || deletingClientId.value) return

  deletingClientId.value = deleteModal.clientId
  try {
    await clientsStore.deleteClient(deleteModal.clientId)
    closeDeleteModal()
  } catch (err) {
    console.error(err)
    alert(t('errors.deleteClient'))
  } finally {
    deletingClientId.value = null
  }
}
</script>

<template>
  <section class="clients-page">
    <div class="page-header">
      <div>
        <h1>{{ t('clients.heading') }}</h1>
        <p class="page-subtitle">{{ t('clients.subtitle') }}</p>
      </div>
      <button class="btn btn-primary" type="button" :disabled="modalSubmitting" @click="openCreateModal">
        {{ t('clients.addClient') }}
      </button>
    </div>

    <div v-if="clientsStore.loading" class="card state">
      {{ t('common.loading') }}…
    </div>

    <div v-else-if="clientsStore.error" class="card state error">
      {{ t('errors.loadClients') }}
    </div>

    <div v-else-if="clientsStore.clients.length === 0" class="card state">
      {{ t('clients.empty') }}
    </div>

    <div v-else class="card table-card">
      <div class="table-wrap">
        <table class="clients-table">
          <thead>
            <tr>
              <th>{{ t('clients.username') }}</th>
              <th>{{ t('clients.companyName') }}</th>
              <th>{{ t('clients.completedJobs') }}</th>
              <th>{{ t('clients.jobsInProduction') }}</th>
              <th>{{ t('clients.unstartedJobs') }}</th>
              <th>{{ t('clients.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="client in clientsStore.clients" :key="client.id">
              <td>{{ client.username }}</td>
              <td>{{ client.company_name }}</td>
              <td>{{ client.completed_jobs }}</td>
              <td>{{ client.jobs_in_production }}</td>
              <td>{{ client.unstarted_jobs }}</td>
              <td class="actions-cell">
                <button
                  class="btn btn-secondary btn-compact"
                  :disabled="deletingClientId === client.id"
                  type="button"
                  @click="openEditModal(client.id)"
                >
                  {{ t('common.edit') }}
                </button>
                <button
                  class="btn btn-danger btn-compact"
                  :class="{ 'is-loading': deletingClientId === client.id }"
                  :disabled="deletingClientId === client.id"
                  type="button"
                  @click="handleDelete(client.id)"
                >
                  {{ deletingClientId === client.id ? t('common.deleting') : t('common.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ClientFormModal
      :show="showModal"
      :mode="modalMode"
      :submitting="modalSubmitting"
      :initial-values="modalInitialValues"
      @close="showModal = false"
      @submit="handleModalSubmit"
    />

    <ConfirmModal
      :show="deleteModal.show"
      :title="t('clients.deleteTitle')"
      :description="t('clients.deleteMessage', { name: deleteModal.companyName })"
      :confirm-label="t('common.delete')"
      confirm-variant="danger"
      :confirming="deletingClientId !== null"
      @cancel="closeDeleteModal"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.clients-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-header h1 {
  margin: 0;
  font-size: 28px;
}

.page-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
}

.state {
  text-align: center;
  padding: 32px;
  font-size: 16px;
}

.state.error {
  color: #dc2626;
}

.table-card {
  padding: 0;
  overflow: hidden;
}

.table-wrap {
  overflow-x: auto;
}

.clients-table {
  width: 100%;
  border-collapse: collapse;
}

.clients-table th,
.clients-table td {
  padding: 16px 20px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.clients-table th {
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6b7280;
  background: #f9fafb;
}

.actions-cell {
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
  }
}
</style>
