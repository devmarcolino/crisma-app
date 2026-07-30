import { useEffect, useState } from 'react';
import { collection, addDoc, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Printer, CheckCircle, XCircle, MessageCircle, ClipboardList } from 'lucide-react';

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
  const [modo, setModo] = useState('digital');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [presencas, setPresencas] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, 'turmas'), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTurmas(isCoordenacao ? all : all.filter(t => t.catequistaIds?.includes(user?.uid) || t.catequistaId === user?.uid));
    });
    const unsubC = onSnapshot(collection(db, 'crismandos'), snap =>
      setCrismandos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.ativo !== false))
    );
    return () => { unsubT(); unsubC(); };
  }, []);

  useEffect(() => {
    if (!turmaId || !data) return;
    const q = query(collection(db, 'chamadas'),
      where('turmaId', '==', turmaId),
      where('data', '==', data)
    );
    getDocs(q).then(snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.data().crismandoId] = d.data().status; });
      setPresencas(map);
    });
  }, [turmaId, data]);

  const turmaAtual = turmas.find(t => t.id === turmaId);
  const membros = crismandos
    .filter(c => turmaAtual?.crismandoIds?.includes(c.id))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const marcar = (id, status) => setPresencas(p => ({ ...p, [id]: status }));

  const salvarChamada = async () => {
    if (!turmaId || !data) return alert('Selecione turma e data.');
    setSalvando(true);
    try {
      for (const m of membros) {
        await addDoc(collection(db, 'chamadas'), {
          turmaId, data,
          crismandoId: m.id,
          crismandoNome: m.nome,
          status: presencas[m.id] || 'falta',
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

  const totalPresentes = membros.filter(m => presencas[m.id] === 'presente').length;
  const totalFaltas = membros.length - totalPresentes;

  // Nomes dos catequistas para exibir na lista impressa
  const catequistasNomes = turmaAtual?.catequistasNomes?.join(', ') || turmaAtual?.catequistaNome || '—';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Cabeçalho — oculto na impressão */}
      <h1 className="text-2xl font-bold text-navy-700 flex items-center gap-2 no-print">
        <ClipboardList size={22} /> Chamada
      </h1>

      {/* Controles — ocultos na impressão */}
      <div className="card space-y-4 no-print">
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
        <div className="flex gap-2">
          <button onClick={() => setModo('digital')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modo === 'digital' ? 'bg-navy-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            📱 Chamada Digital
          </button>
          <button onClick={() => setModo('impressao')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modo === 'impressao' ? 'bg-navy-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            🖨️ Lista para Impressão
          </button>
        </div>
      </div>

      {!turmaId && (
        <div className="card text-center py-10 no-print">
          <ClipboardList size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400">Selecione uma turma para iniciar a chamada.</p>
        </div>
      )}

      {turmaId && membros.length === 0 && (
        <div className="card text-center py-8 no-print">
          <p className="text-gray-400">Esta turma não possui crismandos vinculados.</p>
        </div>
      )}

      {/* MODO DIGITAL */}
      {turmaId && membros.length > 0 && modo === 'digital' && (
        <>
          <div className="flex gap-3 no-print">
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

          <div className="space-y-2 no-print">
            {membros.map(m => {
              const status = presencas[m.id];
              const tel = m.telefone?.replace(/\D/g, '');
              return (
                <div key={m.id} className={`card flex items-center gap-3 py-3 transition-colors ${
                  status === 'presente' ? 'border-green-200 bg-green-50' :
                  status === 'falta' ? 'border-red-100 bg-red-50' : ''}`}>
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
                    <button onClick={() => marcar(m.id, 'presente')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        status === 'presente' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-100'}`}>
                      <CheckCircle size={13} /> P
                    </button>
                    <button onClick={() => marcar(m.id, 'falta')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        status === 'falta' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100'}`}>
                      <XCircle size={13} /> F
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end no-print">
            {salvo && <span className="badge-green mr-3 self-center text-sm">✓ Chamada salva!</span>}
            <button onClick={salvarChamada} disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando...' : '💾 Salvar Chamada'}
            </button>
          </div>
        </>
      )}

      {/* MODO IMPRESSÃO */}
      {turmaId && membros.length > 0 && modo === 'impressao' && (
        <>
          <div className="flex justify-end no-print">
            <button onClick={() => window.print()} className="btn-secondary">
              <Printer size={16} /> Imprimir Lista
            </button>
          </div>

          {/* Área de impressão — visível na tela e na impressora */}
          <div id="print-area" className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="text-center border-b border-gray-300 pb-4 mb-5">
              <h2 style={{fontSize:'18px', fontWeight:'bold', color:'#1a3a5c', margin:0}}>Paróquia São João Clímaco</h2>
              <h3 style={{fontSize:'14px', fontWeight:'600', color:'#374151', margin:'4px 0 0'}}>Lista de Presença — Crisma</h3>
              <div style={{display:'flex', justifyContent:'center', gap:'24px', marginTop:'8px', fontSize:'13px', color:'#4b5563'}}>
                <span>Turma: <strong>{turmaAtual?.nome}</strong></span>
                <span>Sala: <strong>{turmaAtual?.sala || '—'}</strong></span>
                <span>Data: <strong>{new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></span>
              </div>
              <div style={{fontSize:'12px', color:'#6b7280', marginTop:'4px'}}>
                Catequista(s): <strong>{catequistasNomes}</strong>
              </div>
            </div>

            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
              <thead>
                <tr style={{backgroundColor:'#eef2f7'}}>
                  <th style={{border:'1px solid #9ca3af', padding:'8px', textAlign:'left', width:'40px'}}>Nº</th>
                  <th style={{border:'1px solid #9ca3af', padding:'8px', textAlign:'left'}}>Nome do Crismando</th>
                  <th style={{border:'1px solid #9ca3af', padding:'8px', textAlign:'center', width:'80px'}}>Presença</th>
                  <th style={{border:'1px solid #9ca3af', padding:'8px', textAlign:'center', width:'80px'}}>Falta</th>
                </tr>
              </thead>
              <tbody>
                {membros.map((m, i) => (
                  <tr key={m.id} style={{backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb'}}>
                    <td style={{border:'1px solid #9ca3af', padding:'8px', textAlign:'center', color:'#6b7280'}}>{i + 1}</td>
                    <td style={{border:'1px solid #9ca3af', padding:'8px'}}>{m.nome}</td>
                    <td style={{border:'1px solid #9ca3af', padding:'8px', textAlign:'center', fontSize:'16px'}}>☐</td>
                    <td style={{border:'1px solid #9ca3af', padding:'8px', textAlign:'center', fontSize:'16px'}}>☐</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{display:'flex', justifyContent:'space-between', marginTop:'24px', fontSize:'12px', color:'#4b5563'}}>
              <span>Total de alunos: <strong>{membros.length}</strong></span>
              <span>Assinatura do Catequista: ___________________________</span>
            </div>
          </div>
        </>
      )}

      {/* Estilos de impressão */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #print-area {
            border: none !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
          body { margin: 0; }
        }
      `}</style>
    </div>
  );
}
