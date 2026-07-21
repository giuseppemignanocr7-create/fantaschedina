import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Coins, Truck, ShieldCheck, Star, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/contexts/AuthContext';

interface Product {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  price: number;
  category: 'magliette' | 'gadget' | 'accessori';
  badge?: string;
  colors?: string[];
  sizes?: string[];
  inStock: boolean;
}

const PRODUCTS: Product[] = [
  // Magliette
  {
    id: 'tee-classic',
    emoji: '👕',
    name: 'Maglietta Classic',
    desc: '100% cotone biologico. Logo ricamato sul petto.',
    price: 24.90,
    category: 'magliette',
    badge: 'BESTSELLER',
    colors: ['#080c18', '#ffffff', '#84d80c', '#0f1726'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    inStock: true,
  },
  {
    id: 'tee-gold',
    emoji: '👕',
    name: 'Maglietta Gold Edition',
    desc: 'Edizione limitata con stampa dorata. Solo 100 pezzi.',
    price: 34.90,
    category: 'magliette',
    badge: 'LIMITED',
    colors: ['#080c18', '#fbbf24'],
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
  },
  {
    id: 'tee-away',
    emoji: '👕',
    name: 'Maglietta Away Kit',
    desc: 'Versione bianca con dettagli lime. Perfetta per le sfide.',
    price: 27.90,
    category: 'magliette',
    colors: ['#ffffff', '#080c18'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    inStock: true,
  },
  // Gadget
  {
    id: 'mug',
    emoji: '☕',
    name: 'Tazza Fantaschedina',
    desc: 'Ceramica 350ml. Logo su entrambi i lati.',
    price: 12.90,
    category: 'gadget',
    colors: ['#080c18', '#ffffff'],
    inStock: true,
  },
  {
    id: 'keyring',
    emoji: '🔑',
    name: 'Portachiavi Pallone',
    desc: 'Portachiavi in metallo a forma di pallone.',
    price: 7.90,
    category: 'gadget',
    inStock: true,
  },
  {
    id: 'scarf',
    emoji: '🧣',
    name: 'Sciarpa Sostenitore',
    desc: 'Sciarpa in pile, due colori. Perfetta per le serate di match.',
    price: 19.90,
    category: 'gadget',
    badge: 'NOVITÀ',
    colors: ['#84d80c', '#080c18'],
    inStock: true,
  },
  {
    id: 'ball',
    emoji: '⚽',
    name: 'Pallone Ufficiale',
    desc: 'Riproduzione del pallone da gioco. Taglia 5.',
    price: 29.90,
    category: 'gadget',
    inStock: false,
  },
  // Accessori
  {
    id: 'cap',
    emoji: '🧢',
    name: 'Cappellino Snapback',
    desc: 'Cappellino regolabile con logo ricamato.',
    price: 16.90,
    category: 'accessori',
    colors: ['#080c18', '#ffffff', '#84d80c'],
    inStock: true,
  },
  {
    id: 'bottle',
    emoji: '🍶',
    name: 'Borraccia 750ml',
    desc: 'Acciaio inox, mantiene temperatura 12h.',
    price: 14.90,
    category: 'accessori',
    colors: ['#080c18', '#84d80c'],
    inStock: true,
  },
  {
    id: 'phonecase',
    emoji: '📱',
    name: 'Cover Phone',
    desc: 'Cover rigida compatibile con iPhone e Samsung.',
    price: 11.90,
    category: 'accessori',
    badge: 'POPOLARE',
    inStock: true,
  },
];

const CATEGORIES = [
  { id: 'all', label: 'Tutti', icon: '🛍️' },
  { id: 'magliette', label: 'Magliette', icon: '👕' },
  { id: 'gadget', label: 'Gadget', icon: '🎁' },
  { id: 'accessori', label: 'Accessori', icon: '🧢' },
] as const;

export function NegozioPage() {
  const { profile } = useAuthContext();
  const [category, setCategory] = useState<string>('all');
  const [cart, setCart] = useState<Record<string, number>>({});

  const filtered = category === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.category === category);
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = PRODUCTS.find(x => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  const addToCart = (id: string) => setCart(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const removeFromCart = (id: string) => setCart(c => {
    const next = { ...c };
    if (next[id] > 1) next[id]--;
    else delete next[id];
    return next;
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/" className="p-2 text-white/40 hover:text-white transition-colors -ml-2">
              <ArrowLeft size={20} />
            </Link>
            <ShoppingBag size={22} className="text-primary-400" />
            <h1 className="page-title">NEGOZIO</h1>
          </div>
          {profile && (
            <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-xl">
              <Coins size={14} className="text-yellow-400" />
              <span className="font-black text-sm text-yellow-400">{profile.coins ?? 0}</span>
            </div>
          )}
        </div>

        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-primary-600/20 via-primary-500/10 to-transparent border border-primary-500/20">
          <div className="absolute -right-4 -top-4 text-8xl opacity-15 select-none">🛍️</div>
          <div className="relative z-10 space-y-1">
            <h2 className="font-display font-black text-2xl text-white uppercase">Gear Ufficiale</h2>
            <p className="text-sm text-white/60">Magliette, gadget e accessori per veri tifosi</p>
          </div>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Truck, label: 'Spedizione 48h' },
            { icon: ShieldCheck, label: 'Pagamento sicuro' },
            { icon: Star, label: 'Qualità garantita' },
          ].map(t => (
            <div key={t.label} className="glass-card p-3 flex flex-col items-center gap-1 text-center">
              <t.icon size={18} className="text-primary-400" />
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wide">{t.label}</span>
            </div>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide whitespace-nowrap transition-all',
                category === c.id
                  ? 'bg-primary-500 text-background shadow-lg shadow-primary-500/25'
                  : 'bg-surface border border-white/8 text-white/50 hover:text-white hover:border-white/20'
              )}
            >
              <span>{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(p => (
            <div
              key={p.id}
              className={cn(
                'glass-card p-4 space-y-3 transition-all',
                !p.inStock && 'opacity-50 grayscale'
              )}
            >
              {/* Badge */}
              {p.badge && (
                <span className={cn(
                  'absolute top-3 right-3 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md',
                  p.badge === 'BESTSELLER' && 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
                  p.badge === 'LIMITED' && 'bg-red-500/20 text-red-400 border border-red-500/30',
                  p.badge === 'NOVITÀ' && 'bg-primary-500/20 text-primary-400 border border-primary-500/30',
                  p.badge === 'POPOLARE' && 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                )}>
                  {p.badge}
                </span>
              )}

              {/* Product emoji */}
              <div className="text-5xl text-center py-2 select-none">{p.emoji}</div>

              {/* Info */}
              <div className="space-y-1">
                <h3 className="font-display font-black text-sm text-white leading-tight">{p.name}</h3>
                <p className="text-[11px] text-white/45 leading-snug">{p.desc}</p>
              </div>

              {/* Colors */}
              {p.colors && p.colors.length > 0 && (
                <div className="flex gap-1.5">
                  {p.colors.map(c => (
                    <span
                      key={c}
                      className="w-4 h-4 rounded-full border border-white/20"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              )}

              {/* Price + cart */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-black text-lg text-primary-400">€{p.price.toFixed(2)}</span>

                {p.inStock ? (
                  cart[p.id] ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeFromCart(p.id)}
                        className="w-7 h-7 rounded-lg bg-surface border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/20 transition-all"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-black text-sm text-white w-5 text-center">{cart[p.id]}</span>
                      <button
                        onClick={() => addToCart(p.id)}
                        className="w-7 h-7 rounded-lg bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400 hover:bg-primary-500/30 transition-all"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(p.id)}
                      className="px-3 py-1.5 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-400 text-xs font-black uppercase hover:bg-primary-500/30 transition-all active:scale-95"
                    >
                      + Aggiungi
                    </button>
                  )
                ) : (
                  <span className="text-[10px] font-bold text-red-400 uppercase">Esaurito</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Cart bar */}
        {cartCount > 0 && (
          <div className="fixed bottom-16 md:bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-80 z-30 animate-slide-up">
            <div className="glass-card p-4 flex items-center justify-between shadow-2xl border-primary-500/20">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ShoppingBag size={22} className="text-primary-400" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary-500 text-background text-[10px] font-black flex items-center justify-center">
                    {cartCount}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wide font-bold">Totale</p>
                  <p className="font-black text-lg text-white">€{cartTotal.toFixed(2)}</p>
                </div>
              </div>
              <button className="btn-green text-sm">
                Checkout →
              </button>
            </div>
          </div>
        )}

        {/* Info footer */}
        <div className="glass-card p-4 space-y-2 text-center">
          <p className="text-xs text-white/40">
            Spedizione in tutta Italia a partire da €4.90. Gratuita sopra €49.
          </p>
          <p className="text-[10px] text-white/30">
            Reso gratuito entro 30 giorni. Pagamenti con carta, PayPal e gettoni 🪙 (presto disponibile).
          </p>
        </div>

        <div className="pb-20" />
      </div>
    </div>
  );
}
