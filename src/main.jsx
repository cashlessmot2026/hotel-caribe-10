import React from 'react'
import ReactDOM from 'react-dom/client'
import { DataProvider } from './store.jsx'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </React.StrictMode>
)
