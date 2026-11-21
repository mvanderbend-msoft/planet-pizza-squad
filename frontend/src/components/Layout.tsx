import { Link, NavLink, Outlet } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function Layout() {
  const { totalCount } = useCart();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10 shadow-soft">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-black text-alien-700">
            <img src="/images/ufo.svg" alt="" className="h-8 w-8" />
            PLANET&nbsp;PIZZA
          </Link>
          <nav className="flex items-center gap-6 font-display uppercase text-sm tracking-wider">
            <NavLink to="/pizzas" className={navClass}>Pizzas</NavLink>
            <NavLink to="/merch" className={navClass}>Merch</NavLink>
            <NavLink to="/cart" className={navClass}>
              Cart {totalCount > 0 && <span className="ml-1 rounded-full bg-alien-600 px-2 py-0.5 text-xs text-white">{totalCount}</span>}
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 font-mono">
        Planet Pizza Co. · Area 51 HQ · This site doesn't officially exist 👽
      </footer>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return `transition hover:text-alien-600 ${isActive ? 'text-alien-700' : 'text-slate-600'}`;
}
