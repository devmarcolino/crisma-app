import { useEffect, useState } from 'react';
import { collection, addDoc, onSnapshot, getDocs, query, where, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Printer, ClipboardList, MessageCircle, Plus, Trash2, Save } from 'lucide-react';

function whatsappUrl(tel, nome) {
  const num = tel.replace(/\D/g, '');
  const full = num.startsWith('55') ? num : '55' + num;
  const msg = encodeURIComponent(`Olá! Sentimos a falta do ${nome} no encontro de hoje da Crisma na Paróquia São João Clímaco. Está tudo bem?`);
  return `https://wa.me/${full}?text=${msg}`;
}

// Gera todos os domingos entre duas datas
function getDomingos(inicio, fim) {
  const domingos = [];
  const d = new Date(inicio + 'T12:00:00');
  // Avança até o primeiro domingo
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  const end = new Date(fim + 'T12:00:00');
  while (d <= end) {
    domingos.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return domingos;
}

function fmtData(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function Chamada() {
  const { user, isCoordenacao } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [crismandos, setCrismandos] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [modo, setModo] = useState('digital');

  // Período de domingos
  const hoje = new Date().toISOString().slice(0, 10);
  const em3meses = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(em3meses);

  // presencas: { 'YYYY-MM-DD': { crismandoId: 'P'|'F'|'' } }
  const [presencas, setPresencas] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, 'turmas'), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTurmas(isCoordenacao ? all : all.filter(t =>
        t.catequistaIds?.includes(user?.uid) || t.catequistaId === user?.uid
      ));
    });
    const unsubC = onSnapshot(collection(db, 'crismandos'), snap =>
      setCrismandos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.ativo !== false))
    );
    return () => { unsubT(); unsubC(); };
  }, []);

  // Carrega presenças existentes do Firestore ao mudar turma ou período
  useEffect(() => {
    if (!turmaId) return;
    setCarregando(true);
    const q = query(collection(db, 'chamadas'), where('turmaId', '==', turmaId));
    getDocs(q).then(snap => {
      const map = {};
      snap.docs.forEach(d => {
        const { data, crismandoId, status } = d.data();
        if (!map[data]) map[data] = {};
        map[data][crismandoId] = status;
      });
      setPresencas(map);
      setCarregando(false);
    });
  }, [turmaId]);

  const turmaAtual = turmas.find(t => t.id === turmaId);
  const membros = crismandos
    .filter(c => turmaAtual?.crismandoIds?.includes(c.id))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const domingos = getDomingos(dataInicio, dataFim);

  const marcar = (data, crismandoId, status) => {
    setPresencas(p => ({
      ...p,
      [data]: { ...(p[data] || {}), [crismandoId]: status }
    }));
  };

  // Salva tudo no Firestore — usa setDoc com ID determinístico para evitar duplicatas
  const salvarTudo = async () => {
    if (!turmaId) return;
    setSalvando(true);
    try {
      const promises = [];
      for (const data of domingos) {
        for (const m of membros) {
          const status = presencas[data]?.[m.id] || '';
          if (!status) continue; // não salva célula vazia
          const docId = `${turmaId}_${data}_${m.id}`;
          promises.push(setDoc(doc(db, 'chamadas', docId), {
            turmaId,
            data,
            crismandoId: m.id,
            crismandoNome: m.nome,
            status,
            turmaAula: turmaAtual?.nome || '',
            registradoEm: new Date().toISOString(),
          }));
        }
      }
      await Promise.all(promises);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } finally {
      setSalvando(false);
    }
  };

  // Estatísticas por aluno
  const statsAluno = (crismandoId) => {
    let p = 0, f = 0;
    domingos.forEach(d => {
      const s = presencas[d]?.[crismandoId];
      if (s === 'P') p++;
      else if (s === 'F') f++;
    });
    return { p, f };
  };

  const catequistasNomes = turmaAtual?.catequistasNomes?.join(', ') || turmaAtual?.catequistaNome || '—';

  return (
    <div className="p-6 max-w-full mx-auto space-y-5">

      {/* === CONTROLES — some na impressão === */}
      <div className="print:hidden space-y-4">
        <h1 className="text-2xl font-bold text-navy-700 flex items-center gap-2">
          <ClipboardList size={22}/> Chamada
        </h1>

        <div className="card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Turma</label>
              <select value={turmaId} onChange={e => setTurmaId(e.target.value)} className="input-field">
                <option value="">Selecionar turma...</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.sala}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Início do período</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fim do período</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="input-field"/>
            </div>
            <div className="flex items-end">
              <p className="text-xs text-gray-500 pb-2">
                {domingos.length} domingo{domingos.length !== 1 ? 's' : ''} no período
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setModo('digital')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modo === 'digital' ? 'bg-navy-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              📊 Tabela Digital
            </button>
            <button onClick={() => setModo('impressao')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${modo === 'impressao' ? 'bg-navy-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              🖨️ Lista para Impressão
            </button>
          </div>
        </div>

        {!turmaId && (
          <div className="card text-center py-10">
            <ClipboardList size={32} className="text-gray-300 mx-auto mb-2"/>
            <p className="text-gray-400">Selecione uma turma para ver a tabela de chamada.</p>
          </div>
        )}
      </div>

      {/* === MODO DIGITAL === */}
      {turmaId && membros.length > 0 && modo === 'digital' && (
        <div className="print:hidden space-y-3">
          {carregando ? (
            <div className="card text-center py-8 text-gray-400">Carregando presenças...</div>
          ) : (
            <>
              <div className="card p-0 overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-max">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-navy-700 text-white px-4 py-3 text-left font-semibold min-w-[180px] border-r border-navy-600">
                        Crismando
                      </th>
                      {domingos.map(d => (
                        <th key={d} className="bg-navy-600 text-white px-2 py-3 text-center font-medium min-w-[52px] border-r border-navy-500 text-xs">
                          {fmtData(d)}
                        </th>
                      ))}
                      <th className="bg-navy-800 text-white px-3 py-3 text-center font-semibold min-w-[50px] text-xs">P</th>
                      <th className="bg-navy-800 text-white px-3 py-3 text-center font-semibold min-w-[50px] text-xs">F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membros.map((m, i) => {
                      const { p, f } = statsAluno(m.id);
                      const tel = m.telefone?.replace(/\D/g, '');
                      return (
                        <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="sticky left-0 z-10 px-4 py-2 border-r border-gray-200 font-medium text-navy-800 bg-inherit">
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[140px]">{m.nome}</span>
                              {tel && (
                                <a href={whatsappUrl(tel, m.nome)} target="_blank" rel="noopener noreferrer"
                                  className="text-green-500 hover:text-green-600 shrink-0" title="WhatsApp">
                                  <MessageCircle size={13}/>
                                </a>
                              )}
                            </div>
                          </td>
                          {domingos.map(d => {
                            const status = presencas[d]?.[m.id] || '';
                            return (
                              <td key={d} className="border-r border-gray-100 text-center p-1">
                                <button
                                  onClick={() => marcar(d, m.id, status === 'P' ? 'F' : status === 'F' ? '' : 'P')}
                                  className={`w-9 h-7 rounded text-xs font-bold transition-colors ${
                                    status === 'P' ? 'bg-green-500 text-white' :
                                    status === 'F' ? 'bg-red-400 text-white' :
                                    'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  {status || '·'}
                                </button>
                              </td>
                            );
                          })}
                          <td className="text-center px-2 font-bold text-green-600 bg-green-50">{p || '—'}</td>
                          <td className="text-center px-2 font-bold text-red-500 bg-red-50">{f || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Clique nas células para alternar: · → P → F → ·</p>
                <div className="flex items-center gap-3">
                  {salvo && <span className="badge-green">✓ Salvo!</span>}
                  <button onClick={salvarTudo} disabled={salvando} className="btn-primary">
                    <Save size={15}/> {salvando ? 'Salvando...' : 'Salvar chamada'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* === MODO IMPRESSÃO — visível na tela e na impressão === */}
      {turmaId && membros.length > 0 && modo === 'impressao' && (
        <>
          <div className="flex justify-end print:hidden">
            <button onClick={() => window.print()} className="btn-secondary">
              <Printer size={16}/> Imprimir
            </button>
          </div>

          {/* Conteúdo que de fato sai impresso */}
          <div id="print-area" style={{fontFamily:'Arial, sans-serif', fontSize:'11px', color:'#000'}}>
            {/* Cabeçalho */}
            <div style={{textAlign:'center', borderBottom:'2px solid #1a3a5c', paddingBottom:'10px', marginBottom:'12px'}}>
              <div style={{fontSize:'16px', fontWeight:'bold', color:'#1a3a5c'}}>Paróquia São João Clímaco</div>
              <div style={{fontSize:'13px', fontWeight:'600', marginTop:'2px'}}>Lista de Presença — Crisma</div>
              <div style={{display:'flex', justifyContent:'center', gap:'24px', marginTop:'6px', fontSize:'11px', color:'#374151'}}>
                <span>Turma: <strong>{turmaAtual?.nome}</strong></span>
                <span>Sala: <strong>{turmaAtual?.sala || '—'}</strong></span>
                <span>Catequista(s): <strong>{catequistasNomes}</strong></span>
              </div>
              <div style={{fontSize:'10px', color:'#6b7280', marginTop:'3px'}}>
                Período: {new Date(dataInicio+'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(dataFim+'T12:00:00').toLocaleDateString('pt-BR')} · {domingos.length} encontros
              </div>
            </div>

            {/* Tabela */}
            <table style={{width:'100%', borderCollapse:'collapse', tableLayout:'fixed'}}>
              <thead>
                <tr style={{backgroundColor:'#1a3a5c', color:'white'}}>
                  <th style={{border:'1px solid #9ca3af', padding:'6px 8px', textAlign:'left', width:'160px', fontSize:'11px'}}>Crismando</th>
                  {domingos.map(d => (
                    <th key={d} style={{border:'1px solid #9ca3af', padding:'4px 2px', textAlign:'center', fontSize:'9px', width:`${Math.max(28, Math.floor((100 - 20) / domingos.length))}px`}}>
                      {fmtData(d)}
                    </th>
                  ))}
                  <th style={{border:'1px solid #9ca3af', padding:'4px', textAlign:'center', width:'24px', fontSize:'9px', backgroundColor:'#0e2032'}}>P</th>
                  <th style={{border:'1px solid #9ca3af', padding:'4px', textAlign:'center', width:'24px', fontSize:'9px', backgroundColor:'#0e2032'}}>F</th>
                </tr>
              </thead>
              <tbody>
                {membros.map((m, i) => {
                  const { p, f } = statsAluno(m.id);
                  return (
                    <tr key={m.id} style={{backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb'}}>
                      <td style={{border:'1px solid #d1d5db', padding:'5px 8px', fontWeight:'500', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
                        {m.nome}
                      </td>
                      {domingos.map(d => {
                        const status = presencas[d]?.[m.id] || '';
                        return (
                          <td key={d} style={{
                            border:'1px solid #d1d5db',
                            textAlign:'center',
                            padding:'3px',
                            fontSize:'11px',
                            fontWeight:'bold',
                            backgroundColor: status === 'P' ? '#dcfce7' : status === 'F' ? '#fee2e2' : 'transparent',
                            color: status === 'P' ? '#15803d' : status === 'F' ? '#dc2626' : '#9ca3af',
                          }}>
                            {status || ''}
                          </td>
                        );
                      })}
                      <td style={{border:'1px solid #d1d5db', textAlign:'center', fontWeight:'bold', color:'#15803d', backgroundColor:'#f0fdf4', fontSize:'11px'}}>
                        {p || ''}
                      </td>
                      <td style={{border:'1px solid #d1d5db', textAlign:'center', fontWeight:'bold', color:'#dc2626', backgroundColor:'#fef2f2', fontSize:'11px'}}>
                        {f || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{display:'flex', justifyContent:'space-between', marginTop:'16px', fontSize:'10px', color:'#6b7280', borderTop:'1px solid #e5e7eb', paddingTop:'8px'}}>
              <span>Total de alunos: <strong>{membros.length}</strong></span>
              <span>Assinatura do Catequista: _________________________________</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
