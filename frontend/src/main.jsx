import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import App from './App'
import './index.css'
import { prefijoActual } from './utils/wafPrefix'

dayjs.locale('es')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={esES} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <BrowserRouter basename={prefijoActual() || '/'}>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
)
