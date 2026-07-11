import { useEffect, useState, useRef } from 'react';
import { collection, addDoc, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Printer, CheckCircle, XCircle, MessageCircle, ClipboardList, ChevronDown } from 'lucide-react';

function whatsappUrl(tel, nome) {
  const num = tel.replace(/\D/g, '');
  const full = num.startsWith('55') ? num : '55' + num;
  const msg = encodeURIComponent(`Olá! Sentimos a falta do ${nome} no encontro de hoje da Crisma na Paróquia São João Clímaco. Está tudo bem?`);
  return `https://wa.me/${full}?text=${msg}`;
}

export default function Chamada() {
  const { user, isCoordenacao } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [crismandos, setCrismandos] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [modo, setModo] = useState('digital'); // 'digital' | 'impressao'
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [presencas, setPresencas] = useState({});
  const [historico, setHistorico] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const printRef = useRef();

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, 'turmas'), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTurmas(isCoordenacao ? all : all.filter(t => t.catequistaId === user?.uid));
    });
    const unsubC = onSnapshot(collection(db, 'crismandos'), snap =>
      setCrismandos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.ativo !== false))
    );
    return () => { unsubT(); unsubC(); };
  }, []);

  // Carrega histórico de chamadas ao mudar turma/data
  useEffect(() => {
    if (!turmaId || !data) return;
    const q = query(collection(db, 'chamadas'),
      where('turmaId', '==', turmaId),
      where('data', '==', data)
    );
    getDocs(q).then(snap => {
      const hist = snap.docs.map(d => d.data());
      const map = {};
      hist.forEach(h => { map[h.crismandoId] = h.status; });
      setPresencas(map);
    });
  }, [turmaId, data]);

  const turmaAtual = turmas.find(t => t.id === turmaId);
  const membros = crismandos.filter(c => turmaAtual?.crismandoIds?.includes(c.id))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const marcar = (id, status) => setPresencas(p => ({ ...p, [id]: status }));

  const salvarChamada = async () => {
    if (!turmaId || !data) return alert('Selecione turma e data.');
    setSalvando(true);
    try {
      for (const m of membros) {
        const status = presencas[m.id] || 'falta';
        await addDoc(collection(db, 'chamadas'), {
          turmaId,
          data,
          crismandoId: m.id,
          crismandoNome: m.nome,
          status,
          turmaAula: turmaAtual?.nome || '',
          registradoEm: new Date().toISOString(),
        });
      }
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } finally {
      setSalvando(false);
    }
  };

  const handlePrint = () => window.print();

  const totalPresentes = membros.filter(m => presencas[m.id] === 'presente').length;
  const totalFaltas = membros.filter(m => presencas[m.id] === 'falta' || !presencas[m.id]).length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-navy-700 flex items-center gap-2">
        <ClipboardList size={22} /> Chamada
      </h1>

      {/* Controles */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Turma</label>
            <select value={turmaId} onChange={e => setTurmaId(e.target.value)} className="input-field">
              <option value="">Selecionar turma...</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.sala}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data do Encontro</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className="input-field" />
          </div>
        </div>

        {/* Modo */}
        <div className="flex gap-2">
          <button
            onClick={() => setModo('digital')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modo === 'digital' ? 'bg-navy-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            📱 Chamada Digital
          </button>
          <button
            onClick={() => setModo('impressao')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modo === 'impressao' ? 'bg-navy-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            🖨️ Lista para Impressão
          </button>
        </div>
      </div>

      {!turmaId && (
        <div className="card text-center py-10">
          <ClipboardList size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400">Selecione uma turma para iniciar a chamada.</p>
        </div>
      )}

      {turmaId && membros.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-gray-400">Esta turma não possui crismandos vinculados.</p>
        </div>
      )}

      {turmaId && membros.length > 0 && modo === 'digital' && (
        <>
          {/* Resumo */}
          <div className="flex gap-3">
            <div className="flex-1 card py-3 text-center">
              <p className="text-2xl font-bold text-green-600">{totalPresentes}</p>
              <p className="text-xs text-gray-500">Presentes</p>
            </div>
            <div className="flex-1 card py-3 text-center">
              <p className="text-2xl font-bold text-red-500">{totalFaltas}</p>
              <p className="text-xs text-gray-500">Faltas</p>
            </div>
            <div className="flex-1 card py-3 text-center">
              <p className="text-2xl font-bold text-navy-600">{membros.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {membros.map(m => {
              const status = presencas[m.id];
              const tel = m.telefone?.replace(/\D/g, '');
              return (
                <div key={m.id} className={`card flex items-center gap-3 py-3 transition-colors ${
                  status === 'presente' ? 'border-green-200 bg-green-50' :
                  status === 'falta' ? 'border-red-100 bg-red-50' : ''
                }`}>
                  <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center shrink-0 text-sm font-bold text-navy-700">
                    {m.nome[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800">{m.nome}</p>
                    {tel && status === 'falta' && (
                      <a href={whatsappUrl(tel, m.nome)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-green-600 hover:underline mt-0.5 w-fit">
                        <MessageCircle size={11} /> Avisar responsável
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => marcar(m.id, 'presente')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        status === 'presente' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                      }`}
                    >
                      <CheckCircle size={13} /> P
                    </button>
                    <button
                      onClick={() => marcar(m.id, 'falta')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        status === 'falta' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100'
                      }`}
                    >
                      <XCircle size={13} /> F
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            {salvo && <span className="badge-green mr-3 self-center text-sm">✓ Chamada salva!</span>}
            <button onClick={salvarChamada} disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando...' : '💾 Salvar Chamada'}
            </button>
          </div>
        </>
      )}

      {turmaId && membros.length > 0 && modo === 'impressao' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={handlePrint} className="btn-secondary">
              <Printer size={16} /> Imprimir Lista
            </button>
          </div>

          {/* Print area */}
          <div ref={printRef} className="card print-area">
            <div className="text-center border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-lg font-bold text-navy-800">Paróquia São João Clímaco</h2>
              <h3 className="text-base font-semibold text-gray-700">Lista de Presença — Crisma</h3>
              <div className="flex justify-center gap-6 mt-2 text-sm text-gray-600">
                <span>Turma: <strong>{turmaAtual?.nome}</strong></span>
                <span>Sala: <strong>{turmaAtual?.sala || '—'}</strong></span>
                <span>Data: <strong>{new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
              </div>
            </div>

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left w-8">Nº</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Nome do Crismando</th>
                  <th className="border border-gray-300 px-3 py-2 text-center w-20">Presença</th>
                  <th className="border border-gray-300 px-3 py-2 text-center w-20">Falta</th>
                </tr>
              </thead>
              <tbody>
                {membros.map((m, i) => (
                  <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-3 py-2 text-center text-gray-500">{i + 1}</td>
                    <td className="border border-gray-300 px-3 py-2">{m.nome}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">☐</td>
                    <td className="border border-gray-300 px-3 py-2 text-center">☐</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 flex justify-between text-sm text-gray-600">
              <span>Total de alunos: {membros.length}</span>
              <span>Assinatura do Catequista: ___________________________</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body > * { display: none; }
          .print-area { display: block !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
