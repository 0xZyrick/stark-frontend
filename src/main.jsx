import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './style.css'
import { PrivyProvider } from './privy'

ReactDOM.createRoot(document.getElementById('root')).render(
  <PrivyProvider>
    <App />
  </PrivyProvider>
)
