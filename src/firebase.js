import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// =====================================================================
//  CONFIGURAÇÃO DO FIREBASE
//  Substitua os valores abaixo pelos do seu projeto Firebase:
//  Console Firebase → Configurações do Projeto → Seus Apps → SDK Config
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCIAIkaLkaTmPD4eOBRWsH8ISKAH3QN3Gs",
  authDomain: "crisma-sjc.firebaseapp.com",
  projectId: "crisma-sjc",
  storageBucket: "crisma-sjc.firebasestorage.app",
  messagingSenderId: "173730290162",
  appId: "1:173730290162:web:12ebece71398515e5a336b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
export { firebaseConfig };