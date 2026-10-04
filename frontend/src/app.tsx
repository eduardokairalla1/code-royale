/**
 * Application routes.
 */

// --- IMPORTS ---
import { Button } from './components/button/button.tsx';
import { Notice } from './components/notice/notice.tsx';
import { HomePage } from './modules/home/home.page.tsx';
import { RoomPage } from './modules/room/room.page.tsx';
import { BrowserRouter } from 'react-router';
import { Route } from 'react-router';
import { Routes } from 'react-router';
import { useNavigate } from 'react-router';

// --- CODE ---
/**
 * Render the application.
 *
 * @returns {JSX.Element} The router with every page.
 */
export function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:code" element={<RoomPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Render the page shown for unknown urls.
 *
 * @returns {JSX.Element} The not found notice.
 */
function NotFoundPage() {

  const navigate = useNavigate();

  return (
    <Notice
      title="Page not found"
      actions={<Button onClick={() => navigate('/')}>Back to home</Button>}
    >
      This path does not lead to any room.
    </Notice>
  );
}
