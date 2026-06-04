import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Apply initial dark mode
if (localStorage.getItem('app_theme') === 'dark') {
  document.documentElement.classList.add('dark');
}
if (localStorage.getItem('app_lang') === 'en') {
  document.documentElement.dir = 'ltr';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
