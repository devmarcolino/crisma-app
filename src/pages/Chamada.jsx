import { useEffect, useState } from 'react';
import { collection, onSnapshot, getDocs, query, where, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Printer, ClipboardList, MessageCircle, Save } from 'lucide-react';

function whatsappUrl(tel, nome) {
  const num = tel.replace(/\D/g, '');
  const full = num.startsWith('55') ? num : '55' + num;
  const msg = encodeURIComponent(`Olá! Sentimos a falta do ${nome} no encontro de hoje da Crisma na Paróquia São João Clímaco. Está tudo bem?`);
  return `https://wa.me/${full}?text=${msg}`;
}

function getDomingos(inicio, fim) {
  const domingos = [];
  const d = new Date(inicio + 'T12:00:00');
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  const end = new Date(fim + 'T12:00:00');
  while (d <= end) {
    domingos.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return domingos;
}

function fmtData(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// Quebra array em páginas de N linhas para impressão
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// Quantas linhas cabem por página (ajustável)
const LINHAS_POR_PAGINA = 25;

export default function Chamada() {
  const { user, isCoordenacao } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [crismandos, setCrismandos] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [modo, setModo] = useState('digital');

  const hoje = new Date().toISOString().slice(0, 10);
  const em3meses = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(em3meses);

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

  useEffect(() => {
    if (!turmaId) return;
    setCarregando(true);
    getDocs(query(collection(db, 'chamadas'), where('turmaId', '==', turmaId))).then(snap => {
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

  const marcar = (data, crismandoId, status) =>
    setPresencas(p => ({ ...p, [data]: { ...(p[data] || {}), [crismandoId]: status } }));

  const salvarTudo = async () => {
    if (!turmaId) return;
    setSalvando(true);
    try {
      const promises = [];
      for (const data of domingos) {
        for (const m of membros) {
          const status = presencas[data]?.[m.id] || '';
          if (!status) continue;
          const docId = `${turmaId}_${data}_${m.id}`;
          promises.push(setDoc(doc(db, 'chamadas', docId), {
            turmaId, data, crismandoId: m.id, crismandoNome: m.nome,
            status, turmaAula: turmaAtual?.nome || '', registradoEm: new Date().toISOString(),
          }));
        }
      }
      await Promise.all(promises);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } finally { setSalvando(false); }
  };

  const statsAluno = (crismandoId) => {
    let p = 0, f = 0;
    domingos.forEach(d => {
      const s = presencas[d]?.[crismandoId];
      if (s === 'P') p++; else if (s === 'F') f++;
    });
    return { p, f };
  };

  const catequistasNomes = turmaAtual?.catequistasNomes?.join(', ') || turmaAtual?.catequistaNome || '—';

  // Páginas de impressão — cada página tem até LINHAS_POR_PAGINA alunos
  const paginas = chunkArray(membros, LINHAS_POR_PAGINA);

  const cabecalhoStyle = {
    textAlign: 'center', borderBottom: '2px solid #1a3a5c',
    paddingBottom: '8px', marginBottom: '10px',
  };

  const thStyle = (w) => ({
    border: '1px solid #9ca3af', padding: '5px 3px',
    textAlign: 'center', fontSize: '9px', backgroundColor: '#1a3a5c',
    color: 'white', width: w,
  });

  const tdNomeStyle = {
    border: '1px solid #d1d5db', padding: '4px 6px',
    fontWeight: '500', fontSize: '10px', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px',
  };

  return (
    <div className="p-6 max-w-full mx-auto space-y-5">

      {/* CONTROLES — some na impressão */}
      <div className="print:hidden space-y-4">
        <h1 className="text-2xl font-bold text-navy-700 flex items-center gap-2">
          <ClipboardList size={22} /> Chamada
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
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fim do período</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="input-field" />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-gray-500 pb-2">{domingos.length} domingo{domingos.length !== 1 ? 's' : ''} · {membros.length} alunos → {paginas.length} folha{paginas.length !== 1 ? 's' : ''}</p>
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
            <ClipboardList size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Selecione uma turma para ver a tabela de chamada.</p>
          </div>
        )}
      </div>

      {/* MODO DIGITAL */}
      {turmaId && membros.length > 0 && modo === 'digital' && (
        <div className="print:hidden space-y-3">
          {carregando ? (
            <div className="card text-center py-8 text-gray-400">Carregando presenças...</div>
          ) : (
            <>
              {/* Tabela com scroll horizontal — todos os nomes aparecem, sem corte */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="text-sm border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
                    <thead>
                      <tr>
                        <th className="bg-navy-700 text-white px-4 py-3 text-left font-semibold border-r border-navy-600 sticky left-0 z-20" style={{ minWidth: 200 }}>
                          Crismando
                        </th>
                        {domingos.map(d => (
                          <th key={d} className="bg-navy-600 text-white px-2 py-3 text-center font-medium border-r border-navy-500 text-xs" style={{ minWidth: 52 }}>
                            {fmtData(d)}
                          </th>
                        ))}
                        <th className="bg-navy-800 text-white px-3 py-3 text-center font-semibold text-xs" style={{ minWidth: 44 }}>P</th>
                        <th className="bg-navy-800 text-white px-3 py-3 text-center font-semibold text-xs" style={{ minWidth: 44 }}>F</th>
                      </tr>
                    </thead>
                    <tbody>
                      {membros.map((m, i) => {
                        const { p, f } = statsAluno(m.id);
                        const tel = m.telefone?.replace(/\D/g, '');
                        return (
                          <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="sticky left-0 z-10 px-4 py-2 border-r border-gray-200 font-medium text-navy-800 bg-inherit" style={{ minWidth: 200 }}>
                              <div className="flex items-center gap-2">
                                <span className="truncate" style={{ maxWidth: 155 }}>{m.nome}</span>
                                {tel && (
                                  <a href={whatsappUrl(tel, m.nome)} target="_blank" rel="noopener noreferrer"
                                    className="text-green-500 hover:text-green-600 shrink-0" title="WhatsApp">
                                    <MessageCircle size={13} />
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
                                    className={`w-9 h-7 rounded text-xs font-bold transition-colors ${status === 'P' ? 'bg-green-500 text-white' : status === 'F' ? 'bg-red-400 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
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
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Clique nas células: · → P → F → ·</p>
                <div className="flex items-center gap-3">
                  {salvo && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">✓ Salvo!</span>}
                  <button onClick={salvarTudo} disabled={salvando} className="btn-primary">
                    <Save size={15} /> {salvando ? 'Salvando...' : 'Salvar chamada'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODO IMPRESSÃO */}
      {turmaId && membros.length > 0 && modo === 'impressao' && (
        <>
          <div className="flex justify-end print:hidden mb-2">
            <button onClick={() => window.print()} className="btn-secondary">
              <Printer size={16} /> Imprimir ({paginas.length} folha{paginas.length !== 1 ? 's' : ''})
            </button>
          </div>

          {/* Uma <div> por página — page-break-after garante quebra real */}
          {paginas.map((paginaMembros, pi) => (
            <div
              key={pi}
              style={{
                fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000',
                pageBreakAfter: pi < paginas.length - 1 ? 'always' : 'auto',
                breakAfter: pi < paginas.length - 1 ? 'page' : 'auto',
                marginBottom: pi < paginas.length - 1 ? '40px' : 0,
              }}
            >
              {/* Cabeçalho — repetido em cada folha */}
              <div style={cabecalhoStyle}>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1a3a5c' }}>Paróquia São João Clímaco</div>
                <div style={{ fontSize: '12px', fontWeight: '600', marginTop: '2px' }}>Lista de Presença — Crisma</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '5px', fontSize: '10px', color: '#374151' }}>
                  <span>Turma: <strong>{turmaAtual?.nome}</strong></span>
                  <span>Sala: <strong>{turmaAtual?.sala || '—'}</strong></span>
                  <span>Catequista(s): <strong>{catequistasNomes}</strong></span>
                </div>
                <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '3px' }}>
                  Período: {new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')} · {domingos.length} encontros
                  {paginas.length > 1 && ` · Folha ${pi + 1} de ${paginas.length}`}
                </div>
              </div>

              {/* Tabela da página */}
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle('auto'), textAlign: 'left', padding: '5px 8px', fontSize: '10px' }}>Crismando</th>
                    {domingos.map(d => (
                      <th key={d} style={thStyle(`${Math.max(22, Math.floor(580 / (domingos.length + 3)))}px`)}>
                        {fmtData(d)}
                      </th>
                    ))}
                    <th style={{ ...thStyle('28px'), backgroundColor: '#0e2032' }}>P</th>
                    <th style={{ ...thStyle('28px'), backgroundColor: '#0e2032' }}>F</th>
                  </tr>
                </thead>
                <tbody>
                  {paginaMembros.map((m, i) => {
                    const { p, f } = statsAluno(m.id);
                    const globalIdx = pi * LINHAS_POR_PAGINA + i;
                    return (
                      <tr key={m.id} style={{ backgroundColor: globalIdx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        <td style={tdNomeStyle}>{m.nome}</td>
                        {domingos.map(d => {
                          const status = presencas[d]?.[m.id] || '';
                          return (
                            <td key={d} style={{
                              border: '1px solid #d1d5db', textAlign: 'center',
                              padding: '3px', fontSize: '10px', fontWeight: 'bold',
                              backgroundColor: status === 'P' ? '#dcfce7' : status === 'F' ? '#fee2e2' : 'transparent',
                              color: status === 'P' ? '#15803d' : status === 'F' ? '#dc2626' : 'transparent',
                            }}>
                              {status || ''}
                            </td>
                          );
                        })}
                        <td style={{ border: '1px solid #d1d5db', textAlign: 'center', fontWeight: 'bold', color: '#15803d', backgroundColor: '#f0fdf4', fontSize: '10px' }}>
                          {p || ''}
                        </td>
                        <td style={{ border: '1px solid #d1d5db', textAlign: 'center', fontWeight: 'bold', color: '#dc2626', backgroundColor: '#fef2f2', fontSize: '10px' }}>
                          {f || ''}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Linhas em branco para completar a página — controle visual */}
                  {Array.from({ length: LINHAS_POR_PAGINA - paginaMembros.length }).map((_, i) => (
                    <tr key={`blank-${i}`} style={{ backgroundColor: (paginaMembros.length + i) % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td style={{ ...tdNomeStyle, color: 'transparent' }}>—</td>
                      {domingos.map(d => (
                        <td key={d} style={{ border: '1px solid #d1d5db', padding: '3px', height: '22px' }} />
                      ))}
                      <td style={{ border: '1px solid #d1d5db', backgroundColor: '#f0fdf4' }} />
                      <td style={{ border: '1px solid #d1d5db', backgroundColor: '#fef2f2' }} />
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '9px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '6px' }}>
                <span>Alunos nesta folha: <strong>{paginaMembros.length}</strong> · Total: <strong>{membros.length}</strong></span>
                <span>Assinatura do Catequista: _________________________________</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
