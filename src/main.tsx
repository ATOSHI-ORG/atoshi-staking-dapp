import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './i18n/LanguageContext.tsx';
import { WalletProvider } from './wallet/WalletProvider.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </WalletProvider>
  </StrictMode>,
);

