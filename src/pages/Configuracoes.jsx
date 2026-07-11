import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, firebaseConfig } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Save, UserPlus, Trash2, Calendar, Users, Shield } from 'lucide-react';

// Instância secundária isolada do Firebase Auth.
// Garante que createUserWithEmailAndPassword NÃO troca a sessão do coordenador logado.
function getSecondaryAuth() {
  const existing = getApps().find(a => a.name === 'secondary');
  const secondaryApp = existing ?? initializeApp(firebaseConfig, 'secondary');
  return getAuth(secondaryApp);
}

export default function Configuracoes() {
  const { isCoordenacao } = useAuth();
  const [dataCorte, setDataCorte] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedConfig, setSavedConfig] = useState(false);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ nome: '', email: '', senha: '', role: 'catequista' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState('');

  useEffect(() => {
    if (!isCoordenacao) return;
    const loadConfig = async () => {
      const snap = await getDoc(doc(db, 'config', 'geral'));
      if (snap.exists()) setDataCorte(snap.data().dataCorte || '');
    };
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadConfig();
    loadUsers();
  }, [isCoordenacao]);

  if (!isCoordenacao) {
    return (
      <div className="p-6 text-center">
        <Shield size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Acesso restrito à coordenação.</p>
      </div>
    );
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    await setDoc(doc(db, 'config', 'geral'), { dataCorte }, { merge: true });
    setSavedConfig(true);
    setTimeout(() => setSavedConfig(false), 2500);
    setSavingConfig(false);
  };

  const handleCreateUser = async () => {
    setUserError('');
    if (!newUser.nome || !newUser.email || !newUser.senha) {
      setUserError('Preencha todos os campos.'); return;
    }
    if (newUser.senha.length < 6) {
      setUserError('Senha deve ter pelo menos 6 caracteres.'); return;
    }
    setCreatingUser(true);
    try {
      // Usa instância secundária — não interfere na sessão do coordenador
      const secondaryAuth = getSecondaryAuth();
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.senha);

      // Salva perfil no Firestore
      await setDoc(doc(db, 'users', cred.user.uid), {
        nome: newUser.nome,
        email: newUser.email,
        role: newUser.role,
      });

      // Desloga da instância secundária (limpeza)
      await secondaryAuth.signOut();

      setUsers(prev => [...prev, { id: cred.user.uid, nome: newUser.nome, email: newUser.email, role: newUser.role }]);
      setNewUser({ nome: '', email: '', senha: '', role: 'catequista' });
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Este e-mail já está em uso.',
        'auth/weak-password': 'Senha muito fraca.',
        'auth/invalid-email': 'E-mail inválido.',
      };
      setUserError(msgs[err.code] || 'Erro ao criar usuário: ' + err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Remover este usuário do sistema? O login Firebase permanece.')) return;
    await deleteDoc(doc(db, 'users', id));
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-navy-700 flex items-center gap-2">
        <Settings size={22} /> Configurações
      </h1>

      {/* Data de Corte */}
      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2 mb-0">
          <Calendar size={18} className="text-gold-500" /> Data de Corte — Crisma
        </h2>
        <p className="text-sm text-gray-500">
          Alunos cadastrados <strong>até</strong> esta data pertencem à turma do ano corrente.
          Cadastrados após pertencem à turma do ano seguinte.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Data de Corte</label>
            <input
              type="date"
              value={dataCorte}
              onChange={e => setDataCorte(e.target.value)}
              className="input-field"
            />
          </div>
          <button onClick={handleSaveConfig} disabled={savingConfig} className="btn-primary shrink-0">
            <Save size={15} />
            {savedConfig ? 'Salvo ✓' : savingConfig ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        {dataCorte && (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
            ✓ Data de corte configurada: <strong>{new Date(dataCorte + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
          </p>
        )}
      </div>

      {/* Gerenciar Usuários */}
      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2 mb-0">
          <Users size={18} className="text-navy-500" /> Gerenciar Usuários
        </h2>

        {/* Novo usuário */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase">Criar novo acesso</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
              <input value={newUser.nome} onChange={e => setNewUser({...newUser, nome: e.target.value})} className="input-field" placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Função</label>
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="input-field">
                <option value="catequista">Catequista</option>
                <option value="coordenacao">Coordenação</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
            <input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="input-field" placeholder="email@paroquia.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Senha inicial</label>
            <input type="password" value={newUser.senha} onChange={e => setNewUser({...newUser, senha: e.target.value})} className="input-field" placeholder="Mínimo 6 caracteres" />
          </div>
          {userError && <p className="text-red-600 text-xs bg-red-50 rounded px-3 py-2">{userError}</p>}
          <button onClick={handleCreateUser} disabled={creatingUser} className="btn-primary text-sm">
            <UserPlus size={15} /> {creatingUser ? 'Criando...' : 'Criar Usuário'}
          </button>
        </div>

        {/* Lista de usuários */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Usuários cadastrados</p>
          {users.length === 0 && <p className="text-sm text-gray-400">Nenhum usuário.</p>}
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{u.nome}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'coordenacao' ? 'bg-gold-100 text-gold-700' : 'bg-navy-100 text-navy-700'}`}>
                    {u.role === 'coordenacao' ? 'Coordenação' : 'Catequista'}
                  </span>
                  <button onClick={() => handleDeleteUser(u.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
