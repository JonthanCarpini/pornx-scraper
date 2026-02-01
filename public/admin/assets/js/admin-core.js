/* ============================================
   ADMIN CORE - JavaScript Modular
   Sistema de gerenciamento centralizado
   ============================================ */

class AdminCore {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.sidebar = null;
        this.statsInterval = null;
        this.init();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop().replace('.html', '');
        return page || 'dashboard';
    }

    async init() {
        await this.checkAuth();
        this.renderSidebar();
        this.setupEventListeners();
        this.updateStats();
        this.startStatsInterval();
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/admin/verify', {
                credentials: 'include'
            });

            if (!response.ok) {
                if (!window.location.pathname.includes('login.html')) {
                    window.location.href = '/admin/login.html';
                }
                return false;
            }

            const data = await response.json();
            this.currentUser = data;
            return true;
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = '/admin/login.html';
            }
            return false;
        }
    }

    renderSidebar() {
        const sidebarHTML = `
            <aside class="sidebar" id="sidebar">
                <!-- Header -->
                <div class="sidebar-header">
                    <a href="/admin/dashboard.html" class="sidebar-logo">
                        <div class="sidebar-logo-icon">🔥</div>
                        <div class="sidebar-logo-text">
                            <h1 class="sidebar-logo-title">OnlySuper</h1>
                            <p class="sidebar-logo-subtitle">Admin Panel</p>
                        </div>
                    </a>
                </div>

                <!-- User Info -->
                <div class="sidebar-user">
                    <div class="user-card">
                        <div class="user-avatar" id="userAvatar">A</div>
                        <div class="user-info">
                            <h3 class="user-name" id="userName">Admin</h3>
                            <p class="user-role">Administrador</p>
                        </div>
                    </div>
                    <div class="sidebar-stats">
                        <div class="stat-mini">
                            <div class="stat-mini-value" id="onlineUsers">0</div>
                            <div class="stat-mini-label">Online</div>
                        </div>
                        <div class="stat-mini">
                            <div class="stat-mini-value" id="totalUsers">0</div>
                            <div class="stat-mini-label">Usuários</div>
                        </div>
                    </div>
                </div>

                <!-- Navegação -->
                <nav class="sidebar-nav">
                    <div class="nav-section">
                        <h4 class="nav-section-title">Principal</h4>
                        <ul>
                            <li class="nav-item">
                                <a href="/admin/dashboard.html" class="nav-link ${this.currentPage === 'dashboard' ? 'active' : ''}">
                                    <span class="nav-icon">📊</span>
                                    <span>Dashboard</span>
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div class="nav-section">
                        <h4 class="nav-section-title">Gestão de Usuários</h4>
                        <ul>
                            <li class="nav-item">
                                <a href="/admin/users.html" class="nav-link ${this.currentPage === 'users' ? 'active' : ''}">
                                    <span class="nav-icon">👥</span>
                                    <span>Usuários</span>
                                </a>
                            </li>
                            <li class="nav-item">
                                <a href="/admin/sessions.html" class="nav-link ${this.currentPage === 'sessions' ? 'active' : ''}">
                                    <span class="nav-icon">🔐</span>
                                    <span>Sessões Ativas</span>
                                    <span class="nav-badge" id="sessionsCount">0</span>
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div class="nav-section">
                        <h4 class="nav-section-title">Conteúdo</h4>
                        <ul>
                            <li class="nav-item">
                                <a href="/admin/content.html" class="nav-link ${this.currentPage === 'content' ? 'active' : ''}">
                                    <span class="nav-icon">🗂️</span>
                                    <span>Gerenciar Conteúdo</span>
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div class="nav-section">
                        <h4 class="nav-section-title">Ferramentas</h4>
                        <ul>
                            <li class="nav-item">
                                <a href="/admin/scraper.html" class="nav-link ${this.currentPage === 'scraper' ? 'active' : ''}">
                                    <span class="nav-icon">🤖</span>
                                    <span>XXXFollow Scraper</span>
                                </a>
                            </li>
                            <li class="nav-item">
                                <a href="/admin/clubeadulto.html" class="nav-link ${this.currentPage === 'clubeadulto' ? 'active' : ''}">
                                    <span class="nav-icon">🌟</span>
                                    <span>Clube Adulto</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </nav>

                <!-- Footer -->
                <div class="sidebar-footer">
                    <button class="logout-btn" onclick="adminCore.logout()">
                        <span>🚪</span>
                        <span>Sair</span>
                    </button>
                </div>
            </aside>
            <div class="sidebar-overlay" id="sidebarOverlay"></div>
        `;

        // Inserir sidebar antes do main-content
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.insertAdjacentHTML('beforebegin', sidebarHTML);
            this.sidebar = document.getElementById('sidebar');
        }

        // Atualizar info do usuário
        if (this.currentUser) {
            const userName = document.getElementById('userName');
            const userAvatar = document.getElementById('userAvatar');
            if (userName) userName.textContent = this.currentUser.username || 'Admin';
            if (userAvatar) userAvatar.textContent = (this.currentUser.username || 'A').charAt(0).toUpperCase();
        }
    }

    setupEventListeners() {
        // Mobile menu toggle
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                this.sidebar?.classList.toggle('open');
                sidebarOverlay?.classList.toggle('active');
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                this.sidebar?.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            });
        }

        // Fechar sidebar ao clicar em link (mobile)
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    this.sidebar?.classList.remove('open');
                    sidebarOverlay?.classList.remove('active');
                }
            });
        });
    }

    async updateStats() {
        try {
            // Usuários online
            const onlineResponse = await fetch('/api/session/online-users', {
                credentials: 'include'
            });
            if (onlineResponse.ok) {
                const onlineData = await onlineResponse.json();
                const onlineEl = document.getElementById('onlineUsers');
                if (onlineEl) onlineEl.textContent = onlineData.count || 0;
            }

            // Total de usuários
            const usersResponse = await fetch('/api/admin/users?limit=1000', {
                credentials: 'include'
            });
            if (usersResponse.ok) {
                const usersData = await usersResponse.json();
                const totalEl = document.getElementById('totalUsers');
                if (totalEl) totalEl.textContent = usersData.pagination?.total || usersData.users?.length || 0;
            }

            // Sessões ativas
            const sessionsResponse = await fetch('/api/session/active-sessions', {
                credentials: 'include'
            });
            if (sessionsResponse.ok) {
                const sessionsData = await sessionsResponse.json();
                const sessionsEl = document.getElementById('sessionsCount');
                if (sessionsEl) {
                    const count = sessionsData.sessions?.length || 0;
                    sessionsEl.textContent = count;
                    sessionsEl.style.display = count > 0 ? 'flex' : 'none';
                }
            }
        } catch (error) {
            console.error('Erro ao atualizar stats:', error);
        }
    }

    startStatsInterval() {
        // Atualizar stats a cada 10 segundos
        this.statsInterval = setInterval(() => {
            this.updateStats();
        }, 10000);
    }

    stopStatsInterval() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
    }

    async logout() {
        if (!confirm('Deseja realmente sair?')) return;

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

    // Utilitários
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.style.animation = 'slideDown 0.3s ease-out';

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatNumber(num) {
        return new Intl.NumberFormat('pt-BR').format(num);
    }
}

// Inicializar quando DOM estiver pronto
let adminCore;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        adminCore = new AdminCore();
    });
} else {
    adminCore = new AdminCore();
}

// Exportar para uso global
window.adminCore = adminCore;
