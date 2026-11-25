import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import './index.css'
import App from './App.jsx'
import { applyTheme, watchSystemTheme } from './lib/theme.js'

applyTheme()
watchSystemTheme()

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist()
}

if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
  const check = () => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {})
  window.addEventListener('focus', check)
  setInterval(check, 30 * 60 * 1000)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
