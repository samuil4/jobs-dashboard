import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { pinia } from './stores'
import { setAuthFatalHandler } from './lib/authRecoveryFetch'
import { useAuthStore } from './stores/auth'

import './assets/main.css'

setAuthFatalHandler(async (client) => {
  await client.auth.signOut({ scope: 'local' })
  const authStore = useAuthStore(pinia)
  authStore.$patch({
    session: null,
    user: null,
    userRole: null,
    clientProfile: null,
    error: null,
  })
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  await router.replace({
    name: path.startsWith('/client') ? 'clientLogin' : 'login',
  })
})

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(i18n)

app.mount('#app')
