// Admin Layout - Sidebar e Navegação Compartilhada
// Este script gerencia a sidebar, autenticação e navegação em todas as páginas admin

class AdminLayout {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('dashboard')) return 'dashboard';
        if (path.includes('users')) return 'users';
        if (path.includes('sessions')) return 'sessions';
        if (path.includes('content')) return 'content';
        if (path.includes('clubeadulto')) return 'clubeadulto';
        if (path.includes('scraper')) return 'scraper';
        return 'dashboard';
    }

    init() {
        this.renderSidebar();
        this.updateSidebarStats();
        this.startStatsInterval();
    }

    renderSidebar() {
        const sidebarHTML = `
            <aside class="sidebar">
                <!-- Logo -->
                <div class="sidebar-header">
                    <div class="sidebar-logo">
                        <div class="sidebar-logo-icon">🔥</div>
                        <h1>OnlySuper</h1>
                    </div>
                    <p class="sidebar-subtitle">Painel Administrativo</p>
                </div>

                <!-- User Info Card -->
                <div class="user-info-card">
                    <div class="user-info-header">
                        <div class="user-avatar" id="userAvatar">A</div>
                        <div class="user-details">
                            <h3 id="userName">Admin</h3>
                            <p id="userRole">Administrador</p>
                        </div>
                    </div>
                    <div class="user-stats">
                        <div class="user-stat">
                            <div class="user-stat-value" id="onlineUsers">0</div>
                            <div class="user-stat-label">Online</div>
                        </div>
                        <div class="user-stat">
                            <div class="user-stat-value" id="totalUsers">0</div>
                            <div class="user-stat-label">Usuários</div>
                        </div>
                    </div>
                </div>

                <!-- Navigation -->
                <nav class="sidebar-nav">
                    <!-- Dashboard -->
                    <div class="nav-section">
                        <div class="nav-section-title">Principal</div>
                        <ul class="nav-menu">
                            <li class="nav-item">
                                <a href="/admin/dashboard.html" class="nav-link ${this.currentPage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
                                    <span class="nav-icon">📊</span>
                                    <span class="nav-text">Dashboard</span>
                                </a>
                            </li>
                        </ul>
                    </div>

                    <!-- Gestão de Usuários -->
                    <div class="nav-section">
                        <div class="nav-section-title">Gestão de Usuários</div>
                        <ul class="nav-menu">
                            <li class="nav-item">
                                <a href="/admin/users.html" class="nav-link ${this.currentPage === 'users' ? 'active' : ''}" data-page="users">
                                    <span class="nav-icon">👥</span>
                                    <span class="nav-text">Usuários</span>
                                </a>
                            </li>
                            <li class="nav-item">
                                <a href="/admin/sessions.html" class="nav-link ${this.currentPage === 'sessions' ? 'active' : ''}" data-page="sessions">
                                    <span class="nav-icon">🔐</span>
                                    <span class="nav-text">Sessões Ativas</span>
                                    <span class="nav-badge" id="sessionsCount">0</span>
                                </a>
                            </li>
                        </ul>
                    </div>

                    <!-- Conteúdo -->
                    <div class="nav-section">
                        <div class="nav-section-title">Conteúdo</div>
                        <ul class="nav-menu">
                            <li class="nav-item">
                                <a href="/admin/content.html" class="nav-link ${this.currentPage === 'content' ? 'active' : ''}" data-page="content">
                                    <span class="nav-icon">🎬</span>
                                    <span class="nav-text">Vídeos</span>
                                </a>
                            </li>
                            <li class="nav-item">
                                <a href="/admin/clubeadulto.html" class="nav-link ${this.currentPage === 'clubeadulto' ? 'active' : ''}" data-page="clubeadulto">
                                    <span class="nav-icon">🌟</span>
                                    <span class="nav-text">Clube Adulto</span>
                                </a>
                            </li>
                        </ul>
                    </div>

                    <!-- Ferramentas -->
                    <div class="nav-section">
                        <div class="nav-section-title">Ferramentas</div>
                        <ul class="nav-menu">
                            <li class="nav-item">
                                <a href="/admin/scraper.html" class="nav-link ${this.currentPage === 'scraper' ? 'active' : ''}" data-page="scraper">
                                    <span class="nav-icon">🤖</span>
                                    <span class="nav-text">Scraper</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </nav>

                <!-- Logout -->
                <div class="sidebar-footer">
                    <button class="logout-btn" onclick="adminLayout.logout()">
                        <span>🚪</span>
                        <span>Sair</span>
                    </button>
                </div>
            </aside>
        `;

        // Inserir sidebar no início do body
        document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
        
        // Atualizar info do usuário
        this.updateUserInfo();
    }

    updateUserInfo() {
        const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
        if (adminUser.username) {
            const userNameEl = document.getElementById('userName');
            const userAvatarEl = document.getElementById('userAvatar');
            if (userNameEl) userNameEl.textContent = adminUser.username;
            if (userAvatarEl) userAvatarEl.textContent = adminUser.username.charAt(0).toUpperCase();
        }
    }

    async updateSidebarStats() {
        try {
            // Buscar usuários online
            const onlineResponse = await fetch('/api/session/online-users', {
                credentials: 'include'
            });
            if (onlineResponse.ok) {
                const onlineData = await onlineResponse.json();
                const onlineEl = document.getElementById('onlineUsers');
                if (onlineEl) onlineEl.textContent = onlineData.count || 0;
            }

            // Buscar total de usuários
            const usersResponse = await fetch('/api/users', {
                credentials: 'include'
            });
            if (usersResponse.ok) {
                const usersData = await usersResponse.json();
                const totalEl = document.getElementById('totalUsers');
                if (totalEl) totalEl.textContent = usersData.length || 0;
            }

            // Buscar sessões ativas
            const sessionsResponse = await fetch('/api/session/active-sessions', {
                credentials: 'include'
            });
            if (sessionsResponse.ok) {
                const sessionsData = await sessionsResponse.json();
                const sessionsEl = document.getElementById('sessionsCount');
                if (sessionsEl) sessionsEl.textContent = sessionsData.count || 0;
            }
        } catch (error) {
            console.error('Erro ao atualizar stats:', error);
        }
    }

    startStatsInterval() {
        setInterval(() => this.updateSidebarStats(), 10000);
    }

    async logout() {
        if (confirm('Deseja realmente sair?')) {
            try {
                await fetch('/api/admin/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
            }
            window.location.href = '/admin/login.html';
        }
    }
}

// Inicializar layout quando DOM estiver pronto
let adminLayout;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        adminLayout = new AdminLayout();
    });
} else {
    adminLayout = new AdminLayout();
}
