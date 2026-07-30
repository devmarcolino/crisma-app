import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, CalendarCheck, Bell, MessageSquare, ExternalLink } from 'lucide-react';

export default function Dashboard() {
  const { isCoordenacao, userProfile } = useAuth();
  const [stats, setStats] = useState({ total: 0, proxCrisma: 0, anoCorte: null });
  const [avisos, setAvisos] = useState([]);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    // Carrega config primeiro, depois os crismandos
    getDoc(doc(db, 'config', 'geral')).then(snap => {
      const cfg = snap.exists() ? snap.data() : null;
      setConfig(cfg);

      const unsubCrisma = onSnapshot(collection(db, 'crismandos'), (snap) => {
        const ativos = snap.docs
          .map(d => d.data())
          .filter(c => c.ativo !== false);

        let count = 0;
        let anoCorte = null;

        if (cfg?.dataCorte) {
          // Data de corte: crismandos cadastrados ATÉ essa data serão crismados no ANO SEGUINTE
          const corte = new Date(cfg.dataCorte + 'T23:59:59');
          anoCorte = corte.getFullYear() + 1; // ex: corte 02/08/2026 → crisma em 2027

          count = ativos.filter(c => {
            if (!c.dataCadastro) return false;
            return new Date(c.dataCadastro) <= corte;
          }).length;
        }

        setStats({ total: ativos.length, proxCrisma: count, anoCorte });
      });

      return unsubCrisma;
    });

    const unsubAvisos = onSnapshot(collection(db, 'avisos'), (snap) => {
      setAvisos(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0))
      );
    });

    return () => unsubAvisos();
  }, []);

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-700">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Bem-vindo, <span className="font-medium text-navy-600">{userProfile?.nome}</span>
          {config?.dataCorte && (
            <> · Data de corte: <span className="font-medium">
              {new Date(config.dataCorte + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span></>
          )}
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-14 h-14 bg-navy-50 rounded-xl flex items-center justify-center shrink-0">
            <Users size={26} className="text-navy-600" />
          </div>
          <div>
            <p className="text-3xl font-bold text-navy-700">{stats.total}</p>
            <p className="text-sm text-gray-500">Crismandos ativos</p>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="w-14 h-14 bg-gold-50 rounded-xl flex items-center justify-center shrink-0">
            <CalendarCheck size={26} className="text-gold-500" />
          </div>
          <div>
            <p className="text-3xl font-bold text-gold-600">{stats.proxCrisma}</p>
            <p className="text-sm text-gray-500">
              {stats.anoCorte
                ? `Previsto para Crisma ${stats.anoCorte}`
                : config?.dataCorte
                  ? 'Calculando...'
                  : 'Configure a data de corte'}
            </p>
            {config?.dataCorte && stats.anoCorte && (
              <p className="text-xs text-gray-400">
                Cadastrados até {new Date(config.dataCorte + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mural */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title mb-0 flex items-center gap-2">
            <Bell size={18} className="text-gold-500" /> Mural de Avisos
          </h2>
          {isCoordenacao && (
            <a href="/avisos" className="text-xs text-navy-500 hover:text-navy-700 font-medium flex items-center gap-1">
              Gerenciar <ExternalLink size={12} />
            </a>
          )}
        </div>

        {avisos.length === 0 ? (
          <div className="card text-center py-10">
            <MessageSquare size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum aviso publicado ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {avisos.map(aviso => (
              <div key={aviso.id} className="card border-l-4 border-l-gold-400">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-navy-700 text-sm">{aviso.titulo}</h3>
                    <p className="text-gray-600 text-sm mt-1 whitespace-pre-line">{aviso.texto}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(aviso.criadoEm)}</span>
                </div>
                {aviso.autor && <p className="text-xs text-gray-400 mt-2">— {aviso.autor}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
