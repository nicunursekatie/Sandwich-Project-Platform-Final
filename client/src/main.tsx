import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from '@/context/theme-provider';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
// Force rebuild Wed Oct  1 09:45:56 PM UTC 2025
