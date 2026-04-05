import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, where } from 'firebase/firestore';
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import {
  ClipboardList, CalendarDays, Scissors, CheckCircle2,
  Archive, Trash2, Package, Bell, LogOut, Menu, X,
  ChevronRight, Eye, EyeOff, AlertTriangle, User as UserIcon
} from 'lucide-react';
import { useStock } from '../../context/StockContext';


// ─── Login ─────────────────────────────────────────────────────────────────────
function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lbl: React.CSSProperties = {
    display: 'block',
    color: '#A0A0A0',
    fontFamily: 'Montserrat, sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    marginBottom: '6px',
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.log('Erro Firebase:', err);
      setError('E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(201,168,76,0.05) 0%, transparent 60%), #0D0C09' }}>
      <div className="animate-[fadeIn_0.6s_ease] mb-4">
        <h1 className="font-['Playfair_Display'] text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] via-[#E2C97E] to-[#C9A84C] tracking-wider text-center">
          GABIINK
        </h1>
        <p className="font-['Montserrat'] text-gray-500 text-xs tracking-[0.3em] uppercase text-center mt-2">Painel Administrativo</p>
      </div>

      <div className="glass-card w-full max-w-md mt-8 p-8 md:p-12 animate-[fadeIn_0.8s_ease_0.2s_both]">
        <h1 className="font-['Playfair_Display'] text-white font-bold text-3xl mb-2">
          Acesso Restrito
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          Entre com suas credenciais para acessar o painel administrativo.
        </p>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 mb-6 text-red-200 text-sm leading-relaxed animate-[fadeIn_0.3s_ease]">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          <div>
            <label style={lbl}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="admin@gabiink.com"
              className="modern-input w-full"
              style={{
                borderColor: focused === 'email' ? '#C9A84C' : 'rgba(201, 168, 76, 0.2)'
              }}
              required
            />
          </div>
          <div>
            <label style={lbl}>Senha</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                className="modern-input w-full pr-12"
                style={{
                  borderColor: focused === 'password' ? '#C9A84C' : 'rgba(201, 168, 76, 0.2)'
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#C9A84C] transition-colors p-1"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full py-4 text-base font-semibold tracking-wide mt-2"
            style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Entrando...' : 'Entrar no Painel'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            className="text-gray-400 hover:text-[#C9A84C] text-sm transition-colors hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>
      </div>

      <Link
        to="/"
        className="text-gray-600 hover:text-gray-400 text-sm mt-8 transition-colors"
      >
        ← Voltar para Formulário de Orçamento
      </Link>
    </div>
  );
}

// ─── Nav items ────────────────────────────────────────────────────────────────
const sidebarItems = [
  { id: 'orcamentos', label: 'Orçamentos', icon: ClipboardList, filter: null, path: '/admin' },
  { id: 'agendados', label: 'Agendados', icon: CalendarDays, filter: 'agendados', path: '/admin' },
  { id: 'em-atendimento', label: 'Em Atendimento', icon: Scissors, filter: 'em-atendimento', path: '/admin' },
  { id: 'concluidos', label: 'Concluídos', icon: CheckCircle2, filter: 'concluidos', path: '/admin' },
  { id: 'arquivados', label: 'Arquivados', icon: Archive, filter: 'arquivados', path: '/admin' },
  { id: 'lixeira', label: 'Lixeira', icon: Trash2, filter: 'lixeira', path: '/admin' },
  { id: 'estoque', label: 'Estoque', icon: Package, filter: null, path: '/admin/estoque' },
];

const bottomNavItems = [
  { id: 'orcamentos', label: 'Orçamentos', icon: ClipboardList, filter: null, path: '/admin' },
  { id: 'agendados', label: 'Agendados', icon: CalendarDays, filter: 'agendados', path: '/admin' },
  { id: 'em-atendimento', label: 'Atendimento', icon: Scissors, filter: 'em-atendimento', path: '/admin' },
  { id: 'concluidos', label: 'Concluídos', icon: CheckCircle2, filter: 'concluidos', path: '/admin' },
  { id: 'estoque', label: 'Estoque', icon: Package, filter: null, path: '/admin/estoque' },
];

