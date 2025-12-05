import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Maintenance from './Maintenance.jsx'

const isMaintenance =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.VITE_MAINTENANCE_MODE === 'true'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isMaintenance ? <Maintenance /> : <App />}
  </StrictMode>,
)
