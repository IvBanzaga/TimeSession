// debug.js - Script de depuración para TimeSession

/* TODO: Muestra y verifica el estado actual del storage para depuración */
function debugStorage() {
    chrome.storage.local.get(null, (data) => {
        
        // Verificar integridad de datos
        if (data.clients) {
            const validClients = data.clients.filter(c => c && c.name && c.id);
            const invalidClients = data.clients.length - validClients.length;
        }
        
        if (data.sessions) {
            const validSessions = data.sessions.filter(s => s && s.id && s.startTime);
            const invalidSessions = data.sessions.length - validSessions.length;
        }
    });
}

