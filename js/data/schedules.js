import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFirestoreDb, getAppId } from '../firebase/config.js';

/**
 * Retorna a referência da coleção pública de agendamentos.
 */
function getSchedulesCollectionRef() {
    const appId = getAppId && getAppId();
    if (!appId) return null;
    const db = getFirestoreDb();
    return collection(db, `artifacts/${appId}/public/data/schedules`);
}

/**
 * Adiciona ou atualiza um agendamento no Firestore público.
 * @param {object} schedule - Objeto do agendamento.
 */
export async function saveSchedule(schedule) {
    const appId = getAppId && getAppId();
    if (!appId) return;
    const db = getFirestoreDb();
    const docRef = doc(db, `artifacts/${appId}/public/data/schedules`, schedule.id);
    await setDoc(docRef, schedule);
}

/**
 * Atualiza um agendamento existente no Firestore público.
 * @param {object} schedule - Objeto do agendamento.
 */
export async function updateSchedule(schedule) {
    const appId = getAppId && getAppId();
    if (!appId) return;
    const db = getFirestoreDb();
    const docRef = doc(db, `artifacts/${appId}/public/data/schedules`, schedule.id);
    await updateDoc(docRef, schedule);
}

/**
 * Remove um agendamento do Firestore público.
 * @param {string} scheduleId - ID do agendamento.
 */
export async function deleteSchedule(scheduleId) {
    const appId = getAppId && getAppId();
    if (!appId) return;
    const db = getFirestoreDb();
    const docRef = doc(db, `artifacts/${appId}/public/data/schedules`, scheduleId);
    await deleteDoc(docRef);
}

/**
 * Obtém todos os agendamentos públicos (todos podem ler).
 * @returns {Promise<Array>}
 */
export async function getAllSchedules() {
    const appId = getAppId && getAppId();
    if (!appId) return [];
    const db = getFirestoreDb();
    const colRef = collection(db, `artifacts/${appId}/public/data/schedules`);
    const snapshot = await getDocs(colRef);
    const result = [];
    snapshot.forEach(docSnap => result.push(docSnap.data()));
    return result;
}

/**
 * Observa os agendamentos públicos em tempo real (todos podem ler).
 * @param {function} callback - Função chamada com o array de agendamentos.
 * @returns {function} unsubscribe
 */
export function subscribeSchedules(callback) {
    const appId = getAppId && getAppId();
    if (!appId) return () => {};
    const db = getFirestoreDb();
    const colRef = collection(db, `artifacts/${appId}/public/data/schedules`);
    return onSnapshot(colRef, (snapshot) => {
        const arr = [];
        snapshot.forEach(docSnap => arr.push(docSnap.data()));
        callback(arr);
    }, 
    // Removido: erro de console.error("Erro ao ouvir agendamentos em tempo real:", error);
    () => {});
}
