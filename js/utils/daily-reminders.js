// js/utils/daily-reminders.js
// Sistema de lembretes diários para jogos agendados

import { notifyTodayGame, areNotificationsEnabled } from './notifications.js';
import { getAllSchedules } from '../data/schedules.js';

const LAST_CHECK_KEY = 'lastDailyCheck';

/**
 * Verifica se deve executar verificação diária
 */
function shouldCheckToday() {
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    const today = new Date().toDateString();
    
    return lastCheck !== today;
}

/**
 * Marca que a verificação foi feita hoje
 */
function markCheckDone() {
    const today = new Date().toDateString();
    localStorage.setItem(LAST_CHECK_KEY, today);
}

/**
 * Verifica jogos do dia atual
 */
export async function checkTodayGames() {
    if (!shouldCheckToday() || !areNotificationsEnabled()) {
        return;
    }

    try {
        const schedules = await getAllSchedules();
        const today = new Date().toISOString().slice(0, 10);
        
        const todayGames = schedules.filter(game => 
            game.date === today && 
            game.status === 'upcoming'
        );

        // Notifica sobre jogos de hoje
        for (const game of todayGames) {
            await notifyTodayGame(game);
            // Pequeno delay entre notificações
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        markCheckDone();
    } catch (error) {
        console.warn('Erro ao verificar jogos do dia:', error);
    }
}

/**
 * Força verificação de jogos (para teste)
 */
export async function testTodayReminder() {
    try {
        const schedules = await getAllSchedules();
        const today = new Date().toISOString().slice(0, 10);
        
        const todayGames = schedules.filter(game => 
            game.date === today && 
            game.status === 'upcoming'
        );

        console.log(`Jogos encontrados para hoje (${today}):`, todayGames);

        if (todayGames.length === 0) {
            console.log('Nenhum jogo encontrado para hoje');
            // Cria um jogo de teste para demonstração
            const testGame = {
                id: 'test-game',
                date: today,
                startTime: '19:00',
                location: 'Quadra de Teste',
                notes: 'Jogo de teste para demonstração',
                status: 'upcoming'
            };
            await notifyTodayGame(testGame);
            console.log('Notificação de teste enviada!');
        } else {
            // Notifica sobre jogos reais de hoje
            for (const game of todayGames) {
                await notifyTodayGame(game);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (error) {
        console.error('Erro no teste de lembretes:', error);
    }
}

/**
 * Inicializa sistema de lembretes diários
 */
export function initDailyReminders() {
    // Verifica imediatamente ao carregar
    setTimeout(() => {
        checkTodayGames();
    }, 3000); // 3 segundos após carregar
    
    // Verifica a cada hora (caso o usuário deixe o app aberto)
    setInterval(() => {
        checkTodayGames();
    }, 60 * 60 * 1000); // 1 hora
    
    // Adiciona funções de teste ao window para acesso via console
    window.testTodayReminder = testTodayReminder;
    window.resetDailyCheck = () => {
        localStorage.removeItem(LAST_CHECK_KEY);
        console.log('Controle diário resetado. Próxima verificação irá executar.');
    };
    window.checkTodayGames = checkTodayGames;
}