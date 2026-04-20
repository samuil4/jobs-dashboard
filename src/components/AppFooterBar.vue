<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import AppVersionLine from './AppVersionLine.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import { useClientWebPush } from '../composables/useClientWebPush'
import { useAppVersion } from '../composables/useAppVersion'
import { usePwaInstall } from '../composables/usePwaInstall'
import { useShareWebPush } from '../composables/useShareWebPush'
import { useWebPush } from '../composables/useWebPush'
import { useAuthStore } from '../stores/auth'

const props = withDefaults(
  defineProps<{
    pushMode?: 'auth' | 'share' | 'client'
    shareJobId?: string
    shareToken?: string | null
    showLogout?: boolean
    showLeaveShare?: boolean
  }>(),
  {
    pushMode: 'auth',
    showLogout: true,
    showLeaveShare: false,
  },
)

const emit = defineEmits<{
  leaveShare: []
}>()

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

const { canInstall, isInstalled, isInstalling, install } = usePwaInstall()
const { hasUpdate, isRefreshing: isRefreshingApp, updateCurrentLabel, updateNextLabel, refreshApp } = useAppVersion()

const {
  isSupported: webPushSupported,
  isSubscribed: webPushSubscribed,
  isSubscribing: webPushSubscribing,
  error: webPushError,
  subscribe: subscribeWebPush,
  checkSubscription: checkWebPushSubscription,
} = useWebPush()

const {
  isSupported: sharePushSupported,
  isSubscribed: sharePushSubscribed,
  isSubscribing: sharePushSubscribing,
  error: sharePushError,
  subscribe: subscribeSharePush,
  checkSubscription: checkSharePushSubscription,
} = useShareWebPush()

const {
  isSupported: clientPushSupported,
  isSubscribed: clientPushSubscribed,
  isSubscribing: clientPushSubscribing,
  error: clientPushError,
  subscribe: subscribeClientPush,
  checkSubscription: checkClientPushSubscription,
} = useClientWebPush()

function refreshPushState() {
  if (props.pushMode === 'auth' && webPushSupported.value) {
    checkWebPushSubscription()
  } else if (props.pushMode === 'client' && clientPushSupported.value) {
    checkClientPushSubscription()
  } else if (props.pushMode === 'share' && sharePushSupported.value) {
    checkSharePushSubscription()
  }
}

onMounted(() => {
  refreshPushState()
})

watch(
  () => [props.pushMode, props.shareJobId, props.shareToken] as const,
  () => {
    refreshPushState()
  },
)

async function handleEnablePush() {
  if (props.pushMode === 'auth') {
    const ok = await subscribeWebPush()
    if (!ok) {
      if (webPushError.value) {
        toast.error(webPushError.value)
      } else {
        toast.error(t('webPush.failed'))
      }
    } else {
      toast.success(t('webPush.enabled'))
    }
    return
  }
  if (props.pushMode === 'client') {
    const ok = await subscribeClientPush()
    if (!ok) {
      if (clientPushError.value) {
        toast.error(clientPushError.value)
      } else {
        toast.error(t('webPush.failed'))
      }
    } else {
      toast.success(t('webPush.enabled'))
    }
    return
  }
  const jid = props.shareJobId
  const tok = props.shareToken
  if (!jid || !tok) return
  const ok = await subscribeSharePush(jid, tok)
  if (!ok) {
    if (sharePushError.value) {
      toast.error(sharePushError.value)
    } else {
      toast.error(t('webPush.failed'))
    }
  } else {
    toast.success(t('webPush.enabled'))
  }
}

async function handleLogout() {
  const redirectName = authStore.isClient ? 'clientLogin' : 'login'
  await authStore.signOut()
  router.push({ name: redirectName })
}

const showAuthPushButton = computed(
  () =>
    props.pushMode === 'auth' &&
    webPushSupported.value &&
    !webPushSubscribed.value,
)

const showSharePushButton = computed(
  () =>
    props.pushMode === 'share' &&
    sharePushSupported.value &&
    !sharePushSubscribed.value &&
    Boolean(props.shareToken),
)

const showClientPushButton = computed(
  () =>
    props.pushMode === 'client' &&
    clientPushSupported.value &&
    !clientPushSubscribed.value &&
    authStore.isClient,
)

const showVersionUpdate = computed(() => hasUpdate.value)
</script>

<template>
  <footer class="app-footer">
    <div class="footer-content">
      <div v-if="showVersionUpdate" class="update-banner">
        <div class="update-copy">
          <strong>{{ t('pwa.updateAvailableTitle') }}</strong>
          <span>
            {{
              t('pwa.updateAvailableMessage', {
                current: updateCurrentLabel,
                next: updateNextLabel,
              })
            }}
          </span>
        </div>
        <button
          class="btn btn-compact btn-primary"
          :class="{ 'is-loading': isRefreshingApp }"
          type="button"
          :disabled="isRefreshingApp"
          @click="refreshApp"
        >
          {{ isRefreshingApp ? t('common.loading') + '…' : t('pwa.updateNow') }}
        </button>
      </div>
      <AppVersionLine />
      <div class="footer-actions">
        <LanguageSwitcher />
        <button
          v-if="canInstall && !isInstalled"
          class="btn btn-compact btn-secondary"
          type="button"
          :disabled="isInstalling"
          @click="install"
        >
          {{ isInstalling ? t('pwa.installing') : t('pwa.install') }}
        </button>
        <button
          v-if="showAuthPushButton"
          class="btn btn-compact btn-secondary"
          type="button"
          :disabled="webPushSubscribing"
          :title="webPushError ?? undefined"
          @click="handleEnablePush"
        >
          {{ webPushSubscribing ? t('webPush.enabling') : t('webPush.enable') }}
        </button>
        <button
          v-if="showClientPushButton"
          class="btn btn-compact btn-secondary"
          type="button"
          :disabled="clientPushSubscribing"
          :title="clientPushError ?? undefined"
          @click="handleEnablePush"
        >
          {{ clientPushSubscribing ? t('webPush.enabling') : t('webPush.enable') }}
        </button>
        <button
          v-if="showSharePushButton"
          class="btn btn-compact btn-secondary"
          type="button"
          :disabled="sharePushSubscribing"
          :title="sharePushError ?? undefined"
          @click="handleEnablePush"
        >
          {{ sharePushSubscribing ? t('webPush.enabling') : t('webPush.enable') }}
        </button>
        <button
          v-if="showLeaveShare"
          class="btn btn-compact btn-secondary"
          type="button"
          @click="emit('leaveShare')"
        >
          {{ t('share.leaveSession') }}
        </button>
        <button
          v-if="showLogout"
          class="btn btn-compact btn-secondary"
          type="button"
          @click="handleLogout"
        >
          {{ t('auth.logout') }}
        </button>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  min-height: 48px;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  z-index: 100;
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.1);
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  height: 100%;
}

.update-banner {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  background: #eff6ff;
}

.update-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #1e3a8a;
}

.update-copy strong {
  font-size: 13px;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

@media (max-width: 768px) {
  .update-banner {
    align-items: stretch;
    flex-direction: column;
  }

  .btn-compact {
    font-size: 12px;
    padding: 6px 10px;
    white-space: nowrap;
  }

  .footer-content {
    gap: 8px;
  }

  .footer-actions {
    gap: 8px;
  }

  .language-switcher {
    min-width: 100px;
  }
}

@media (max-width: 640px) {
  .btn-compact {
    font-size: 11px;
    padding: 5px 8px;
  }
}
</style>