// ─── AdminLayout ─────────────────────────────────────────────────────
export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [canListen, setCanListen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setCanListen(!!u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    setCanListen(false);
    try {
      await signOut(auth);
      navigate('/admin');
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  // ── Notification data ──
  const { stock } = useStock();
  const lowStockItems = stock.filter(i => i.qty < i.min);

  const [dismissedStockIds, setDismissedStockIds] = useState<Set<number>>(new Set());
  const visibleLowStock = lowStockItems.filter(i => !dismissedStockIds.has(i.id));

  interface PendingBudget {
    firestoreId: string;
    client: string;
    location: string;
    size: string;
    date: string;
  }
  const [pendingBudgets, setPendingBudgets] = useState<PendingBudget[]>([]);

  useEffect(() => {
    if (!canListen || !user) {
      setPendingBudgets([]);
      return;
    }

    const q = query(
      collection(db, 'budgets'),
      where('visualizada', '==', false),
      orderBy('criadoEm', 'desc')
    );

    const unsub = onSnapshot(q,
      snap => {
        const pending: PendingBudget[] = [];
        snap.docs.forEach(docSnap => {
          const d = docSnap.data();
          const st = d.status ?? 'pendente';
          if (st.toLowerCase() === 'pendente') {
            pending.push({
              firestoreId: docSnap.id,
              client: d.nome ?? 'Sem nome',
              location: d.localizacao ?? '',
              size: d.tamanho ?? '',
              date: d.criadoEm?.toDate().toLocaleDateString('pt-BR') ?? '',
            });
          }
        });
        setPendingBudgets(pending.slice(0, 5));
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('Erro Firestore:', error);
        }
      }
    );
    return () => unsub();
  }, [canListen, user]);

  const visibleAlerts = visibleLowStock.length + pendingBudgets.length;

  const markBudgetAsRead = async (firestoreId: string) => {
    try {
      await updateDoc(doc(db, 'budgets', firestoreId), { visualizada: true });
    } catch (err) {
      console.error('Erro ao marcar como lida:', err);
    }
  };

  const dismissStockAlert = (stockId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedStockIds(prev => new Set(prev).add(stockId));
  };

  const clearAll = async () => {
    for (const b of pendingBudgets) {
      markBudgetAsRead(b.firestoreId);
    }
    setDismissedStockIds(new Set(lowStockItems.map(i => i.id)));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#141414', color: '#C9A84C', fontFamily: 'Montserrat, sans-serif' }}>
      Carregando...
    </div>
  );

  if (!user) return <AdminLogin />;

  const currentFilter = searchParams.get('filter');
  const isEstoque = location.pathname === '/admin/estoque';

  const isActive = (item: typeof sidebarItems[0]) => {
    if (item.path === '/admin/estoque') return isEstoque;
    if (!isEstoque && location.pathname === '/admin') {
      if (item.filter === null && !currentFilter && item.id === 'orcamentos') return true;
      return item.filter === currentFilter;
    }
    return false;
  };

  const handleNav = (item: typeof sidebarItems[0]) => {
    setDrawerOpen(false);
    if (item.path === '/admin/estoque') navigate('/admin/estoque');
    else navigate(item.filter ? `/admin?filter=${item.filter}` : '/admin');
  };

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const SidebarMenu = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid #2B2B2B', textAlign: 'center' }}>
        <h2 className="font-['Playfair_Display'] text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#C9A84C] via-[#E2C97E] to-[#C9A84C] tracking-wider">
          GABIINK
        </h2>
        <p className="font-['Montserrat'] text-gray-600 text-[10px] tracking-[0.2em] uppercase mt-1">Admin</p>
      </div>

      <nav style={{ flex: 1, padding: '16px 10px', overflowY: 'auto' }}>
        {sidebarItems.map(item => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => handleNav(item)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', background: active ? 'rgba(201, 168, 76, 0.12)' : 'transparent', border: 'none', borderLeft: `3px solid ${active ? '#C9A84C' : 'transparent'}`, borderRadius: '0 6px 6px 0', color: active ? '#C9A84C' : '#A0A0A0', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', fontWeight: active ? 700 : 500, letterSpacing: '0.5px', textAlign: 'left', transition: 'all 0.15s', marginBottom: '2px' }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.color = '#E2C97E'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201, 168, 76, 0.06)'; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.color = '#A0A0A0'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; } }}>
              <Icon size={17} />
              {item.label}
              {active && <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '12px 10px', borderTop: '1px solid #2B2B2B' }}>
        <button onClick={handleLogout}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', background: 'transparent', border: 'none', borderRadius: '6px', color: '#4A4A4A', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', fontWeight: 500, letterSpacing: '0.5px', transition: 'color 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#E05252'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4A4A4A'; }}>
          <LogOut size={17} />
          Sair da conta
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#2B2B2B', overflow: 'hidden' }}>

      <aside style={{ width: '260px', backgroundColor: '#1E1E1E', borderRight: '1px solid #2B2B2B', flexShrink: 0, display: 'flex', flexDirection: 'column' }} className="desktop-sidebar">
        <SidebarMenu />
      </aside>

      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200 }} />
      )}

      <aside className="mobile-drawer" style={{ position: 'fixed', left: drawerOpen ? 0 : '-280px', top: 0, bottom: 0, width: '260px', backgroundColor: '#1E1E1E', borderRight: '1px solid #2B2B2B', zIndex: 201, transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)', flexDirection: 'column', display: 'flex' }}>
        <button onClick={() => setDrawerOpen(false)}
          style={{ position: 'absolute', top: '14px', right: '12px', background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', zIndex: 1, padding: '4px' }}>
          <X size={20} />
        </button>
        <SidebarMenu />
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        <header style={{ backgroundColor: '#1E1E1E', borderBottom: '1px solid #2B2B2B', padding: '0 20px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button onClick={() => setDrawerOpen(true)} className="hamburger-btn"
              style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
              <Menu size={22} />
            </button>
            <div>
              <p style={{ color: '#F0F0F0', fontFamily: 'Playfair Display, serif', fontSize: '17px', fontWeight: 700, margin: 0 }}>
                Olá, Gabi 👋
              </p>
              <p className="topbar-date" style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif', fontSize: '12px', margin: 0, textTransform: 'capitalize' }}>
                {today}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button onClick={() => setBellOpen(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C9A84C', position: 'relative', padding: '4px', display: 'flex', alignItems: 'center' }}>
                <Bell size={20} />
                {visibleAlerts > 0 && (
                  <span style={{ position: 'absolute', top: '0', right: '0', minWidth: '16px', height: '16px', backgroundColor: '#E05252', borderRadius: '50%', border: '2px solid #1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#fff', padding: '0 3px' }}>
                    {visibleAlerts}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '360px', maxHeight: '480px', backgroundColor: '#1E1E1E', border: '1px solid #C9A84C40', borderRadius: '12px', boxShadow: '0 12px 48px rgba(0,0,0,0.6)', zIndex: 300, overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}>

                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #2B2B2B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontFamily: 'Playfair Display, serif', color: '#F0F0F0', fontSize: '16px', fontWeight: 700, margin: 0 }}>Central de Alertas</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {visibleAlerts > 0 && (
                        <button onClick={clearAll}
                          style={{ background: 'none', border: '1px solid #4A4A4A', borderRadius: '6px', color: '#A0A0A0', fontFamily: 'Montserrat, sans-serif', fontSize: '9px', fontWeight: 600, padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.3px', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#C9A84C'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#C9A84C'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#A0A0A0'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#4A4A4A'; }}>
                          Limpar tudo
                        </button>
                      )}
                      {visibleAlerts > 0 && (
                        <span style={{ backgroundColor: '#E05252', color: '#fff', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px' }}>
                          {visibleAlerts}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
                    {visibleLowStock.length > 0 && (
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                          <AlertTriangle size={13} style={{ color: '#E05252' }} />
                          <span style={{ color: '#E05252', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>Estoque Baixo</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {visibleLowStock.map(item => (
                            <div key={item.id}
                              onClick={() => { setBellOpen(false); navigate('/admin/estoque'); }}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'rgba(224,82,82,0.06)', border: '1px solid rgba(224,82,82,0.15)', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.15s' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(224,82,82,0.12)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(224,82,82,0.06)'; }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: '#F0F0F0', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, margin: 0 }}>{item.name}</p>
                                <p style={{ color: '#E05252', fontFamily: 'Inter, sans-serif', fontSize: '11px', margin: '2px 0 0' }}>Restam {item.qty} {item.unit} (mín: {item.min})</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <span style={{ backgroundColor: '#E0525220', color: '#E05252', fontFamily: 'Montserrat, sans-serif', fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', letterSpacing: '0.5px' }}>⚠️ BAIXO</span>
                                <button onClick={(e) => dismissStockAlert(item.id, e)}
                                  style={{ background: 'none', border: 'none', color: '#4A4A4A', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#A0A0A0'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4A4A4A'; }}>
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {visibleLowStock.length > 0 && pendingBudgets.length > 0 && (
                      <div style={{ height: '1px', backgroundColor: '#2B2B2B', margin: '0 16px' }} />
                    )}

                    {pendingBudgets.length > 0 && (
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                          <UserIcon size={13} style={{ color: '#C9A84C' }} />
                          <span style={{ color: '#C9A84C', fontFamily: 'Montserrat, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>Novos Orçamentos</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {pendingBudgets.map(b => (
                            <div key={b.firestoreId}
                              onClick={() => { markBudgetAsRead(b.firestoreId); setBellOpen(false); navigate(`/admin?highlight=${b.firestoreId}`); }}
                              style={{ padding: '10px 12px', backgroundColor: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.15s', display: 'flex', alignItems: 'flex-start', gap: '8px' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(201,168,76,0.10)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(201,168,76,0.04)'; }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                                  <p style={{ color: '#F0F0F0', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, margin: 0 }}>{b.client}</p>
                                  <span style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '11px', flexShrink: 0 }}>{b.date}</span>
                                </div>
                                <p style={{ color: '#A0A0A0', fontFamily: 'Inter, sans-serif', fontSize: '11px', margin: 0 }}>
                                  {[b.location, b.size].filter(Boolean).join(' · ') || 'Sem detalhes'}
                                </p>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); markBudgetAsRead(b.firestoreId); }}
                                style={{ background: 'none', border: 'none', color: '#4A4A4A', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: '2px', transition: 'color 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#A0A0A0'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4A4A4A'; }}>
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {visibleAlerts === 0 && (
                      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                        <Bell size={28} style={{ color: '#4A4A4A', margin: '0 auto 10px', display: 'block' }} />
                        <p style={{ color: '#4A4A4A', fontFamily: 'Inter, sans-serif', fontSize: '13px', margin: 0 }}>Nenhum alerta no momento</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="logout-topbar"
              style={{ background: 'none', border: '1px solid #4A4A4A', borderRadius: '6px', cursor: 'pointer', color: '#A0A0A0', padding: '6px 12px', fontFamily: 'Montserrat, sans-serif', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#E05252'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E05252'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#A0A0A0'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#4A4A4A'; }}>
              <LogOut size={13} /> Sair
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: 'clamp(16px, 3vw, 28px)', paddingBottom: '80px' }} className="admin-main">
          <Outlet />
        </main>

        <nav className="bottom-nav" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, height: '64px', backgroundColor: '#1E1E1E', borderTop: '1px solid #2B2B2B', zIndex: 100, alignItems: 'stretch', justifyContent: 'space-around' }}>
          {bottomNavItems.map(item => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => handleNav(item)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', color: active ? '#C9A84C' : '#4A4A4A', fontFamily: 'Montserrat, sans-serif', fontSize: '9px', fontWeight: 600, letterSpacing: '0.3px', padding: '0 4px', borderTop: active ? '2px solid #C9A84C' : '2px solid transparent', transition: 'all 0.15s' }}>
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .desktop-sidebar { display: flex !important; }
          .mobile-drawer { display: none !important; }
          .hamburger-btn { display: none !important; }
          .bottom-nav { display: none !important; }
          .admin-main { padding-bottom: clamp(16px, 3vw, 28px) !important; }
          .logout-topbar { display: flex !important; }
          .topbar-date { display: block !important; }
        }
        @media (max-width: 767px) {
          .desktop-sidebar { display: none !important; }
          .hamburger-btn { display: flex !important; }
          .bottom-nav { display: flex !important; }
          .logout-topbar { display: none !important; }
          .topbar-date { display: none !important; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}