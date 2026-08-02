import { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Search, Edit2, Trash2, MessageCircle, ExternalLink,
  X, Check, FileText, ChevronDown, ChevronUp, Users, Filter, ChevronRight
} from 'lucide-react';

const EMPTY = {
  nome: '', dataNascimento: '', telefone: '', nomePais: '', fichaUrl: '',
  batismo: false, primeiraComunhao: false, docsPadrinhos: false, comprovanteResidencia: false,
  sacramentoBatismo: false, sacramentoPrimeiraComunhao: false, sacramentoCrisma: false,
  lgpdAssinado: false, ativo: true,
};

function phoneMask(v = '') {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

function whatsappUrl(tel, nome) {
  const num = tel.replace(/\D/g, '');
  const full = num.startsWith('55') ? num : '55' + num;
  const msg = encodeURIComponent(`Olá! Sentimos a falta do ${nome} no encontro de hoje da Crisma na Paróquia São João Clímaco. Está tudo bem?`);
  return `https://wa.me/${full}?text=${msg}`;
}

function CB({ label, checked, onChange, warn = false }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div onClick={onChange} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${checked ? warn ? 'bg-amber-500 border-amber-500' : 'bg-navy-600 border-navy-600' : 'border-gray-300 bg-white'}`}>
        {checked && <Check size={12} className="text-white" />}
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'proxima_crisma', label: 'Próxima Crisma' },
  { id: 'falta_batismo', label: 'Falta Certidão de Batismo' },
  { id: 'falta_comunhao', label: 'Falta Certidão 1ª Comunhão' },
  { id: 'falta_padrinhos', label: 'Falta Docs Padrinhos' },
  { id: 'falta_residencia', label: 'Falta Comp. Residência' },
  { id: 'falta_lgpd', label: 'LGPD não assinado' },
  { id: 'sacr_batismo', label: 'Fará Batismo' },
  { id: 'sacr_comunhao', label: 'Fará 1ª Comunhão' },
  { id: 'sacr_crisma', label: 'Fará Crisma' },
  { id: 'docs_incompletos', label: 'Documentação incompleta' },
];

export default function Crismandos() {
  const { isCoordenacao } = useAuth();
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [dataCorte, setDataCorte] = useState(null);
  const [showFiltros, setShowFiltros] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'crismandos'), snap =>
      setLista(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.nome.localeCompare(b.nome)))
    );
    getDoc(doc(db, 'config', 'geral')).then(snap => {
      if (snap.exists() && snap.data().dataCorte) setDataCorte(snap.data().dataCorte);
    });
    return unsub;
  }, []);

  const aplicarFiltro = (c) => {
    if (filtro === 'todos') return true;
    if (filtro === 'proxima_crisma') {
      if (!dataCorte || !c.dataCadastro) return false;
      return new Date(c.dataCadastro) <= new Date(dataCorte + 'T23:59:59');
    }
    if (filtro === 'falta_batismo') return !c.batismo;
    if (filtro === 'falta_comunhao') return !c.primeiraComunhao;
    if (filtro === 'falta_padrinhos') return !c.docsPadrinhos;
    if (filtro === 'falta_residencia') return !c.comprovanteResidencia;
    if (filtro === 'falta_lgpd') return !c.lgpdAssinado;
    if (filtro === 'sacr_batismo') return !!c.sacramentoBatismo;
    if (filtro === 'sacr_comunhao') return !!c.sacramentoPrimeiraComunhao;
    if (filtro === 'sacr_crisma') return !!c.sacramentoCrisma;
    if (filtro === 'docs_incompletos') return [c.batismo, c.primeiraComunhao, c.docsPadrinhos, c.comprovanteResidencia].some(v => !v);
    return true;
  };

  const filtrados = lista.filter(c =>
    c.ativo !== false &&
    aplicarFiltro(c) &&
    (c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.nomePais?.toLowerCase().includes(busca.toLowerCase()))
  );

  const openForm = (c = null) => { setForm(c ? { ...EMPTY, ...c } : EMPTY); setEditId(c?.id || null); setShowForm(true); };
  const tog = f => setForm(p => ({ ...p, [f]: !p[f] }));

  const handleSave = async () => {
    if (!form.nome.trim()) return alert('Nome é obrigatório.');
    setSaving(true);
    try {
      const data = { ...form, telefone: form.telefone.replace(/\D/g, '') };
      if (editId) await updateDoc(doc(db, 'crismandos', editId), data);
      else await addDoc(collection(db, 'crismandos'), { ...data, dataCadastro: new Date().toISOString() });
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const docOk = c => [c.batismo, c.primeiraComunhao, c.docsPadrinhos, c.comprovanteResidencia].filter(Boolean).length;
  const sacramentos = c => [c.sacramentoBatismo && 'Batismo', c.sacramentoPrimeiraComunhao && '1ª Comunhão', c.sacramentoCrisma && 'Crisma'].filter(Boolean).join(', ');

  const filtroAtual = FILTROS.find(f => f.id === filtro);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-700">Crismandos</h1>
        {isCoordenacao && <button onClick={() => openForm()} className="btn-primary"><Plus size={16} />Novo Crismando</button>}
      </div>

      {/* Busca + Filtro */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou pais..." className="input-field pl-9" />
          </div>
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${filtro !== 'todos' ? 'bg-navy-600 text-white border-navy-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            <Filter size={15} />
            Filtrar
          </button>
        </div>

        {/* Painel de filtros */}
        {showFiltros && (
          <div className="card p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FILTROS.map(f => (
              <button
                key={f.id}
                onClick={() => { setFiltro(f.id); setShowFiltros(false); }}
                className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filtro === f.id ? 'bg-navy-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-navy-50 hover:text-navy-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Badge do filtro ativo */}
        {filtro !== 'todos' && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-navy-100 text-navy-700 rounded-full text-xs font-medium">
              <Filter size={11} /> {filtroAtual?.label} — {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
            </span>
            <button onClick={() => setFiltro('todos')} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtrados.length === 0 && (
          <div className="card text-center py-10">
            <Users size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhum crismando encontrado{filtro !== 'todos' ? ' com este filtro' : ''}.</p>
            {filtro !== 'todos' && <button onClick={() => setFiltro('todos')} className="text-xs text-navy-500 hover:underline mt-2">Limpar filtro</button>}
          </div>
        )}

        {filtrados.map(c => {
          const ok = docOk(c); const isOpen = expandido === c.id; const tel = c.telefone?.replace(/\D/g, '');
          const sacr = sacramentos(c);
          return (
            <div key={c.id} className="card p-0 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpandido(isOpen ? null : c.id)}>
                <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center shrink-0 text-sm font-semibold text-navy-700">{c.nome[0].toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy-800 text-sm">{c.nome}</p>
                  <p className="text-xs text-gray-500 truncate">{c.nomePais || '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok === 4 ? 'bg-green-100 text-green-700' : ok > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    Docs {ok}/4
                  </span>
                  {!c.lgpdAssinado && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">LGPD</span>}
                  {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-gray-400">Nascimento</p><p className="font-medium">{c.dataNascimento ? new Date(c.dataNascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</p></div>
                    <div><p className="text-xs text-gray-400">Telefone</p><p className="font-medium">{phoneMask(c.telefone || '') || '—'}</p></div>
                  </div>

                  {sacr && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Sacramentos a realizar</p>
                      <p className="text-sm text-navy-700 font-medium">{sacr}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Documentação</p>
                    <div className="flex flex-wrap gap-2">
                      {[['batismo', 'Batismo'], ['primeiraComunhao', '1ª Comunhão'], ['docsPadrinhos', 'Docs Padrinhos'], ['comprovanteResidencia', 'Comp. Residência']].map(([k, l]) => (
                        <span key={k} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c[k] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{l}</span>
                      ))}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.lgpdAssinado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>LGPD</span>
                    </div>
                  </div>

                  {c.fichaUrl && (
                    <a href={c.fichaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-navy-600 text-sm hover:underline w-fit">
                      <FileText size={14} />Ver Ficha no Drive <ExternalLink size={12} />
                    </a>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {tel && (
                      <a href={whatsappUrl(tel, c.nome)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors">
                        <MessageCircle size={13} />WhatsApp
                      </a>
                    )}
                    {isCoordenacao && <>
                      <button onClick={() => openForm(c)} className="btn-secondary text-xs py-1.5 px-3"><Edit2 size={13} />Editar</button>
                      <button onClick={() => setConfirmDelete(c.id)} className="btn-danger text-xs py-1.5 px-3"><Trash2 size={13} />Excluir</button>
                    </>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-navy-700">{editId ? 'Editar Crismando' : 'Novo Crismando'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Nome completo *</label><input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="input-field" placeholder="Nome do crismando" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Data de Nascimento</label><input type="date" value={form.dataNascimento} onChange={e => setForm({ ...form, dataNascimento: e.target.value })} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label><input value={phoneMask(form.telefone)} onChange={e => setForm({ ...form, telefone: e.target.value.replace(/\D/g, '') })} className="input-field" placeholder="(11) 99999-9999" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Nome dos Pais / Responsáveis</label><input value={form.nomePais} onChange={e => setForm({ ...form, nomePais: e.target.value })} className="input-field" placeholder="Nome dos pais" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Link da Ficha no Google Drive</label><input value={form.fichaUrl} onChange={e => setForm({ ...form, fichaUrl: e.target.value })} className="input-field" placeholder="https://drive.google.com/..." /></div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase mb-3">Sacramentos a realizar</p>
                <div className="space-y-2">
                  <CB label="Batismo" checked={form.sacramentoBatismo} onChange={() => tog('sacramentoBatismo')} />
                  <CB label="Primeira Comunhão" checked={form.sacramentoPrimeiraComunhao} onChange={() => tog('sacramentoPrimeiraComunhao')} />
                  <CB label="Crisma" checked={form.sacramentoCrisma} onChange={() => tog('sacramentoCrisma')} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Documentação entregue</p>
                <div className="space-y-2">
                  <CB label="Certidão de Batismo" checked={form.batismo} onChange={() => tog('batismo')} />
                  <CB label="Certidão de Primeira Comunhão" checked={form.primeiraComunhao} onChange={() => tog('primeiraComunhao')} />
                  <CB label="Documentos dos Padrinhos" checked={form.docsPadrinhos} onChange={() => tog('docsPadrinhos')} />
                  <CB label="Comprovante de Residência" checked={form.comprovanteResidencia} onChange={() => tog('comprovanteResidencia')} />
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <CB label="✓ Termo de Consentimento LGPD Assinado" checked={form.lgpdAssinado} onChange={() => tog('lgpdAssinado')} warn />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : (editId ? 'Salvar' : 'Cadastrar')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-800 mb-2">Confirmar exclusão</h3>
            <p className="text-gray-500 text-sm mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancelar</button>
              <button onClick={async () => { await deleteDoc(doc(db, 'crismandos', confirmDelete)); setConfirmDelete(null); }} className="btn-danger">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
