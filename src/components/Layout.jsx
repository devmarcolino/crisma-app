import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, ClipboardList,
  MessageSquare, Settings, LogOut, Menu
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',      label: 'Dashboard',       icon: LayoutDashboard, roles: ['catequista','coordenacao'] },
  { to: '/crismandos',     label: 'Crismandos',       icon: Users,           roles: ['catequista','coordenacao'] },
  { to: '/turmas',         label: 'Turmas',           icon: BookOpen,        roles: ['catequista','coordenacao'] },
  { to: '/chamada',        label: 'Chamada',          icon: ClipboardList,   roles: ['catequista','coordenacao'] },
  { to: '/avisos',         label: 'Mural de Avisos',  icon: MessageSquare,   roles: ['catequista','coordenacao'] },
  { to: '/configuracoes',  label: 'Configurações',    icon: Settings,        roles: ['coordenacao'] },
];

export default function Layout({ children }) {
  const { userProfile, logout, isCoordenacao } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const visibleItems = navItems.filter(i => i.roles.includes(userProfile?.role || 'catequista'));

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const SidebarContent = ({ mobile = false }) => (
    <aside className={`flex flex-col h-full bg-navy-700 text-white ${mobile ? 'w-72' : 'w-64'}`}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-navy-600">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gold-400 rounded-lg flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <path d="M11 2v4H9v2h2v2H9v2h2v10h2V12h2v-2h-2V8h2V6h-2V2h-2z"/>
              <path d="M6 10h12v2H6z"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Gestão de Crisma</p>
            <p className="text-navy-300 text-xs">São João Clímaco</p>
          </div>
        </div>
      </div>

      {/* Perfil */}
      <div className="px-6 py-4 border-b border-navy-600">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-navy-500 flex items-center justify-center text-sm font-semibold text-gold-300">
            {(userProfile?.nome || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{userProfile?.nome || 'Usuário'}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded ${isCoordenacao ? 'bg-gold-400/20 text-gold-300' : 'bg-navy-500/50 text-navy-300'}`}>
              {isCoordenacao ? 'Coordenação' : 'Catequista'}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-gold-400 text-white shadow-sm' : 'text-navy-200 hover:bg-navy-600 hover:text-white'
              }`
            }
          >
            <Icon size={18}/> {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-navy-600 pt-4">
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-navy-300 hover:bg-navy-600 hover:text-white w-full transition-colors">
          <LogOut size={18}/> Sair
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop — some ao imprimir */}
      <div className="hidden lg:flex shrink-0 print:hidden">
        <SidebarContent/>
      </div>

      {/* Mobile overlay — some ao imprimir */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)}/>
          <div className="relative z-50 h-full"><SidebarContent mobile/></div>
        </div>
      )}

      {/* Área de conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar mobile — some ao imprimir */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm print:hidden">
          <button onClick={() => setOpen(true)} className="p-1 text-navy-600">
            <Menu size={22}/>
          </button>
          <p className="font-semibold text-navy-700 text-sm">Gestão de Crisma</p>
          <div className="w-8 h-8 rounded-full bg-navy-600 flex items-center justify-center text-xs font-semibold text-white">
            {(userProfile?.nome || 'U')[0].toUpperCase()}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
