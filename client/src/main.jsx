import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import {
  MesereArteProvider
} from './context/MesereArteContexto.jsx'

createRoot(
  document.getElementById('root')
).render(
  <StrictMode>
    <MesereArteProvider>
      <App />
    </MesereArteProvider>
  </StrictMode>
)