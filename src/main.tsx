import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Enable React Grab only during development
if (import.meta.env.DEV) {
  import('react-grab')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)