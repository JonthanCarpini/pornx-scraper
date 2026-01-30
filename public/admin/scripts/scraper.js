// Verificar autenticação ao carregar a página
async function checkAuth() {
    try {
        const response = await fetch('/api/admin/verify', {
            credentials: 'include'
        });

        if (!response.ok) {
            window.location.href = '/admin/login.html';
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        window.location.href = '/admin/login.html';
    }
}

// Executar verificação ao carregar
checkAuth();

let isRunning = false;
let currentEventSource = null;

function toggleButtons(running) {
    document.getElementById('btn-models').disabled = running;
    document.getElementById('btn-videos').disabled = running;
    document.getElementById('btn-details').disabled = running;
    document.getElementById('btn-tags').disabled = running;
    document.getElementById('btn-stop').style.display = running ? 'flex' : 'none';
}

function clearLogs() {
    document.getElementById('logs').innerHTML = '';
}

function addLog(message, type = 'info') {
    const logs = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logs.appendChild(entry);
    logs.scrollTop = logs.scrollHeight;
}

function updateProgress(percent, text) {
    const fill = document.getElementById('progress-fill');
    fill.style.width = `${percent}%`;
    fill.textContent = text || `${percent}%`;
}

async function loadStats() {
    try {
        const response = await fetch('/api/xxxfollow/stats', {
            credentials: 'include'
        });

        if (response.ok) {
            const stats = await response.json();
            
            document.getElementById('totalModels').textContent = stats.totalModels || 0;
            document.getElementById('totalVideos').textContent = stats.totalVideos || 0;
            document.getElementById('videosWithSource').textContent = stats.videosWithSource || 0;
            document.getElementById('videosWithoutSource').textContent = stats.videosWithoutSource || 0;
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

async function scrapeModels() {
    if (isRunning) {
        addLog('Já existe um scraping em andamento!', 'error');
        return;
    }

    const page = document.getElementById('scrape-page').value;

    isRunning = true;
    toggleButtons(true);
    clearLogs();
    addLog('🚀 Iniciando scraping de modelos...', 'info');
    updateProgress(10, 'Conectando...');

    try {
        currentEventSource = new EventSource(`/api/xxxfollow/scrape-models-stream?page=${page}`);
        let progress = 10;
        
        currentEventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'log') {
                const message = data.message;
                
                if (message.includes('✓') || message.includes('✅')) {
                    addLog(message, 'success');
                } else if (message.includes('❌') || message.includes('Erro')) {
                    addLog(message, 'error');
                } else {
                    addLog(message, 'info');
                }
                
                if (message.includes('Modelo salvo')) {
                    progress = Math.min(progress + 2, 90);
                    updateProgress(progress, 'Salvando modelos...');
                }
            } else if (data.type === 'error') {
                addLog('❌ ' + data.message, 'error');
            } else if (data.type === 'done') {
                updateProgress(100, 'Concluído!');
                addLog('✅ Scraping de modelos concluído!', 'success');
                currentEventSource.close();
                currentEventSource = null;
                isRunning = false;
                toggleButtons(false);
                setTimeout(() => loadStats(), 1000);
            }
        };
        
        currentEventSource.onerror = (error) => {
            addLog('❌ Erro na conexão: ' + error, 'error');
            currentEventSource.close();
            currentEventSource = null;
            isRunning = false;
            toggleButtons(false);
        };
        
    } catch (error) {
        addLog('❌ Erro: ' + error.message, 'error');
        isRunning = false;
        toggleButtons(false);
    }
}

async function scrapeVideos() {
    if (isRunning) {
        addLog('Já existe um scraping em andamento!', 'error');
        return;
    }

    isRunning = true;
    toggleButtons(true);
    clearLogs();
    addLog('🚀 Iniciando scraping de vídeos...', 'info');
    updateProgress(10, 'Conectando...');

    try {
        currentEventSource = new EventSource('/api/xxxfollow/scrape-videos-stream');
        let progress = 10;
        
        currentEventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'log') {
                const message = data.message;
                
                if (message.includes('✓') || message.includes('✅')) {
                    addLog(message, 'success');
                } else if (message.includes('❌') || message.includes('Erro')) {
                    addLog(message, 'error');
                } else {
                    addLog(message, 'info');
                }
                
                if (message.includes('vídeo')) {
                    progress = Math.min(progress + 1, 90);
                    updateProgress(progress, 'Coletando vídeos...');
                }
            } else if (data.type === 'error') {
                addLog('❌ ' + data.message, 'error');
            } else if (data.type === 'done') {
                updateProgress(100, 'Concluído!');
                addLog('✅ Scraping de vídeos concluído!', 'success');
                currentEventSource.close();
                currentEventSource = null;
                isRunning = false;
                toggleButtons(false);
                setTimeout(() => loadStats(), 1000);
            }
        };
        
        currentEventSource.onerror = (error) => {
            addLog('❌ Erro na conexão: ' + error, 'error');
            currentEventSource.close();
            currentEventSource = null;
            isRunning = false;
            toggleButtons(false);
        };
        
    } catch (error) {
        addLog('❌ Erro: ' + error.message, 'error');
        isRunning = false;
        toggleButtons(false);
    }
}

