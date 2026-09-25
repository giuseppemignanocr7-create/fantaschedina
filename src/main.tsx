import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initMonitoring } from './lib/monitoring'
import { installaRicaricaChunk } from './lib/chunkReload'
import './index.css'

// Prima del render: così anche un errore in fase di avvio viene registrato.
initMonitoring()
// Dopo un rilascio, chi aveva l'app aperta chiede pezzi che non ci sono più:
// si ricarica la pagina (una volta sola) invece di mostrare un errore.
installaRicaricaChunk()

// Il CSS dei font è in index.html con media="print", così non blocca il primo
// disegno: il testo compare subito con il font di sistema. Qui, quando il
// bundle è arrivato, lo si accende. Non si può fare con un onload inline:
// la CSP di produzione non ammette script inline.
document.getElementById('font-css')?.setAttribute('media', 'all')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
