import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LanguageProvider } from './contexts/LanguageContext'
import '../styles.css'

const container = document.getElementById('root')!
createRoot(container).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
)
