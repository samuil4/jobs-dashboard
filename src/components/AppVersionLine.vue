<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { shortBuildId } from '../composables/useAppVersion'

const { t } = useI18n()

const appVersion = __APP_VERSION__
const buildIdShort = shortBuildId(__APP_BUILD_ID__)
</script>

<template>
  <span
    class="app-version"
    :title="`${t('common.version')} ${appVersion} (${buildIdShort})`"
  >
    v{{ appVersion }} ({{ buildIdShort }})
  </span>
</template>

<style scoped>
.app-version {
  font-size: 12px;
  color: #6b7280;
  flex-shrink: 0;
}
</style>
