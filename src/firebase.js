import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  get,
  push,
  update,
  remove
} from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDhPc5jyxmgk3W3T6ieQup5Ebb7pIWKQeE",
  authDomain: "almoxarifado-a4710.firebaseapp.com",
  databaseURL: "https://almoxarifado-a4710-default-rtdb.firebaseio.com/",
  projectId: "almoxarifado-a4710",
  storageBucket: "almoxarifado-a4710.appspot.com",
  messagingSenderId: "42600769910",
  appId: "1:42600769910:web:7ec160510782288297b257"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export {
  db,
  ref,
  get,
  push,
  update,
  remove
};

export async function getItensCadastrados() {
  try {
    const snapshot = await get(ref(db, 'itens'));
    if (snapshot.exists()) {
      const dados = snapshot.val();
      return Object.entries(dados).map(([id, item]) => ({ id, ...item }));
    } else {
      return [];
    }
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    return [];
  }
}
