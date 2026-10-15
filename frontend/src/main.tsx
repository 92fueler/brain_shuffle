import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try {
  const savedCodeFs = localStorage.getItem('preferred_scratchpad_font_size');
  if (savedCodeFs) {
    const parsed = parseFloat(savedCodeFs);
    if (!isNaN(parsed) && parsed >= 9.5 && parsed <= 16) {
      document.documentElement.style.setProperty('--scratchpad-code-font-size', `${parsed}px`);
    }
  }
} catch {
  // Ignore storage access errors
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
