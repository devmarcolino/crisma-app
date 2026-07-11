import { useEffect, useState } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Bell, X } from 'lucide-react';

export default function Avisos() {
  const { isCoordenacao, userProfile } = useAuth();
  const [avisos, setAvisos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: '', texto: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'avisos'), snap => {
      setAvisos(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0))
      );
    });
    return unsub;
  }, []);

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.texto.trim()) return alert('Preencha título e texto.');
    setSaving(true);
    try {
      await addDoc(collection(db, 'avisos'), {
        ...form,
        autor: userProfile?.nome || 'Coordenação',
        criadoEm: serverTimestamp(),
      });
      setForm({ titulo: '', texto: '' });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este aviso?')) return;
    await deleteDoc(doc(db, 'avisos', id));
  };

  const formatDate = (ts) => {
    if (!ts?.seconds) return '';
    return new Date(ts.seconds * 1000).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-700 flex items-center gap-2">
          <Bell size={22} /> Mural de Avisos
        </h1>
        {isCoordenacao && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} /> Novo Aviso
          </button>
        )}
      </div>

      {avisos.length === 0 && (
        <div className="card text-center py-12">
          <Bell size={36} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400">Nenhum aviso publicado.</p>
        </div>
      )}

      <div className="space-y-4">
        {avisos.map(aviso => (
          <div key={aviso.id} className="card border-l-4 border-l-gold-400">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Bell size={14} className="text-gold-500 shrink-0" />
                  <h3 className="font-bold text-navy-700">{aviso.titulo}</h3>
                </div>
                <p className="text-gray-600 text-sm whitespace-pre-line leading-relaxed">{aviso.texto}</p>
                <div className="flex items-center gap-3 mt-3">
                  {aviso.autor && (
                    <span className="text-xs text-gray-400">📌 {aviso.autor}</span>
                  )}
                  <span className="text-xs text-gray-400">{formatDate(aviso.criadoEm)}</span>
                </div>
              </div>
              {isCoordenacao && (
                <button onClick={() => handleDelete(aviso.id)} className="text-gray-300 hover:text-red-500 shrink-0 transition-colors">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-navy-700">Novo Aviso</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
                <input
                  value={form.titulo}
                  onChange={e => setForm({...form, titulo: e.target.value})}
                  className="input-field"
                  placeholder="Ex: Encontro especial dia 15/07"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem *</label>
                <textarea
                  value={form.texto}
                  onChange={e => setForm({...form, texto: e.target.value})}
                  rows={5}
                  className="input-field resize-none"
                  placeholder="Escreva o aviso aqui..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-gold">
                {saving ? 'Publicando...' : '📢 Publicar Aviso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
