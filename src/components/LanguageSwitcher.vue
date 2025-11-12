<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { AVAILABLE_LOCALES, setLocale } from '../i18n'

const { locale, t } = useI18n()

const modelValue = computed({
  get: () => locale.value,
  set: (value: string) => {
    if (value === locale.value) return
    setLocale(value as (typeof AVAILABLE_LOCALES)[number]['code'])
  },
})
</script>

<template>
  <div class="language-switcher">
    <label for="language-select" class="visually-hidden">
      {{ t('common.language') }}
    </label>
    <select id="language-select" v-model="modelValue">
      <option v-for="localeOption in AVAILABLE_LOCALES" :key="localeOption.code" :value="localeOption.code">
        {{ localeOption.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.language-switcher {
  min-width: 120px;
}

.language-switcher select {
  height: 32px;
  padding: 6px 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  width: 100%;
  margin: 0;
}

.language-switcher select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.visually-hidden {
  position: absolute;
  clip: rect(0 0 0 0);
  width: 1px;
  height: 1px;
  margin: -1px;
  border: 0;
  padding: 0;
  overflow: hidden;
}
</style>

