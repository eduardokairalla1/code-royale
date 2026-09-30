/**
 * Entry point for the frontend.
 */

// --- IMPORTS ---
import { App } from './app.tsx';
import './styles/global.css';
import './styles/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// --- CODE ---
// mount the app
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
