import { useCart } from '../context/CartContext';

export default function CartPricingNotice() {
  const { pricingStatus, refreshPricing } = useCart();
  if (pricingStatus === 'ready') return null;
  return (
    <div role="status" className="my-4 text-sm text-slate-700">
      {pricingStatus === 'loading' ? 'Verifying pizza prices… Totals are provisional.' :
        pricingStatus === 'base' ? 'Daily offer unavailable: fewer than two pizzas. Reviewed base prices apply.' :
        'Pizza pricing unavailable. Totals are provisional; retry before paying.'}
      {pricingStatus === 'unavailable' && (
        <button type="button" className="btn-secondary ml-3" onClick={() => void refreshPricing()}>
          Retry pricing
        </button>
      )}
    </div>
  );
}
