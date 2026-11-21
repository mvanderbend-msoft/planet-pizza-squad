import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/pizzas" element={<CatalogPage category="pizza" title="Pizza Transmissions" subtitle="hand-tossed in hangar 18" />} />
        <Route path="/merch" element={<CatalogPage category="merch" title="Earthling Merchandise" subtitle="declassified gear" />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order/:id" element={<OrderConfirmationPage />} />
        <Route path="*" element={<p className="text-center text-slate-500 py-20">404 — signal lost.</p>} />
      </Route>
    </Routes>
  );
}
