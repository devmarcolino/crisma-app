import { useEffect, useState } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, X, Users, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

export default function Turmas() {
  const { isCoordenacao, userProfile, user } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [crismandos, setCrismandos] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', sala: '', catequistaId: '', catequistaNome: '', crismandoIds: [] });
  const [editId, setEditId] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, 'turmas'), snap =>
      setTurmas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubC = onSnapshot(collection(db, 'crismandos'), snap =>
      setCrismandos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.ativo !== false))
    );
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadUsers();
    return () => { unsubT(); unsubC(); };
  }, []);

  const turmasVisiveis = isCoordenacao
    ? turmas
    : turmas.filter(t => t.catequistaId === user?.uid);

  const openForm = (turma = null) => {
    if (turma) {
      setForm({
        nome: turma.nome || '',
        sala: turma.sala || '',
        catequistaId: turma.catequistaId || '',
        catequistaNome: turma.catequistaNome || '',
        crismandoIds: turma.crismandoIds || [],
      });
      setEditId(turma.id);
    } else {
      setForm({ nome: '', sala: '', catequistaId: '', catequistaNome: '', crismandoIds: [] });
      setEditId(null);
    }
    setBusca('');
    setShowForm(true);
  };

  const toggleCrismando = (id) => {
    setForm(f => ({
      ...f,
      crismandoIds: f.crismandoIds.includes(id)
        ? f.crismandoIds.filter(x => x !== id)
        : [...f.crismandoIds, id]
    }));
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return alert('Nome da turma é obrigatório.');
    setSaving(true);
    try {
      const catUser = users.find(u => u.id === form.catequistaId);
      const data = { ...form, catequistaNome: catUser?.nome || form.catequistaNome };
      if (editId) {
        await updateDoc(doc(db, 'turmas', editId), data);
      } else {
        await addDoc(collection(db, 'turmas'), data);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta turma?')) return;
    await deleteDoc(doc(db, 'turmas', id));
  };

  const filtrados = crismandos.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-700">Turmas</h1>
        {isCoordenacao && (
          <button onClick={() => openForm()} className="btn-primary">
            <Plus size={16} /> Nova Turma
          </button>
        )}
      </div>

      {turmasVisiveis.length === 0 && (
        <div className="card text-center py-12">
          <BookOpen size={36} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400">Nenhuma turma encontrada.</p>
        </div>
      )}

      <div className="space-y-3">
        {turmasVisiveis.map(turma => {
          const membros = crismandos.filter(c => turma.crismandoIds?.includes(c.id));
          const isOpen = expandido === turma.id;
          return (
            <div key={turma.id} className="card p-0 overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandido(isOpen ? null : turma.id)}
              >
                <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center shrink-0">
                  <BookOpen size={18} className="text-navy-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-navy-800">{turma.nome}</p>
                  <p className="text-xs text-gray-500">
                    Sala: {turma.sala || '—'} · Catequista: {turma.catequistaNome || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="badge-blue flex items-center gap-1">
                    <Users size={11} /> {membros.length}
                  </span>
                  {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                  {membros.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhum crismando vinculado.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {membros.map(m => (
                        <div key={m.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-sm border border-gray-100">
                          <div className="w-7 h-7 rounded-full bg-navy-100 flex items-center justify-center text-xs font-bold text-navy-700">
                            {m.nome[0].toUpperCase()}
                          </div>
                          <span className="truncate">{m.nome}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {isCoordenacao && (
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => openForm(turma)} className="btn-secondary text-xs py-1.5 px-3">
                        <Edit2 size={13} /> Editar
                      </button>
                      <button onClick={() => handleDelete(turma.id)} className="btn-danger text-xs py-1.5 px-3">
                        <Trash2 size={13} /> Excluir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-navy-700">{editId ? 'Editar Turma' : 'Nova Turma'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome da Turma *</label>
                <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="input-field" placeholder="Ex: Turma Alfa" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sala</label>
                <input value={form.sala} onChange={e => setForm({...form, sala: e.target.value})} className="input-field" placeholder="Ex: Sala 3, Salão Principal" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Catequista Responsável</label>
                {users.filter(u => u.role === 'catequista').length > 0 ? (
                  <select value={form.catequistaId} onChange={e => setForm({...form, catequistaId: e.target.value})} className="input-field">
                    <option value="">Selecionar catequista...</option>
                    {users.filter(u => u.role === 'catequista').map(u => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                ) : (
                  <input value={form.catequistaNome} onChange={e => setForm({...form, catequistaNome: e.target.value})} className="input-field" placeholder="Nome do catequista" />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Crismandos ({form.crismandoIds.length} selecionados)</label>
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar crismando..."
                  className="input-field mb-2"
                />
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {filtrados.map(c => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.crismandoIds.includes(c.id)}
                        onChange={() => toggleCrismando(c.id)}
                        className="accent-navy-600"
                      />
                      <span className="text-sm">{c.nome}</span>
                    </label>
                  ))}
                  {filtrados.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhum resultado</p>}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Salvando...' : (editId ? 'Salvar' : 'Criar Turma')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
