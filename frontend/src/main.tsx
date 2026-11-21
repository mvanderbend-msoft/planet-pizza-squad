import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { CartProvider } from './context/CartContext';
import { DailyPromotionProvider } from './context/DailyPromotionContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DailyPromotionProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </DailyPromotionProvider>
    </BrowserRouter>
  </React.StrictMode>
);
