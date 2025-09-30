import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/mobile-responsive.css';
import { ThemeProvider } from '@/context/theme-provider';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