async function scrapeVideoDetails() {
    if (isRunning) {
        addLog('Já existe um scraping em andamento!', 'error');
        return;
    }

    isRunning = true;
    toggleButtons(true);
    clearLogs();
    addLog('🚀 Iniciando scraping de detalhes dos vídeos...', 'info');
    updateProgress(10, 'Conectando...');

    try {
        currentEventSource = new EventSource('/api/xxxfollow/scrape-video-details-stream');
        let progress = 10;
        
        currentEventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'log') {
                const message = data.message;
                
                if (message.includes('✓') || message.includes('✅')) {
                    addLog(message, 'success');
                } else if (message.includes('❌') || message.includes('Erro')) {
                    addLog(message, 'error');
                } else {
                    addLog(message, 'info');
                }
                
                if (message.includes('Source atualizado')) {
                    progress = Math.min(progress + 2, 90);
                    updateProgress(progress, 'Extraindo sources...');
                }
            } else if (data.type === 'error') {
                addLog('❌ ' + data.message, 'error');
            } else if (data.type === 'done') {
                updateProgress(100, 'Concluído!');
                addLog('✅ Scraping de detalhes concluído!', 'success');
                currentEventSource.close();
                currentEventSource = null;
                isRunning = false;
                toggleButtons(false);
                setTimeout(() => loadStats(), 1000);
            }
        };
        
        currentEventSource.onerror = (error) => {
            addLog('❌ Erro na conexão: ' + error, 'error');
            currentEventSource.close();
            currentEventSource = null;
            isRunning = false;
            toggleButtons(false);
        };
        
    } catch (error) {
        addLog('❌ Erro: ' + error.message, 'error');
        isRunning = false;
        toggleButtons(false);
    }
}

async function scrapeTags() {
    if (isRunning) {
        addLog('Já existe um scraping em andamento!', 'error');
        return;
    }

    isRunning = true;
    toggleButtons(true);
    clearLogs();
    
    // Verificar se há URL customizada
    const customUrl = document.getElementById('custom-url').value.trim();
    
    if (customUrl) {
        addLog('🚀 Iniciando scraping de URL customizada...', 'info');
        addLog(`🔗 URL: ${customUrl}`, 'info');
        updateProgress(10, 'Conectando...');
        
        try {
            const encodedUrl = encodeURIComponent(customUrl);
            currentEventSource = new EventSource(`/api/xxxfollow/scrape-custom-url-stream?url=${encodedUrl}`);
            let progress = 10;
            
            currentEventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'log') {
                    const message = data.message;
                    
                    if (message.includes('✓') || message.includes('✅')) {
                        addLog(message, 'success');
                    } else if (message.includes('❌') || message.includes('Erro')) {
                        addLog(message, 'error');
                    } else {
                        addLog(message, 'info');
                    }
                    
                    if (message.includes('Vídeo salvo')) {
                        progress = Math.min(progress + 2, 90);
                        updateProgress(progress, 'Processando...');
                    }
                } else if (data.type === 'error') {
                    addLog('❌ ' + data.message, 'error');
                } else if (data.type === 'done') {
                    updateProgress(100, 'Concluído!');
                    addLog('✅ Scraping de URL customizada concluído!', 'success');
                    currentEventSource.close();
                    currentEventSource = null;
                    isRunning = false;
                    toggleButtons(false);
                    setTimeout(() => loadStats(), 1000);
                }
            };
            
            currentEventSource.onerror = (error) => {
                addLog('❌ Erro na conexão: ' + error, 'error');
                currentEventSource.close();
                currentEventSource = null;
                isRunning = false;
                toggleButtons(false);
            };
            
        } catch (error) {
            addLog('❌ Erro: ' + error.message, 'error');
            isRunning = false;
            toggleButtons(false);
        }
        return;
    }
    
    // Scraping normal de todas as tags
    addLog('🚀 Iniciando scraping de tags via API...', 'info');
    addLog('🏷️  Processando 53 tags com modelos e vídeos...', 'info');
    updateProgress(10, 'Conectando...');

    try {
        currentEventSource = new EventSource('/api/xxxfollow/scrape-tags-stream');
        let progress = 10;
        
        currentEventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'log') {
                const message = data.message;
                
                if (message.includes('✓') || message.includes('✅')) {
                    addLog(message, 'success');
                } else if (message.includes('❌') || message.includes('Erro')) {
                    addLog(message, 'error');
                } else {
                    addLog(message, 'info');
                }
                
                if (message.includes('Tag')) {
                    progress = Math.min(progress + 2, 90);
                    updateProgress(progress, 'Processando tags...');
                }
            } else if (data.type === 'error') {
                addLog('❌ ' + data.message, 'error');
            } else if (data.type === 'done') {
                updateProgress(100, 'Concluído!');
                addLog('✅ Scraping de tags concluído!', 'success');
                currentEventSource.close();
                currentEventSource = null;
                isRunning = false;
                toggleButtons(false);
                setTimeout(() => loadStats(), 1000);
            }
        };
        
        currentEventSource.onerror = (error) => {
            addLog('❌ Erro na conexão: ' + error, 'error');
            currentEventSource.close();
            currentEventSource = null;
            isRunning = false;
            toggleButtons(false);
        };
        
    } catch (error) {
        addLog('❌ Erro: ' + error.message, 'error');
        isRunning = false;
        toggleButtons(false);
    }
}

function stopScraping() {
    if (currentEventSource) {
        currentEventSource.close();
        currentEventSource = null;
    }
    isRunning = false;
    toggleButtons(false);
    addLog('⛔ Scraping interrompido pelo usuário', 'error');
    updateProgress(0, 'Parado');
}

async function logout() {
    try {
        await fetch('/api/admin/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/admin/login.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        window.location.href = '/admin/login.html';
    }
}

// Carregar estatísticas ao iniciar
loadStats();
