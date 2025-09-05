// js/firebase/wrapper.js
// Wrapper seguro para operações Firestore

export async function safeFirestoreRead(operation, maxRetries = 2, timeoutMs = 5000) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('timeout')), timeoutMs)
            );
            
            return await Promise.race([operation(), timeoutPromise]);
            
        } catch (error) {
            lastError = error;
            if (attempt === maxRetries || !isRetryableError(error)) {
                throw error;
            }
            
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

export async function safeFirestoreWrite(operation, maxRetries = 1, timeoutMs = 8000) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('timeout')), timeoutMs)
            );
            
            return await Promise.race([operation(), timeoutPromise]);
            
        } catch (error) {
            lastError = error;
            if (attempt === maxRetries || !isRetryableWriteError(error)) {
                throw error;
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000 + (attempt * 1000)));
        }
    }
    
    throw lastError;
}

function isRetryableError(error) {
    if (!error) return false;
    const errorCode = error.code;
    const errorMessage = error.message ? error.message.toLowerCase() : '';
    
    const retryableCodes = ['unavailable', 'deadline-exceeded', 'resource-exhausted'];
    const retryableMessages = ['timeout', 'network', 'connection', 'webchannel'];
    
    return retryableCodes.includes(errorCode) ||
           retryableMessages.some(msg => errorMessage.includes(msg));
}

function isRetryableWriteError(error) {
    if (!error) return false;
    return ['unavailable', 'deadline-exceeded'].includes(error.code);
}