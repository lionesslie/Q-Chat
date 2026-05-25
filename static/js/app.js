/**
 * Q-Chat — Main Application (Rust Backend)
 * Real-time messaging with Native WebSocket + WebRTC Voice Chat
 */

(() => {
    'use strict';

    // ─── State ───────────────────────────────────────────────────
    const state = {
        ws: null,
        username: null,
        displayName: null,
        email: null,
        avatar: null,
        avatarColor: null,
        currentTab: 'general',
        currentChat: null,
        onlineUsers: [],
        allUsers: [],
        userAvatars: {},
        rooms: [],
        projects: [],
        unreadPrivate: {},
        unreadRooms: {},
        voiceChannel: null,
        peerConnections: {},
        remoteAudios: {},
        localStream: null,
        isMuted: false,
        mutedUsers: {},
        voiceParticipantsList: [],
        screenStream: null,
        screenPeerConnections: {},
        isScreenSharing: false,
        screenSharer: null,
        currentProject: null,
        projectSort: 'newest',
        pendingChatImage: null,
    };

    // ─── DOM Refs ────────────────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        authView: $('#auth-view'),
        chatView: $('#chat-view'),
        loginForm: $('#login-form'),
        registerForm: $('#register-form'),
        verificationForm: $('#verification-form'),
        regVerificationCode: $('#reg-verification-code'),
        verifySubmitBtn: $('#verify-submit-btn'),
        regSubmitBtn: $('#reg-submit-btn'),
        authError: $('#auth-error'),
        showRegister: $('#show-register'),
        showRegisterBack: $('#show-register-back'),
        showLogin: $('#show-login'),
        myAvatar: $('#my-avatar'),
        myDisplayName: $('#my-display-name'),
        logoutBtn: $('#logout-btn'),
        navTabs: $$('.nav-tab'),
        tabContents: $$('.tab-content'),
        userList: $('#user-list'),
        roomList: $('#room-list'),
        onlineCount: $('#online-count'),
        chatTitle: $('#chat-title'),
        chatSubtitle: $('#chat-subtitle'),
        messagesContainer: $('#messages-container'),
        messages: $('#messages'),
        messageInput: $('#message-input'),
        sendBtn: $('#send-btn'),
        createRoomBtn: $('#create-room-btn'),
        roomModal: $('#room-modal'),
        roomNameInput: $('#room-name-input'),
        modalCancel: $('#modal-cancel'),
        modalCreate: $('#modal-create'),
        voiceToggleBtn: $('#voice-toggle-btn'),
        screenShareBtn: $('#screen-share-btn'),
        screenShareViewer: $('#screen-share-viewer'),
        screenShareVideo: $('#screen-share-video'),
        screenShareClose: $('#screen-share-close'),
        voicePanel: $('#voice-panel'),
        voiceLeaveBtn: $('#voice-leave-btn'),
        voiceParticipants: $('#voice-participants'),
        sidebarToggle: $('#sidebar-toggle'),
        sidebar: $('#sidebar'),
        starsContainer: $('#stars-container'),
        toastContainer: $('#toast-container'),
        profileModal: $('#profile-modal'),
        profileAvatarPreview: $('#profile-avatar-preview'),
        profileUsername: $('#profile-username'),
        profileEmail: $('#profile-email'),
        profileJoinDate: $('#profile-join-date'),
        profileStatusBadge: $('#profile-status-badge'),
        avatarUpload: $('#avatar-upload'),
        profileClose: $('#profile-close'),
        sidebarUserInfo: $('#sidebar-user-info'),
        // Chat image upload
        imageUploadBtn: $('#image-upload-btn'),
        chatImageInput: $('#chat-image-input'),
        chatImagePreview: $('#chat-image-preview'),
        chatImagePreviewImg: $('#chat-image-preview-img'),
        chatImagePreviewRemove: $('#chat-image-preview-remove'),
        // Projects
        projectUploadLoading: $('#project-upload-loading'),
        uploadProjectBtn: $('#upload-project-btn'),
        projectList: $('#project-list'),
        projectUploadModal: $('#project-upload-modal'),
        projectNameInput: $('#project-name-input'),
        projectDescInput: document.getElementById('project-desc-input'),
        projectTagsInput: document.getElementById('project-tags-input'),
        projectFileInput: document.getElementById('project-file-input'),
        fileUploadArea: document.getElementById('file-upload-area'),
        selectedFileInfo: document.getElementById('selected-file-info'),
        selectedFileName: document.getElementById('selected-file-name'),
        removeFileBtn: document.getElementById('remove-file-btn'),
        imageUploadArea: document.getElementById('image-upload-area'),
        projectImageInput: document.getElementById('project-image-input'),
        selectedImageInfo: document.getElementById('selected-image-info'),
        selectedImageName: document.getElementById('selected-image-name'),
        removeImageBtn: document.getElementById('remove-image-btn'),
        uploadProgress: document.getElementById('upload-progress'),
        uploadProgressBar: document.getElementById('upload-progress-bar'),
        projectUploadCancel: document.getElementById('project-upload-cancel'),
        projectUploadSubmit: document.getElementById('project-upload-submit'),
        // Project detail
        projectDetailView: $('#project-detail-view'),
        projectBackBtn: $('#project-back-btn'),
        projectDetailTitle: $('#project-detail-title'),
        projectDetailUploader: $('#project-detail-uploader'),
        projectDetailFilename: $('#project-detail-filename'),
        projectDetailSize: $('#project-detail-size'),
        projectDetailDate: $('#project-detail-date'),
        projectDetailDownloads: $('#project-detail-downloads'),
        projectDetailTags: $('#project-detail-tags'),
        projectDetailDescription: $('#project-detail-description'),
        projectDownloadBtn: $('#project-download-btn'),
        chatInputArea: $('#chat-input-area'),
        // Projects main view
        projectsMainView: $('#projects-main-view'),
        projectsMainGrid: $('#projects-main-grid'),
        projectsSearchInput: $('#projects-search-input'),
        projectsCount: $('#projects-count'),
        // Public Profile
        publicProfileModal: $('#public-profile-modal'),
        publicProfileAvatarPreview: $('#public-profile-avatar-preview'),
        publicProfileUsername: $('#public-profile-username'),
        publicProfileBio: $('#public-profile-bio'),
        publicProfileTime: $('#public-profile-time'),
        publicProfileClose: $('#public-profile-close'),
        publicProfileStatusBadge: $('#public-profile-status-badge'),
        publicProfileStatusText: $('#public-profile-status-text'),
        publicProfileMessageBtn: $('#public-profile-message-btn'),
        // Profile bio
        profileBioInput: $('#profile-bio-input'),
        saveBioBtn: $('#save-bio-btn'),
    };

    // ─── Init ────────────────────────────────────────────────────
    function init() {
        createStars();
        bindEvents();
        checkAuth();
        if ("Notification" in window) {
            Notification.requestPermission();
        }
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/static/sw.js')
                .catch(err => console.error('ServiceWorker registration error:', err));
        }

        // Restore voice panel state if it was open
        if (localStorage.getItem('voicePanelOpen') === 'true') {
            dom.voicePanel.classList.remove('hidden');
            dom.voiceToggleBtn.classList.add('active');
        } else {
            dom.voicePanel.classList.add('hidden');
        }

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    // ─── Stars ───────────────────────────────────────────────────
    function createStars() {
        const count = 120;
        const frag = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const star = document.createElement('div');
            star.className = 'star' + (Math.random() < 0.15 ? ' large' : '');
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.setProperty('--dur', (2 + Math.random() * 4) + 's');
            star.style.setProperty('--max-opacity', (0.3 + Math.random() * 0.7).toFixed(2));
            star.style.animationDelay = (Math.random() * 5) + 's';
            frag.appendChild(star);
        }
        dom.starsContainer.appendChild(frag);
    }

    // ─── Events ──────────────────────────────────────────────────
    function bindEvents() {
        // Auth
        dom.loginForm.addEventListener('submit', handleLogin);
        dom.registerForm.addEventListener('submit', handleRegister);
        dom.verificationForm.addEventListener('submit', handleVerify);
        
        dom.showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            dom.loginForm.classList.remove('active');
            dom.registerForm.classList.add('active');
            dom.authError.textContent = '';
        });
        
        dom.showRegisterBack.addEventListener('click', (e) => {
            e.preventDefault();
            dom.verificationForm.classList.remove('active');
            dom.registerForm.classList.add('active');
            dom.authError.textContent = '';
        });
        
        dom.showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            dom.registerForm.classList.remove('active');
            dom.verificationForm.classList.remove('active');
            dom.loginForm.classList.add('active');
            dom.authError.textContent = '';
        });
        dom.logoutBtn.addEventListener('click', handleLogout);

        // Nav tabs
        dom.navTabs.forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // Message input
        dom.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        dom.sendBtn.addEventListener('click', sendMessage);

        // Room modal
        dom.createRoomBtn.addEventListener('click', () => {
            dom.roomModal.classList.remove('hidden');
            dom.roomNameInput.value = '';
            dom.roomNameInput.focus();
        });
        dom.modalCancel.addEventListener('click', () => dom.roomModal.classList.add('hidden'));
        dom.roomModal.querySelector('.modal-overlay').addEventListener('click', () => dom.roomModal.classList.add('hidden'));
        dom.modalCreate.addEventListener('click', createRoom);
        dom.roomNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') createRoom();
        });

        // Voice
        dom.voiceToggleBtn.addEventListener('click', toggleVoice);
        dom.voiceLeaveBtn.addEventListener('click', leaveVoice);
        if ($('#voice-mute-btn')) {
            $('#voice-mute-btn').addEventListener('click', toggleMute);
        }

        // Screen share
        if (dom.screenShareBtn) {
            dom.screenShareBtn.addEventListener('click', toggleScreenShare);
        }
        if (dom.screenShareClose) {
            dom.screenShareClose.addEventListener('click', () => {
                dom.screenShareViewer.classList.add('hidden');
            });
        }

        // Mobile sidebar
        dom.sidebarToggle.addEventListener('click', () => {
            dom.sidebar.classList.toggle('open');
        });
        dom.messagesContainer.addEventListener('click', () => {
            dom.sidebar.classList.remove('open');
        });

        // Profile modal
        dom.sidebarUserInfo.addEventListener('click', openProfileModal);
        dom.profileClose.addEventListener('click', () => dom.profileModal.classList.add('hidden'));
        dom.profileModal.querySelector('.modal-overlay').addEventListener('click', () => dom.profileModal.classList.add('hidden'));
        dom.avatarUpload.addEventListener('change', handleAvatarUpload);

        // Public Profile modal
        if (dom.publicProfileClose) {
            dom.publicProfileClose.addEventListener('click', () => dom.publicProfileModal.classList.add('hidden'));
            dom.publicProfileModal.querySelector('.modal-overlay').addEventListener('click', () => dom.publicProfileModal.classList.add('hidden'));
        }
        if (dom.publicProfileMessageBtn) {
            dom.publicProfileMessageBtn.addEventListener('click', () => {
                const username = dom.publicProfileUsername.textContent;
                if (username && username !== state.username) {
                    dom.publicProfileModal.classList.add('hidden');
                    openPrivateChat(username);
                }
            });
        }

        // Chat image upload
        dom.imageUploadBtn.addEventListener('click', () => dom.chatImageInput.click());
        dom.chatImageInput.addEventListener('change', handleChatImageSelect);
        dom.chatImagePreviewRemove.addEventListener('click', removeChatImage);

        // Project upload modal
        dom.uploadProjectBtn.addEventListener('click', openProjectUploadModal);
        dom.projectUploadCancel.addEventListener('click', closeProjectUploadModal);
        dom.projectUploadModal.querySelector('.modal-overlay').addEventListener('click', closeProjectUploadModal);
        dom.projectUploadSubmit.addEventListener('click', handleProjectUpload);
        dom.fileUploadArea.addEventListener('click', () => dom.projectFileInput.click());
        dom.projectFileInput.addEventListener('change', handleFileSelect);
        dom.removeFileBtn.addEventListener('click', removeSelectedFile);

        dom.imageUploadArea.addEventListener('click', () => dom.projectImageInput.click());
        dom.projectImageInput.addEventListener('change', handleImageSelect);
        dom.removeImageBtn.addEventListener('click', removeSelectedImage);

        // Project detail
        dom.projectBackBtn.addEventListener('click', closeProjectDetail);
        dom.projectDownloadBtn.addEventListener('click', downloadProject);

        // Save bio
        if (dom.saveBioBtn) {
            dom.saveBioBtn.addEventListener('click', handleSaveBio);
        }

        // Projects search
        dom.projectsSearchInput.addEventListener('input', () => {
            renderMainProjectGrid();
        });

        // Projects sort buttons
        document.querySelectorAll('.projects-sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.projects-sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.projectSort = btn.dataset.sort;
                renderMainProjectGrid();
                QSounds.click();
            });
        });
    }

    // ─── Auth ────────────────────────────────────────────────────
    async function checkAuth() {
        try {
            const res = await fetch('/me');
            const data = await res.json();
            if (data.authenticated) {
                state.username = data.username;
                state.displayName = data.username;
                state.email = data.email || '';
                state.avatar = data.avatar || null;
                state.avatarColor = data.avatar_color || 'hsl(0,0%,40%)';
                showChatView();
            }
        } catch (e) { }
    }

    async function handleLogin(e) {
        e.preventDefault();
        const username = $('#login-username').value.trim();
        const password = $('#login-password').value.trim();
        dom.authError.textContent = '';

        try {
            const res = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                state.username = data.username;
                state.displayName = data.username;
                const meRes = await fetch('/me');
                const meData = await meRes.json();
                state.email = meData.email || '';
                state.avatar = meData.avatar || null;
                state.avatarColor = meData.avatar_color || 'hsl(0,0%,40%)';
                state.bio = meData.bio || '';
                showChatView();
            } else {
                dom.authError.textContent = data.error;
                QSounds.error();
            }
        } catch (e) {
            dom.authError.textContent = 'Bağlantı hatası';
            QSounds.error();
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        const username = $('#reg-username').value.trim();
        const email = $('#reg-email').value.trim();
        const password = $('#reg-password').value.trim();
        dom.authError.textContent = '';

        if (!username || !email || !password) {
            dom.authError.textContent = 'Lütfen tüm alanları doldurun';
            return;
        }

        const originalBtnText = dom.regSubmitBtn.textContent;
        dom.regSubmitBtn.textContent = 'Kodu Gönderiyor...';
        dom.regSubmitBtn.disabled = true;

        try {
            const res = await fetch('/auth/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email })
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message || 'Doğrulama kodu gönderildi');
                dom.registerForm.classList.remove('active');
                dom.verificationForm.classList.add('active');
                dom.regSubmitBtn.disabled = false;
                dom.regSubmitBtn.textContent = originalBtnText;
            } else {
                dom.authError.textContent = data.error || 'Hata oluştu';
                QSounds.error();
                dom.regSubmitBtn.disabled = false;
                dom.regSubmitBtn.textContent = originalBtnText;
            }
        } catch (e) {
            dom.authError.textContent = 'Bağlantı hatası';
            QSounds.error();
            dom.regSubmitBtn.disabled = false;
            dom.regSubmitBtn.textContent = originalBtnText;
        }
    }

    async function handleVerify(e) {
        e.preventDefault();
        const username = $('#reg-username').value.trim();
        const email = $('#reg-email').value.trim();
        const password = $('#reg-password').value.trim();
        const verification_code = dom.regVerificationCode.value.trim();
        dom.authError.textContent = '';

        if (!verification_code) {
            dom.authError.textContent = 'Lütfen doğrulama kodunu girin';
            return;
        }

        const originalBtnText = dom.verifySubmitBtn.textContent;
        dom.verifySubmitBtn.textContent = 'Kayıt Olunuyor...';
        dom.verifySubmitBtn.disabled = true;

        try {
            const res = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, verification_code })
            });
            const data = await res.json();
            if (data.success) {
                state.username = data.username;
                state.displayName = data.username;
                state.email = email;
                state.avatar = null;
                state.bio = '';
                showChatView();
            } else {
                dom.authError.textContent = data.error;
                QSounds.error();
                dom.verifySubmitBtn.disabled = false;
                dom.verifySubmitBtn.textContent = originalBtnText;
            }
        } catch (e) {
            dom.authError.textContent = 'Bağlantı hatası';
            QSounds.error();
            dom.verifySubmitBtn.disabled = false;
            dom.verifySubmitBtn.textContent = originalBtnText;
        }
    }

    async function handleLogout() {
        await fetch('/logout', { method: 'POST' });
        if (state.ws) state.ws.close();
        state.ws = null;
        state.username = null;
        dom.authView.classList.add('active');
        dom.chatView.classList.remove('active');
        location.reload();
    }

    function showChatView() {
        dom.authView.classList.remove('active');
        dom.chatView.classList.add('active');
        updateMyAvatar();
        dom.myDisplayName.textContent = state.displayName;
        connectWebSocket();
        switchTab('general');
    }

    function updateMyAvatar() {
        if (state.avatar) {
            dom.myAvatar.innerHTML = `<img src="${state.avatar}" alt="avatar">`;
            dom.myAvatar.style.background = 'none';
        } else {
            dom.myAvatar.textContent = state.username[0].toUpperCase();
            dom.myAvatar.style.background = '';
        }
    }

    // ─── Profile Modal ───────────────────────────────────────────
    async function openProfileModal() {
        dom.profileModal.classList.remove('hidden');
        dom.profileUsername.textContent = state.username;
        dom.profileEmail.textContent = state.email || '—';
        dom.profileBioInput.value = state.bio || '';
        if (state.avatar) {
            dom.profileAvatarPreview.innerHTML = `<img src="${state.avatar}" alt="avatar">`;
            dom.profileAvatarPreview.style.background = 'none';
        } else {
            dom.profileAvatarPreview.textContent = state.username[0].toUpperCase();
            dom.profileAvatarPreview.style.background = '';
        }
        // Show join date
        try {
            const userInfo = await fetchUserAvatar(state.username);
            if (userInfo.created_at && dom.profileJoinDate) {
                const d = new Date(userInfo.created_at);
                dom.profileJoinDate.textContent = d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
            }
        } catch (e) { }
    }

    async function handleSaveBio() {
        const newBio = dom.profileBioInput.value.trim();
        try {
            const res = await fetch('/profile/bio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bio: newBio })
            });
            const data = await res.json();
            if (data.success) {
                state.bio = newBio;
                if (state.userAvatars[state.username]) {
                    state.userAvatars[state.username].bio = newBio;
                }
                showToast('Hakkımda güncellendi!');
            } else {
                showToast(data.error || 'Güncellenemedi');
                QSounds.error();
            }
        } catch (err) {
            showToast('Bağlantı hatası');
            QSounds.error();
        }
    }

    async function openPublicProfileModal(username) {
        if (username === state.username) {
            openProfileModal();
            return;
        }

        try {
            const userInfo = await fetchUserAvatar(username);

            dom.publicProfileModal.classList.remove('hidden');
            dom.publicProfileUsername.textContent = username;

            // Online status
            const isOnline = state.onlineUsers.includes(username);
            if (dom.publicProfileStatusBadge) {
                dom.publicProfileStatusBadge.className = 'profile-status-badge ' + (isOnline ? 'online' : 'offline');
            }
            if (dom.publicProfileStatusText) {
                dom.publicProfileStatusText.innerHTML = isOnline
                    ? '<span style="color: var(--online-green);">\u00c7evrimi\u00e7i</span>'
                    : '<span style="color: var(--text-muted);">\u00c7evrimd\u0131\u015f\u0131</span>';
            }

            if (userInfo.bio) {
                dom.publicProfileBio.textContent = '"' + userInfo.bio + '"';
            } else {
                dom.publicProfileBio.innerHTML = '<span class="text-muted">Bilgi yok</span>';
            }

            if (userInfo.avatar) {
                dom.publicProfileAvatarPreview.innerHTML = `<img src="${userInfo.avatar}" alt="avatar">`;
                dom.publicProfileAvatarPreview.style.background = 'none';
            } else {
                dom.publicProfileAvatarPreview.textContent = username[0].toUpperCase();
                dom.publicProfileAvatarPreview.style.background = '';
            }

            if (userInfo.created_at) {
                const createdTime = new Date(userInfo.created_at);
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                dom.publicProfileTime.textContent = createdTime.toLocaleDateString('tr-TR', options);
            } else {
                dom.publicProfileTime.textContent = "Bilinmiyor";
            }

            // Show/hide message button
            if (dom.publicProfileMessageBtn) {
                dom.publicProfileMessageBtn.style.display = (username !== state.username) ? '' : 'none';
            }

        } catch (e) {
            console.error("Profil y\u00fcklenemedi", e);
            showToast("Kullan\u0131c\u0131 profil bilgileri y\u00fcklenemedi");
        }
    }

    async function handleAvatarUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500000) {
            showToast('Dosya çok büyük (max 500KB)');
            QSounds.error();
            return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target.result;
            try {
                const res = await fetch('/profile/avatar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar: base64 })
                });
                const data = await res.json();
                if (data.success) {
                    state.avatar = data.avatar;
                    updateMyAvatar();
                    dom.profileAvatarPreview.innerHTML = `<img src="${data.avatar}" alt="avatar">`;
                    dom.profileAvatarPreview.style.background = 'none';
                    state.userAvatars[state.username] = { avatar: data.avatar };
                    showToast('Profil fotoğrafı güncellendi!');
                } else {
                    showToast(data.error || 'Avatar yüklenemedi');
                    QSounds.error();
                }
            } catch (err) {
                showToast('Avatar yüklenirken hata oluştu');
                QSounds.error();
            }
        };
        reader.readAsDataURL(file);
    }

    // ─── Fetch User Avatar ───────────────────────────────────────
    async function fetchUserAvatar(username) {
        if (state.userAvatars[username]) return state.userAvatars[username];
        try {
            const res = await fetch(`/user/${username}/info`);
            const data = await res.json();
            state.userAvatars[username] = data;
            return data;
        } catch (e) {
            return { avatar: null, avatar_color: 'hsl(0,0%,40%)' };
        }
    }

    function getAvatarHTML(username, userInfo, size = 32) {
        if (userInfo && userInfo.avatar) {
            return `<img src="${userInfo.avatar}" alt="${escapeHtml(username)}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:50%;">`;
        }
        return username[0].toUpperCase();
    }

    // ─── WebSocket ───────────────────────────────────────────────
    function connectWebSocket() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}/ws`;

        state.ws = new WebSocket(wsUrl);

        state.ws.onopen = () => {
            wsSend({ type: 'authenticate', username: state.username });
            if (localStorage.getItem('voicePanelOpen') === 'true') {
                const recentChannel = localStorage.getItem('voiceChannelPendingJoin') || 'general';
                setTimeout(() => {
                    joinVoice(recentChannel);
                }, 1000);
            }
        };

        state.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWsMessage(data);
            } catch (e) { }
        };

        state.ws.onclose = () => {
            // Reconnect after delay
            setTimeout(() => {
                if (state.username) connectWebSocket();
            }, 3000);
        };

        state.ws.onerror = () => { };

        // Load rooms & projects
        loadRooms();
        loadProjects();
    }

    function wsSend(data) {
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify(data));
        }
    }

    function handleWsMessage(data) {
        switch (data.type) {
            case 'user_list':
                state.onlineUsers = data.users.filter(u => u !== state.username);
                if (data.all_users) {
                    state.allUsers = data.all_users.filter(u => u !== state.username);
                }
                dom.onlineCount.textContent = data.users.length;
                renderUserList();
                break;
            case 'new_general_message':
                if (state.currentChat && state.currentChat.type === 'general') {
                    appendMessage(data);
                } else {
                    showToast(`${data.username}: ${data.text.substring(0, 50)}`);
                    showDesktopNotification("Q-Chat: Genel Sohbet", { body: `${data.username}: ${data.text.substring(0, 50)}` });
                }
                if (data.username !== state.username) {
                    QSounds.messageReceive();
                    if (state.currentChat?.type === 'general' && document.hidden) {
                        showDesktopNotification("Q-Chat: Genel Sohbet", { body: `${data.username}: ${data.text.substring(0, 50)}` });
                    }
                }
                break;
            case 'new_private_message':
                const otherUser = data.from === state.username ? data.to : data.from;
                if (state.currentChat && state.currentChat.type === 'private' && state.currentChat.id === otherUser) {
                    appendMessage(data);
                    if (data.from !== state.username && document.hidden) {
                        showDesktopNotification(`Yeni Mesaj: ${data.from}`, { body: data.text.substring(0, 50) });
                    }
                } else if (data.from !== state.username) {
                    state.unreadPrivate[data.from] = (state.unreadPrivate[data.from] || 0) + 1;
                    renderUserList();
                    showToast(`${data.from}: ${data.text.substring(0, 50)}`);
                    showDesktopNotification(`Yeni Mesaj: ${data.from}`, { body: data.text.substring(0, 50) });
                }
                if (data.from !== state.username) QSounds.messageReceive();
                break;
            case 'new_room_message':
                if (state.currentChat && state.currentChat.type === 'room' && state.currentChat.id === data.room_id) {
                    appendMessage(data);
                    if (data.username !== state.username && document.hidden) {
                        showDesktopNotification(`Oda: ${getRoomName(data.room_id)}`, { body: `${data.username}: ${data.text.substring(0, 40)}` });
                    }
                } else if (data.username !== state.username) {
                    state.unreadRooms[data.room_id] = (state.unreadRooms[data.room_id] || 0) + 1;
                    renderRoomList();
                    showToast(`[${getRoomName(data.room_id)}] ${data.username}: ${data.text.substring(0, 40)}`);
                    showDesktopNotification(`Oda: ${getRoomName(data.room_id)}`, { body: `${data.username}: ${data.text.substring(0, 40)}` });
                }
                if (data.username !== state.username) QSounds.messageReceive();
                break;
            case 'room_created':
                loadRooms();
                break;
            case 'room_deleted':
                handleRoomDeleted(data);
                break;
            case 'room_joined':
                if (data.username !== state.username) {
                    appendSystemMessage(`${data.username} odaya katildi`);
                }
                break;
            case 'room_left':
                appendSystemMessage(`${data.username} odadan ayrildi`);
                break;
            case 'error':
                showToast(data.message);
                QSounds.error();
                break;
            case 'user_offline':
                state.onlineUsers = state.onlineUsers.filter(u => u !== data.username);
                renderUserList();
                break;
            // Voice events
            case 'voice_user_joined': handleVoiceUserJoined(data); break;
            case 'voice_user_left': handleVoiceUserLeft(data); break;
            case 'voice_participants': handleVoiceParticipants(data); break;
            case 'voice_user_muted': handleVoiceMuted(data); break;
            case 'general_voice_participants_update': handleGeneralVoiceParticipants(data); break;
            case 'incoming_call': handleIncomingCall(data); break;
            case 'webrtc_offer': handleWebRTCOffer(data); break;
            case 'webrtc_answer': handleWebRTCAnswer(data); break;
            case 'webrtc_ice_candidate': handleICECandidate(data); break;
            // Screen share
            case 'screen_share_started': handleScreenShareStarted(data); break;
            case 'screen_share_stopped': handleScreenShareStopped(data); break;
            case 'screen_offer': handleScreenOffer(data); break;
            case 'screen_answer': handleScreenAnswer(data); break;
            case 'screen_ice_candidate': handleScreenICECandidate(data); break;
            // Message actions
            case 'message_deleted': handleMessageDeleted(data); break;
            case 'message_edited': handleMessageEdited(data); break;
        }
    }

    function handleMessageDeleted(data) {
        const msgEl = document.querySelector(`.message[data-id="${data.id}"]`);
        if (msgEl) {
            msgEl.remove();
        }
    }

    function handleRoomDeleted(data) {
        if (state.currentChat && state.currentChat.type === 'room' && state.currentChat.id === data.room_id) {
            showToast('Bulunduğunuz oda silindi.');
            switchTab('general');
        }
        loadRooms();
    }

    function handleMessageEdited(data) {
        const msgEl = document.querySelector(`.message[data-id="${data.id}"]`);
        if (msgEl) {
            const textEl = msgEl.querySelector('.message-text');
            if (textEl) {
                textEl.innerHTML = formatMessageText(escapeHtml(data.new_text)) + ' <span style="font-size: 0.7em; opacity: 0.6">(düzenlendi)</span>';
            }
        }
    }

    async function showDesktopNotification(title, options = {}) {
        if (!("Notification" in window)) return;
        if (Notification.permission !== "granted") return;
        if (!document.hidden && document.hasFocus()) return; // Don't notify if app is focused

        const notifOptions = {
            icon: '/static/icons/icon-192.png',
            badge: '/static/icons/icon-192.png',
            vibrate: [200, 100, 200],
            tag: options.tag || title, // Prevent duplicate notifications
            renotify: true,
            silent: false,
            ...options
        };

        try {
            // Use Service Worker for background/mobile support
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && reg.showNotification) {
                    await reg.showNotification(title, notifOptions);
                    return;
                }
            }

            // Fallback: native Notification API (desktop)
            const notification = new Notification(title, notifOptions);
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);
        } catch (err) {
            console.error("Notification Error:", err);
        }
    }

    // ─── Tab Switching ───────────────────────────────────────────
    function switchTab(tab) {
        state.currentTab = tab;
        dom.navTabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        dom.tabContents.forEach(c => {
            c.classList.toggle('active', c.dataset.content === tab);
        });
        QSounds.click();

        if (tab === 'projects') {
            showProjectsView();
        } else {
            hideProjectsView();
            if (tab === 'general') {
                openGeneralChat();
            }
        }
    }

    function showProjectsView() {
        // Hide chat elements
        dom.messagesContainer.classList.add('hidden');
        dom.chatInputArea.classList.add('hidden');
        dom.projectDetailView.classList.add('hidden');
        // Hide chat header voice button
        dom.voiceToggleBtn.style.display = 'none';
        dom.voicePanel.style.display = 'none';
        dom.chatTitle.textContent = 'Projeler';
        dom.chatSubtitle.textContent = '';
        // Show projects main view
        dom.projectsMainView.classList.remove('hidden');
        loadProjects();
    }

    function hideProjectsView() {
        dom.projectsMainView.classList.add('hidden');
        dom.projectDetailView.classList.add('hidden');
        dom.messagesContainer.classList.remove('hidden');
        dom.chatInputArea.classList.remove('hidden');
        dom.voiceToggleBtn.style.display = '';
        if (localStorage.getItem('voicePanelOpen') === 'true') {
            dom.voicePanel.classList.remove('hidden');
            dom.voicePanel.style.display = '';
        }
    }

    function showChatArea() {
        dom.messagesContainer.classList.remove('hidden');
        dom.chatInputArea.classList.remove('hidden');
        dom.projectDetailView.classList.add('hidden');
        dom.projectsMainView.classList.add('hidden');
    }

    // ─── General Chat ────────────────────────────────────────────
    async function openGeneralChat() {
        state.currentChat = { type: 'general', id: 'general', name: 'Genel Sohbet' };
        dom.chatTitle.textContent = 'Genel Sohbet';
        dom.chatSubtitle.textContent = '';
        updateGeneralVoiceSubtitle();
        dom.messageInput.placeholder = 'Genel sohbete mesaj yazin...';
        dom.messages.innerHTML = '';
        showChatArea();

        try {
            const res = await fetch('/history/general');
            const msgs = await res.json();
            for (const msg of msgs) {
                await appendMessage(msg, false);
            }
            scrollToBottom();
        } catch (e) { }
    }

    // ─── Private Chat ────────────────────────────────────────────
    async function openPrivateChat(username) {
        state.currentChat = { type: 'private', id: username, name: username };
        dom.chatTitle.textContent = username;
        dom.chatSubtitle.textContent = 'Özel mesaj';
        dom.messageInput.placeholder = `${username} ile mesajlaş...`;
        dom.messages.innerHTML = '';
        showChatArea();
        delete state.unreadPrivate[username];
        renderUserList();

        try {
            const res = await fetch(`/history/private/${username}`);
            const msgs = await res.json();
            for (const msg of msgs) {
                await appendMessage(msg, false);
            }
            scrollToBottom();
        } catch (e) { }

        dom.sidebar.classList.remove('open');
        QSounds.click();
    }

    // ─── Room Chat ───────────────────────────────────────────────
    async function openRoomChat(roomId) {
        const room = state.rooms.find(r => r.id === roomId);
        if (!room) return;

        wsSend({ type: 'join_room', room_id: roomId });

        state.currentChat = { type: 'room', id: roomId, name: room.name };
        dom.chatTitle.textContent = room.name;
        dom.chatSubtitle.textContent = `Sohbet odası`;
        dom.messageInput.placeholder = `${room.name} odasına mesaj yazın...`;
        dom.messages.innerHTML = '';
        showChatArea();
        delete state.unreadRooms[roomId];
        renderRoomList();

        try {
            const res = await fetch(`/rooms/${roomId}/history`);
            const msgs = await res.json();
            for (const msg of msgs) {
                await appendMessage(msg, false);
            }
            scrollToBottom();
        } catch (e) { }

        dom.sidebar.classList.remove('open');
        QSounds.click();
    }

    // ─── Send Message ────────────────────────────────────────────
    function sendMessage() {
        const text = dom.messageInput.value.trim();
        const image = state.pendingChatImage || null;
        if ((!text && !image) || !state.currentChat) return;

        const chat = state.currentChat;
        const payload = { text: text || '' };
        if (image) payload.image = image;

        if (chat.type === 'general') {
            wsSend({ type: 'general_message', ...payload });
        } else if (chat.type === 'private') {
            wsSend({ type: 'private_message', to: chat.id, ...payload });
        } else if (chat.type === 'room') {
            wsSend({ type: 'room_message', room_id: chat.id, ...payload });
        }

        dom.messageInput.value = '';
        removeChatImage();
        dom.messageInput.focus();
        QSounds.messageSend();
    }

    // \u2500\u2500\u2500 Chat Image Upload \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    function handleChatImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('G\u00f6rsel \u00e7ok b\u00fcy\u00fck (max 5MB)');
            QSounds.error();
            dom.chatImageInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            state.pendingChatImage = event.target.result;
            dom.chatImagePreviewImg.src = event.target.result;
            dom.chatImagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    function removeChatImage() {
        state.pendingChatImage = null;
        dom.chatImageInput.value = '';
        dom.chatImagePreview.classList.add('hidden');
        dom.chatImagePreviewImg.src = '';
    }

    // ─── Render Messages ─────────────────────────────────────────
    async function appendMessage(msg, animate = true) {
        const div = document.createElement('div');
        const isOwn = (msg.username === state.username) || (msg.from === state.username);
        const author = msg.username || msg.from;

        div.className = 'message' + (isOwn ? ' own' : '');
        div.dataset.id = msg.id; // Store ID for editing/deleting
        if (!animate) div.style.animation = 'none';

        const time = new Date(msg.timestamp);
        const timeStr = time.getHours().toString().padStart(2, '0') + ':' +
            time.getMinutes().toString().padStart(2, '0');

        let actionsHtml = '';
        if (isOwn) {
            actionsHtml = `
                <div class="message-actions" style="display:inline-flex; gap: 8px; margin-left: auto;">
                    <span class="edit-msg-btn" style="cursor:pointer; opacity: 0.5; display:flex;" title="D\u00fczenle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
                    <span class="delete-msg-btn" style="cursor:pointer; opacity: 0.5; display:flex;" title="Sil"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span>
                </div>
            `;
        }

        const userInfo = await fetchUserAvatar(author);
        const avatarContent = userInfo && userInfo.avatar
            ? `<img src="${userInfo.avatar}" alt="${escapeHtml(author)}">`
            : author[0].toUpperCase();

        const msgText = msg.text ? formatMessageText(escapeHtml(msg.text)) : '';
        const msgImage = msg.image ? `<div class="message-image"><img src="${msg.image}" alt="G\u00f6rsel" onclick="window.open(this.src,'_blank')"></div>` : '';

        div.innerHTML = `
            <div class="message-avatar clickable-avatar" data-username="${escapeHtml(author)}">${avatarContent}</div>
            <div class="message-body">
                <div class="message-header">
                    <span class="message-author clickable-name" data-username="${escapeHtml(author)}">${escapeHtml(author)}</span>
                    <span class="message-time">${timeStr}</span>
                    ${actionsHtml}
                </div>
                ${msgText ? `<div class="message-text">${msgText}</div>` : ''}
                ${msgImage}
            </div>
        `;

        // Add click events to avatars and names
        const avatarEl = div.querySelector('.clickable-avatar');
        const nameEl = div.querySelector('.clickable-name');

        if (avatarEl) {
            avatarEl.style.cursor = 'pointer';
            avatarEl.addEventListener('click', () => openPublicProfileModal(author));
        }
        if (nameEl) {
            nameEl.style.cursor = 'pointer';
            nameEl.addEventListener('click', () => {
                if (author !== state.username) {
                    openPrivateChat(author);
                } else {
                    openProfileModal();
                }
            });
            nameEl.style.textDecoration = 'underline';
            nameEl.style.textDecorationColor = 'transparent';
            nameEl.addEventListener('mouseenter', () => nameEl.style.textDecorationColor = 'inherit');
            nameEl.addEventListener('mouseleave', () => nameEl.style.textDecorationColor = 'transparent');
        }

        // Add Edit/Delete Events
        if (isOwn) {
            const editBtn = div.querySelector('.edit-msg-btn');
            const deleteBtn = div.querySelector('.delete-msg-btn');

            editBtn.addEventListener('click', () => {
                const newText = prompt("Mesajınızı düzenleyin:", msg.text);
                if (newText !== null && newText.trim() !== '') {
                    wsSend({
                        type: 'edit_message',
                        id: msg.id,
                        new_text: newText.trim(),
                        channel: state.currentChat.type === 'private' ? 'private' : state.currentChat.type === 'room' ? 'room' : 'general',
                        target: state.currentChat.id
                    });
                }
            });

            deleteBtn.addEventListener('click', () => {
                if (confirm("Bu mesajı silmek istediğinize emin misiniz?")) {
                    wsSend({
                        type: 'delete_message',
                        id: msg.id,
                        channel: state.currentChat.type === 'private' ? 'private' : state.currentChat.type === 'room' ? 'room' : 'general',
                        target: state.currentChat.id
                    });
                }
            });
        }

        dom.messages.appendChild(div);
        scrollToBottom();
    }

    function appendSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'message system';
        div.innerHTML = `<div class="message-text">${escapeHtml(text)}</div>`;
        dom.messages.appendChild(div);
        scrollToBottom();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
        });
    }

    // ─── User List ───────────────────────────────────────────────
    async function renderUserList() {
        dom.userList.innerHTML = '';

        const renderGroup = async (title, users, isOnline) => {
            if (users.length === 0) return;

            const titleEl = document.createElement('div');
            titleEl.className = 'user-list-group-title';
            titleEl.style.fontSize = '10px';
            titleEl.style.textTransform = 'uppercase';
            titleEl.style.color = 'var(--text-muted)';
            titleEl.style.padding = '8px 12px 4px';
            titleEl.style.letterSpacing = '1px';
            titleEl.textContent = title;
            dom.userList.appendChild(titleEl);

            for (const username of users) {
                const li = document.createElement('li');
                li.className = 'user-list-item';
                if (state.currentChat && state.currentChat.type === 'private' && state.currentChat.id === username) {
                    li.classList.add('active');
                }

                const unread = state.unreadPrivate[username];
                const badge = unread ? `<span class="unread-badge">${unread}</span>` : '';

                const userInfo = await fetchUserAvatar(username);
                const avatarContent = getAvatarHTML(username, userInfo, 28);

                li.innerHTML = `
                    <div class="user-status ${isOnline ? '' : 'offline'}"></div>
                    <div class="user-list-avatar" data-username="${escapeHtml(username)}">${avatarContent}</div>
                    <span class="name" data-username="${escapeHtml(username)}">${escapeHtml(username)}</span>
                    ${badge}
                `;

                const avatarEl = li.querySelector('.user-list-avatar');
                const nameEl = li.querySelector('.name');

                if (avatarEl) {
                    avatarEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openPublicProfileModal(username);
                    });
                }
                if (nameEl) {
                    nameEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openPrivateChat(username);
                    });
                    nameEl.style.textDecoration = 'underline';
                    nameEl.style.textDecorationColor = 'transparent';
                    nameEl.addEventListener('mouseenter', () => nameEl.style.textDecorationColor = 'inherit');
                    nameEl.addEventListener('mouseleave', () => nameEl.style.textDecorationColor = 'transparent');
                }

                li.addEventListener('click', () => openPrivateChat(username));
                dom.userList.appendChild(li);
            }
        };

        const offlineUsers = state.allUsers.filter(u => !state.onlineUsers.includes(u));

        await renderGroup('Çevrimiçi', state.onlineUsers, true);
        await renderGroup('Çevrimdışı', offlineUsers, false);
    }

    // ─── Room List ───────────────────────────────────────────────
    async function loadRooms() {
        try {
            const res = await fetch('/rooms/list');
            state.rooms = await res.json();
            renderRoomList();
        } catch (e) { }
    }

    function renderRoomList() {
        dom.roomList.innerHTML = '';
        state.rooms.forEach(room => {
            const li = document.createElement('li');
            li.className = 'room-list-item';
            if (state.currentChat && state.currentChat.type === 'room' && state.currentChat.id === room.id) {
                li.classList.add('active');
            }

            const unread = state.unreadRooms[room.id];
            const badge = unread ? `<span class="unread-badge">${unread}</span>` : '';
            
            const isCreator = room.creator === state.username;
            const deleteBtnHtml = isCreator ? `<button class="btn-icon delete-room-btn" data-id="${room.id}" title="Odayı Sil" style="margin-left: auto; color: #ff6b6b; padding: 4px;"><i data-lucide="trash-2" width="14" height="14" stroke-width="2"></i></button>` : '';

            li.innerHTML = `
                <span class="room-name">${escapeHtml(room.name)}</span>
                <span class="room-members" ${isCreator ? '' : 'style="margin-left: auto;"'}>${room.members_count}</span>
                ${badge}
                ${deleteBtnHtml}
            `;
            li.addEventListener('click', (e) => {
                if (e.target.closest('.delete-room-btn')) {
                    e.stopPropagation();
                    if (confirm('Bu odayı silmek istediğinize emin misiniz?')) {
                        wsSend({ type: 'delete_room', room_id: room.id });
                    }
                    return;
                }
                openRoomChat(room.id);
            });
            dom.roomList.appendChild(li);
        });
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function getRoomName(roomId) {
        const room = state.rooms.find(r => r.id === roomId);
        return room ? room.name : roomId;
    }

    // ─── Create Room ─────────────────────────────────────────────
    function createRoom() {
        const name = dom.roomNameInput.value.trim();
        if (!name) return;
        wsSend({ type: 'create_room', name });
        dom.roomModal.classList.add('hidden');
        QSounds.userJoin();
    }

    // ─── Projects ────────────────────────────────────────────────
    async function loadProjects() {
        try {
            const res = await fetch('/projects/list');
            state.projects = await res.json();
            renderProjectList();
            renderMainProjectGrid();
        } catch (e) { }
    }

    function renderProjectList() {
        dom.projectList.innerHTML = '';
        if (state.projects.length === 0) {
            dom.projectList.innerHTML = '<div class="empty-state-mini"><p>Henüz proje yok</p></div>';
            return;
        }
        state.projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card';
            const tags = project.tags && project.tags.length > 0
                ? project.tags.map(t => `<span class="project-tag">${escapeHtml(t)}</span>`).join('')
                : '';
            const imageStyle = project.image_filename
                ? `background-image: url('/static/projects/${project.image_filename}'); background-size: cover; background-position: center; border-radius: 6px;`
                : '';
            card.innerHTML = `
                <div class="project-card-header">
                    ${project.image_filename ? `<div style="width: 24px; height: 24px; flex-shrink: 0; margin-right: 8px; ${imageStyle}"></div>` : `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>`}
                    <span class="project-name">${escapeHtml(project.name)}</span>
                </div>
                <div class="project-card-meta">
                    <span>${escapeHtml(project.uploader)}</span>
                    <span>${formatFileSize(project.size)}</span>
                </div>
                ${tags ? `<div class="project-card-tags">${tags}</div>` : ''}
            `;
            card.addEventListener('click', () => openProjectDetail(project.id));
            dom.projectList.appendChild(card);
        });
    }

    function renderMainProjectGrid() {
        dom.projectsMainGrid.innerHTML = '';

        // Filter by search
        const query = (dom.projectsSearchInput.value || '').trim().toLowerCase();
        let filtered = state.projects;
        if (query) {
            filtered = filtered.filter(p => {
                const name = (p.name || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                const uploader = (p.uploader || '').toLowerCase();
                const tags = (p.tags || []).join(' ').toLowerCase();
                return name.includes(query) || desc.includes(query) || uploader.includes(query) || tags.includes(query);
            });
        }

        // Sort
        const sorted = [...filtered];
        switch (state.projectSort) {
            case 'newest':
                sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            case 'name':
                sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
                break;
            case 'downloads':
                sorted.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
                break;
            case 'size':
                sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
                break;
        }

        // Update count
        dom.projectsCount.textContent = filtered.length;

        if (sorted.length === 0) {
            dom.projectsMainGrid.innerHTML = `
                <div class="projects-empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <h4>${query ? 'Sonu\u00e7 bulunamad\u0131' : 'Hen\u00fcz proje yok'}</h4>
                    <p>${query ? '"' + escapeHtml(query) + '" ile e\u015fle\u015fen proje yok' : '\u0130lk projeyi y\u00fckleyerek ba\u015flay\u0131n'}</p>
                </div>
            `;
            return;
        }
        sorted.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-grid-card';
            const tags = project.tags && project.tags.length > 0
                ? project.tags.map(t => `<span class="project-tag">${escapeHtml(t)}</span>`).join('')
                : '';
            const desc = project.description
                ? `<p class="project-grid-desc">${escapeHtml(project.description.substring(0, 120))}${project.description.length > 120 ? '...' : ''}</p>`
                : '';
            const date = new Date(project.created_at);
            const dateStr = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

            let headerVisual = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
            `;

            if (project.image_filename) {
                headerVisual = `<div style="width: 100%; height: 120px; border-radius: 8px; margin-bottom: 12px; background-image: url('/static/projects/${project.image_filename}'); background-size: cover; background-position: center;"></div>`;
            }

            card.innerHTML = `
                ${project.image_filename ? headerVisual : ''}
                <div class="project-grid-card-header">
                    ${!project.image_filename ? headerVisual : ''}
                    <span class="project-grid-name">${escapeHtml(project.name)}</span>
                </div>
                ${desc}
                <div class="project-grid-footer">
                    <div class="project-grid-meta">
                        <span title="Y\u00fckleyen">${escapeHtml(project.uploader)}</span>
                        <span>${formatFileSize(project.size)}</span>
                    </div>
                    <div class="project-grid-meta">
                        <span>${dateStr}</span>
                        <span>\u2193 ${project.download_count || 0}</span>
                    </div>
                </div>
                ${tags ? `<div class="project-grid-tags">${tags}</div>` : ''}
            `;
            card.addEventListener('click', () => openProjectDetail(project.id));
            dom.projectsMainGrid.appendChild(card);
        });
    }

    function openProjectUploadModal() {
        dom.projectUploadModal.classList.remove('hidden');
        dom.projectNameInput.value = '';
        dom.projectDescInput.value = '';
        dom.projectTagsInput.value = '';
        dom.projectFileInput.value = '';
        dom.selectedFileInfo.classList.add('hidden');
        dom.fileUploadArea.classList.remove('hidden');
        dom.projectImageInput.value = '';
        dom.selectedImageInfo.classList.add('hidden');
        dom.imageUploadArea.classList.remove('hidden');
        dom.uploadProgress.classList.add('hidden');
        dom.projectNameInput.focus();
    }

    function closeProjectUploadModal() {
        dom.projectUploadModal.classList.add('hidden');
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 100 * 1024 * 1024 * 1024) {
            showToast('Dosya çok büyük (max 100GB)');
            QSounds.error();
            dom.projectFileInput.value = '';
            return;
        }
        dom.selectedFileName.textContent = `${file.name} (${formatFileSize(file.size)})`;
        dom.selectedFileInfo.classList.remove('hidden');
        dom.fileUploadArea.classList.add('hidden');
    }

    function removeSelectedFile() {
        dom.projectFileInput.value = '';
        dom.selectedFileInfo.classList.add('hidden');
        dom.fileUploadArea.classList.remove('hidden');
    }

    function handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
            showToast('Görsel çok büyük (max 20MB)');
            QSounds.error();
            dom.projectImageInput.value = '';
            return;
        }
        dom.selectedImageName.textContent = `${file.name} (${formatFileSize(file.size)})`;
        dom.selectedImageInfo.classList.remove('hidden');
        dom.imageUploadArea.classList.add('hidden');
    }

    function removeSelectedImage() {
        dom.projectImageInput.value = '';
        dom.selectedImageInfo.classList.add('hidden');
        dom.imageUploadArea.classList.remove('hidden');
    }

    async function handleProjectUpload() {
        const name = dom.projectNameInput.value.trim();
        const description = dom.projectDescInput.value.trim();
        const tags = dom.projectTagsInput ? dom.projectTagsInput.value.trim() : '';
        const file = dom.projectFileInput.files[0];
        const imageFile = dom.projectImageInput.files[0];

        if (!name) {
            showToast('Proje adı gereklidir');
            QSounds.error();
            return;
        }
        if (!file) {
            showToast('Dosya seçmelisiniz');
            QSounds.error();
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('tags', tags);
        formData.append('file', file);
        if (imageFile) {
            formData.append('image', imageFile);
        }

        // Show loading UI
        dom.uploadProgress.classList.remove('hidden');
        dom.uploadProgressBar.style.width = '0%';
        dom.projectUploadSubmit.disabled = true;
        dom.projectUploadCancel.disabled = true;
        if (dom.projectUploadLoading) dom.projectUploadLoading.classList.remove('hidden');

        function resetUploadUI() {
            dom.projectUploadSubmit.disabled = false;
            dom.projectUploadCancel.disabled = false;
            dom.uploadProgress.classList.add('hidden');
            dom.uploadProgressBar.style.width = '0%';
            if (dom.projectUploadLoading) dom.projectUploadLoading.classList.add('hidden');
        }

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/projects/upload');
            xhr.timeout = 0; // No timeout for large uploads

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const pct = (e.loaded / e.total) * 100;
                    dom.uploadProgressBar.style.width = pct + '%';
                }
            };

            xhr.onload = () => {
                resetUploadUI();
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.success) {
                            closeProjectUploadModal();
                            loadProjects();
                            showToast('Proje başarıyla yüklendi!');
                            QSounds.userJoin();
                        } else {
                            showToast(data.error || 'Yükleme başarısız');
                            QSounds.error();
                        }
                    } catch (parseErr) {
                        showToast('Sunucu yanıtı okunamadı');
                        QSounds.error();
                    }
                } else {
                    let errorMsg = 'Yükleme hatası';
                    try {
                        const errData = JSON.parse(xhr.responseText);
                        if (errData.error) errorMsg = errData.error;
                    } catch (_) { }
                    showToast(errorMsg + ' (HTTP ' + xhr.status + ')');
                    QSounds.error();
                }
            };

            xhr.onerror = () => {
                resetUploadUI();
                showToast('Bağlantı hatası — ağ bağlantınızı kontrol edin');
                QSounds.error();
            };

            xhr.ontimeout = () => {
                resetUploadUI();
                showToast('Yükleme zaman aşımına uğradı');
                QSounds.error();
            };

            xhr.send(formData);
        } catch (e) {
            resetUploadUI();
            showToast('Yükleme hatası: ' + e.message);
            QSounds.error();
        }
    }

    async function openProjectDetail(projectId) {
        try {
            const res = await fetch(`/projects/${projectId}`);
            const project = await res.json();

            state.currentProject = project;

            dom.projectDetailTitle.textContent = project.name;
            dom.projectDetailUploader.textContent = project.uploader;
            dom.projectDetailFilename.textContent = project.original_filename;
            dom.projectDetailSize.textContent = formatFileSize(project.size);
            dom.projectDetailDownloads.textContent = project.download_count;

            const date = new Date(project.created_at);
            dom.projectDetailDate.textContent = date.toLocaleDateString('tr-TR') + ' ' +
                date.getHours().toString().padStart(2, '0') + ':' +
                date.getMinutes().toString().padStart(2, '0');

            dom.projectDetailTags.innerHTML = project.tags && project.tags.length > 0
                ? project.tags.map(t => `<span class="project-tag">${escapeHtml(t)}</span>`).join('')
                : '<span class="text-muted">Etiket yok</span>';

            dom.projectDetailDescription.textContent = project.description || 'Açıklama yok';

            // Hero image
            const heroEl = $('#project-detail-hero');
            const heroImgEl = $('#project-detail-hero-img');
            if (project.image_filename && heroEl && heroImgEl) {
                heroImgEl.src = `/static/projects/${project.image_filename}`;
                heroEl.classList.remove('hidden');
            } else if (heroEl) {
                heroEl.classList.add('hidden');
            }

            // Size badge on download button
            const sizeBadge = $('#project-detail-size-badge');
            if (sizeBadge) {
                sizeBadge.textContent = formatFileSize(project.size);
            }

            // Hide everything else, show project detail
            dom.messagesContainer.classList.add('hidden');
            dom.chatInputArea.classList.add('hidden');
            dom.projectsMainView.classList.add('hidden');
            dom.projectDetailView.classList.remove('hidden');
            dom.chatTitle.textContent = project.name;
            dom.chatSubtitle.textContent = 'Proje Detayı';
        } catch (e) {
            showToast('Proje bilgisi yüklenemedi');
            QSounds.error();
        }
    }

    function closeProjectDetail() {
        dom.projectDetailView.classList.add('hidden');
        state.currentProject = null;
        if (state.currentTab === 'projects') {
            showProjectsView();
        } else {
            dom.messagesContainer.classList.remove('hidden');
            dom.chatInputArea.classList.remove('hidden');
        }
    }

    function downloadProject() {
        if (!state.currentProject) return;
        window.open(`/projects/${state.currentProject.id}/download`, '_blank');
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // ─── Voice Chat (WebRTC) ─────────────────────────────────────
    // ICE candidates that arrived before the peer connection was created
    const globalPendingCandidates = {};

    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
        // iceCandidatePoolSize intentionally removed to prevent premature candidate emission
    };

    async function toggleVoice() {
        if (state.voiceChannel) {
            leaveVoice();
        } else {
            await joinVoice();
        }
    }

    async function joinVoice(channelName = null) {
        if (!state.currentChat && !channelName) return;

        // getUserMedia requires a secure context (HTTPS or localhost)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast('❌ Sesli sohbet için güvenli bağlantı gereklidir! Lütfen HTTPS (port 443) üzerinden bağlanın.');
            QSounds.error();
            return;
        }

        const channel = channelName || (state.currentChat.type === 'general'
            ? 'general'
            : state.currentChat.type === 'room'
                ? state.currentChat.id
                : `private_${[state.username, state.currentChat.id].sort().join('_')}`);

        try {
            state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (e) {
            console.error('[Voice] getUserMedia error:', e.name, e.message);
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                showToast('❌ Mikrofon izni reddedildi. Tarayıcı izinlerini kontrol edin.');
            } else if (e.name === 'NotFoundError') {
                showToast('❌ Mikrofon bulunamadı. Ses giriş cihazınızı kontrol edin.');
            } else {
                showToast('❌ Mikrofona erişilemedi: ' + e.message);
            }
            QSounds.error();
            return;
        }

        state.voiceChannel = channel;
        state.isMuted = false;
        state.mutedUsers = {};
        wsSend({ type: 'voice_join', channel });

        dom.voiceToggleBtn.classList.add('active');
        dom.voicePanel.classList.remove('hidden');
        dom.voicePanel.style.display = '';
        localStorage.setItem('voicePanelOpen', 'true');
        localStorage.setItem('voiceChannelPendingJoin', channel);
        if (dom.screenShareBtn) dom.screenShareBtn.classList.remove('hidden');

        wsSend({ type: 'voice_get_participants', channel });
        QSounds.callConnect();
    }

    function leaveVoice() {
        if (state.voiceChannel) {
            wsSend({ type: 'voice_leave', channel: state.voiceChannel });
        }

        // Close all peer connections
        Object.values(state.peerConnections).forEach(pc => pc.close());
        state.peerConnections = {};

        // Stop and discard all remote audio elements (also remove from DOM)
        Object.entries(state.remoteAudios).forEach(([user, audio]) => {
            audio.pause();
            audio.srcObject = null;
            if (audio.parentNode) audio.parentNode.removeChild(audio);
        });
        state.remoteAudios = {};

        // Clear any globally pending ICE candidates
        Object.keys(globalPendingCandidates).forEach(k => delete globalPendingCandidates[k]);

        // Stop local stream
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            state.localStream = null;
        }

        // Stop screen sharing
        if (state.isScreenSharing) {
            stopScreenShare();
        }

        state.voiceChannel = null;
        state.voiceParticipantsList = [];
        state.mutedUsers = {};
        dom.voiceToggleBtn.classList.remove('active');
        dom.voicePanel.classList.add('hidden');
        dom.voicePanel.style.display = 'none';
        localStorage.setItem('voicePanelOpen', 'false');
        localStorage.removeItem('voiceChannelPendingJoin');
        dom.voiceParticipants.innerHTML = '';
        if (dom.screenShareBtn) dom.screenShareBtn.classList.add('hidden');
        QSounds.callEnd();
    }

    function toggleMute() {
        state.isMuted = !state.isMuted;
        if (state.localStream) {
            state.localStream.getAudioTracks().forEach(t => {
                t.enabled = !state.isMuted;
            });
        }
        const btn = $('#voice-mute-btn');
        btn.classList.toggle('muted', state.isMuted);
        wsSend({ type: 'voice_mute', channel: state.voiceChannel, muted: state.isMuted });
    }

    function handleVoiceUserJoined(data) {
        state.voiceParticipantsList = data.participants;
        renderVoiceParticipants();
        if (data.username !== state.username && state.voiceChannel === data.channel) {
            if (!state.peerConnections[data.username]) {
                // Alphabetical ordering: the username that sorts LOWER always initiates.
                // This is deterministic and prevents glare even for simultaneous joins.
                const weInitiate = state.username < data.username;
                console.log('[Voice] User joined:', data.username,
                    weInitiate ? '— WE initiate' : '— THEY will initiate');
                if (weInitiate) {
                    createPeerConnection(data.username, true);
                }
                // else: wait; they will send us an offer via handleWebRTCOffer
            }
        }
        QSounds.userJoin();
    }

    function handleVoiceUserLeft(data) {
        state.voiceParticipantsList = data.participants;
        renderVoiceParticipants();
        if (state.peerConnections[data.username]) {
            state.peerConnections[data.username].close();
            delete state.peerConnections[data.username];
        }
        // Clean up stored audio element (also remove from DOM)
        if (state.remoteAudios[data.username]) {
            const audio = state.remoteAudios[data.username];
            audio.pause();
            audio.srcObject = null;
            if (audio.parentNode) audio.parentNode.removeChild(audio);
            delete state.remoteAudios[data.username];
        }
        // Clear any pending candidates for this user
        delete globalPendingCandidates[data.username];
        QSounds.userLeave();
    }

    function handleVoiceParticipants(data) {
        state.voiceParticipantsList = data.participants;
        renderVoiceParticipants();
        // Alphabetical ordering: the username that sorts LOWER always initiates.
        // This prevents glare for simultaneous joins too, because both sides
        // apply the same deterministic rule independently.
        data.participants.forEach(p => {
            if (p !== state.username && !state.peerConnections[p]) {
                const weInitiate = state.username < p;
                console.log('[Voice] Existing participant:', p,
                    weInitiate ? '— WE initiate' : '— THEY will initiate');
                if (weInitiate) {
                    createPeerConnection(p, true);
                }
                // else: they will send us an offer via handleWebRTCOffer
            }
        });
    }

    function handleVoiceMuted(data) {
        state.mutedUsers[data.username] = data.muted;
        renderVoiceParticipants();
    }

    async function renderVoiceParticipants() {
        dom.voiceParticipants.innerHTML = '';
        for (const username of state.voiceParticipantsList) {
            const userInfo = await fetchUserAvatar(username);
            const avatarContent = getAvatarHTML(username, userInfo, 28);
            const isMuted = state.mutedUsers[username] || (username === state.username && state.isMuted);

            const div = document.createElement('div');
            div.className = 'voice-participant';
            div.innerHTML = `
                <div class="voice-participant-avatar">${avatarContent}</div>
                <span class="voice-participant-name">${escapeHtml(username)}</span>
                ${isMuted ? `<svg class="voice-muted-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg>` : ''}
            `;
            dom.voiceParticipants.appendChild(div);
        }
        state.generalVoiceParticipants = state.generalVoiceParticipants || [];
        updateGeneralVoiceSubtitle();
    }

    function updateGeneralVoiceSubtitle() {
        if (state.currentChat && state.currentChat.type === 'general') {
            if (state.generalVoiceParticipants && state.generalVoiceParticipants.length > 0) {
                const escapeName = (name) => {
                    return `<span class="voice-participant-name" style="cursor:pointer;" onclick="openPublicProfileModal('${escapeHtml(window.cleanName || name)}')">${escapeHtml(name)}</span>`;
                };

                // Allow using innerHTML by building string safely
                let listParams = [];
                state.generalVoiceParticipants.forEach(name => {
                    // Make it accessible for inline click handler
                    window.cleanName = name;
                    listParams.push(`<span style="cursor:pointer;" onclick="var app = typeof openPublicProfileModal !== 'undefined' ? openPublicProfileModal : null; if(app) app('${escapeHtml(name)}');">${escapeHtml(name)}</span>`);
                });

                dom.chatSubtitle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Sesli Sohbettekiler: <span style="color:var(--primary); font-weight:500;">${listParams.join(', ')}</span>`;
            } else {
                dom.chatSubtitle.textContent = '';
            }
        }
    }

    function handleGeneralVoiceParticipants(data) {
        state.generalVoiceParticipants = data.participants || [];
        updateGeneralVoiceSubtitle();
    }

    function handleIncomingCall(data) {
        const caller = data.from;
        if (state.voiceChannel === data.channel) return;
        showDesktopNotification("Gelen Arama", {
            body: `${caller} sizi sesli sohbete \u00e7a\u011f\u0131r\u0131yor.`,
            requireInteraction: true
        });
        showToast(`${caller} sizi ar\u0131yor!`);
        QSounds.callConnect();
    }

    // ─── WebRTC Peer Connections ──────────────────────────────────
    function createPeerConnection(username, isInitiator) {
        if (state.peerConnections[username]) {
            state.peerConnections[username].close();
            delete state.peerConnections[username];
        }

        console.log('[WebRTC] Creating peer connection to', username, 'initiator:', isInitiator);
        const pc = new RTCPeerConnection(rtcConfig);
        state.peerConnections[username] = pc;

        // Add local stream
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => {
                pc.addTrack(track, state.localStream);
            });
        } else {
            console.warn('[WebRTC] No local stream available when creating peer connection to', username);
        }

        // Handle remote stream
        // CRITICAL: The audio element MUST be appended to the DOM.
        // Detached Audio() elements have their play() silently blocked by
        // Chrome/Edge autoplay policy even when user gesture has occurred.
        pc.ontrack = (event) => {
            console.log('[WebRTC] Track received from', username,
                '| streams:', event.streams.length,
                '| kind:', event.track.kind);
            const stream = event.streams[0];
            if (!stream) {
                console.warn('[WebRTC] No stream in ontrack event from', username);
                return;
            }

            // Reuse existing DOM audio element or create and attach a new one
            let audio = state.remoteAudios[username];
            if (!audio) {
                audio = document.createElement('audio');
                audio.autoplay = true;
                audio.volume = 1.0;
                audio.muted = false;
                // Hidden but in DOM — required for autoplay to work
                audio.style.position = 'absolute';
                audio.style.width = '0';
                audio.style.height = '0';
                audio.style.opacity = '0';
                audio.style.pointerEvents = 'none';
                audio.setAttribute('playsinline', '');
                document.body.appendChild(audio);
                state.remoteAudios[username] = audio;
                console.log('[WebRTC] Created and attached audio element for', username);
            }
            audio.srcObject = stream;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('[WebRTC] Audio playing for', username);
                }).catch(e => {
                    console.warn('[WebRTC] Autoplay blocked for', username, '—', e.name, e.message);
                    // Autoplay blocked: retry on next user interaction
                    const resume = () => {
                        audio.play()
                            .then(() => console.log('[WebRTC] Audio resumed for', username))
                            .catch(err => console.error('[WebRTC] Resume failed:', err));
                        document.removeEventListener('click', resume);
                        document.removeEventListener('keydown', resume);
                    };
                    document.addEventListener('click', resume, { once: true });
                    document.addEventListener('keydown', resume, { once: true });
                });
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('[WebRTC] ICE candidate for', username, ':', event.candidate.type);
                wsSend({
                    type: 'webrtc_ice_candidate',
                    target: username,
                    candidate: event.candidate,
                    channel: state.voiceChannel
                });
            } else {
                console.log('[WebRTC] ICE gathering complete for', username);
            }
        };

        // Monitor ICE connection state for debugging and auto-reconnect
        pc.oniceconnectionstatechange = () => {
            console.log('[WebRTC] ICE state for', username, ':', pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                console.warn('[WebRTC] ICE failed for', username, '— scheduling reconnect');
                // BOTH sides can attempt reconnect using the same alphabetical rule,
                // so only the alphabetically smaller user actually re-initiates.
                const weReconnect = state.username < username;
                console.log('[WebRTC] Will we reconnect?', weReconnect, '(', state.username, '<', username, ')');
                if (weReconnect && state.voiceChannel) {
                    setTimeout(() => {
                        if (state.voiceChannel) {  // still in voice?
                            console.log('[WebRTC] Recreating connection to', username);
                            createPeerConnection(username, true);
                        }
                    }, 2000);
                }
            } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                console.log('[WebRTC] ✅ Connected to', username);
            } else if (pc.iceConnectionState === 'disconnected') {
                console.warn('[WebRTC] Disconnected from', username, '— waiting for recovery...');
                setTimeout(() => {
                    if (pc.iceConnectionState === 'disconnected' && state.voiceChannel) {
                        const weReconnect = state.username < username;
                        if (weReconnect) {
                            console.log('[WebRTC] Still disconnected, recreating connection to', username);
                            createPeerConnection(username, true);
                        }
                    }
                }, 8000);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state for', username, ':', pc.connectionState);
        };

        if (isInitiator) {
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    console.log('[WebRTC] Sending offer to', username);
                    wsSend({
                        type: 'webrtc_offer',
                        target: username,
                        offer: pc.localDescription,
                        channel: state.voiceChannel
                    });
                })
                .catch(e => console.error('[WebRTC] Offer error:', e));
        }

        return pc;
    }

    async function flushPendingCandidates(pc, fromUser) {
        if (pc._pendingCandidates && pc._pendingCandidates.length > 0) {
            console.log('[WebRTC] Flushing', pc._pendingCandidates.length, 'queued ICE candidates for', fromUser);
            for (const candidate of pc._pendingCandidates) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error('[WebRTC] Error adding queued ICE candidate:', e);
                }
            }
            pc._pendingCandidates = [];
        }
    }

    async function handleWebRTCOffer(data) {
        console.log('[WebRTC] Received offer from', data.from);
        const pc = createPeerConnection(data.from, false);

        // Transfer any globally queued candidates for this peer onto the new PC
        if (globalPendingCandidates[data.from] && globalPendingCandidates[data.from].length) {
            console.log('[WebRTC] Moving', globalPendingCandidates[data.from].length,
                'globally pending candidates to PC for', data.from);
            pc._pendingCandidates = (pc._pendingCandidates || [])
                .concat(globalPendingCandidates[data.from]);
            delete globalPendingCandidates[data.from];
        }

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            await flushPendingCandidates(pc, data.from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log('[WebRTC] Sending answer to', data.from);
            wsSend({
                type: 'webrtc_answer',
                target: data.from,
                answer: pc.localDescription,
                channel: data.channel
            });
        } catch (e) {
            console.error('[WebRTC] Answer error:', e);
        }
    }

    async function handleWebRTCAnswer(data) {
        console.log('[WebRTC] Received answer from', data.from);
        const pc = state.peerConnections[data.from];
        if (pc) {
            try {
                if (pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                    await flushPendingCandidates(pc, data.from);
                    console.log('[WebRTC] Answer set successfully for', data.from);
                } else {
                    console.warn('[WebRTC] Ignoring answer from', data.from, '— signaling state:', pc.signalingState);
                }
            } catch (e) {
                console.error('[WebRTC] Set answer error:', e);
            }
        } else {
            console.warn('[WebRTC] No peer connection found for answer from', data.from);
        }
    }

    async function handleICECandidate(data) {
        if (!data.candidate) return;
        const pc = state.peerConnections[data.from];

        if (!pc) {
            // Peer connection not created yet — queue the candidate globally.
            // This can happen if candidates arrive before the offer is processed.
            if (!globalPendingCandidates[data.from]) globalPendingCandidates[data.from] = [];
            globalPendingCandidates[data.from].push(data.candidate);
            console.log('[WebRTC] Queuing candidate globally (no PC yet) from', data.from);
            return;
        }

        try {
            if (pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
                // Remote description not set yet — queue on the PC object
                if (!pc._pendingCandidates) pc._pendingCandidates = [];
                pc._pendingCandidates.push(data.candidate);
                console.log('[WebRTC] Queuing candidate on PC (no remote desc) from', data.from);
            }
        } catch (e) {
            console.error('[WebRTC] ICE candidate error:', e);
        }
    }

    // ─── Screen Sharing ──────────────────────────────────────────
    async function toggleScreenShare() {
        if (state.isScreenSharing) {
            stopScreenShare();
        } else {
            await startScreenShare();
        }
    }

    async function startScreenShare() {
        if (!state.voiceChannel) return;

        try {
            state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } catch (e) {
            showToast('Ekran paylaşımı reddedildi');
            return;
        }

        state.isScreenSharing = true;
        if (dom.screenShareBtn) dom.screenShareBtn.classList.add('active');

        // Send screen share offer to all voice participants
        wsSend({ type: 'screen_share_start', channel: state.voiceChannel });

        // Create screen share peer connections
        state.voiceParticipantsList.forEach(p => {
            if (p !== state.username) {
                createScreenPeerConnection(p, true);
            }
        });

        // Stop when track ends
        state.screenStream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
        };
    }

    function stopScreenShare() {
        state.isScreenSharing = false;
        if (dom.screenShareBtn) dom.screenShareBtn.classList.remove('active');

        if (state.screenStream) {
            state.screenStream.getTracks().forEach(t => t.stop());
            state.screenStream = null;
        }

        Object.values(state.screenPeerConnections).forEach(pc => pc.close());
        state.screenPeerConnections = {};

        wsSend({ type: 'screen_share_stop', channel: state.voiceChannel });
    }

    function createScreenPeerConnection(username, isInitiator) {
        const pc = new RTCPeerConnection(rtcConfig);
        state.screenPeerConnections[username] = pc;

        if (state.screenStream) {
            state.screenStream.getTracks().forEach(track => {
                pc.addTrack(track, state.screenStream);
            });
        }

        pc.ontrack = (event) => {
            dom.screenShareVideo.srcObject = event.streams[0];
            dom.screenShareViewer.classList.remove('hidden');
            state.screenSharer = username;
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                wsSend({
                    type: 'screen_ice_candidate',
                    target: username,
                    candidate: event.candidate,
                    channel: state.voiceChannel
                });
            }
        };

        if (isInitiator) {
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    wsSend({
                        type: 'screen_offer',
                        target: username,
                        offer: pc.localDescription,
                        channel: state.voiceChannel
                    });
                })
                .catch(e => console.error('Screen offer error:', e));
        }

        return pc;
    }

    function handleScreenShareStarted(data) {
        state.screenSharer = data.username;
        showToast(`${data.username} ekranını paylaşıyor`);
    }

    function handleScreenShareStopped(data) {
        state.screenSharer = null;
        dom.screenShareViewer.classList.add('hidden');
        dom.screenShareVideo.srcObject = null;
        if (state.screenPeerConnections[data.username]) {
            state.screenPeerConnections[data.username].close();
            delete state.screenPeerConnections[data.username];
        }
    }

    async function handleScreenOffer(data) {
        const pc = createScreenPeerConnection(data.from, false);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            wsSend({
                type: 'screen_answer',
                target: data.from,
                answer: pc.localDescription,
                channel: data.channel
            });
        } catch (e) {
            console.error('Screen answer error:', e);
        }
    }

    async function handleScreenAnswer(data) {
        const pc = state.screenPeerConnections[data.from];
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (e) { }
        }
    }

    async function handleScreenICECandidate(data) {
        const pc = state.screenPeerConnections[data.from];
        if (pc && data.candidate) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) { }
        }
    }

    // ─── Toast Notifications ─────────────────────────────────────
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ─── Helpers ─────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatMessageText(text) {
        if (!text) return '';

        // 1. Convert URLs to links first
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        let formattedText = text.replace(urlRegex, function (url) {
            return `<a href="${url.replace(/&amp;/g, '&')}" target="_blank" rel="noopener noreferrer" class="chat-link">${url}</a>`;
        });

        // 2. Add embeddings below message
        let embeds = [];
        const unescapedText = text.replace(/&amp;/g, '&');

        // YouTube parsing
        const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi;
        let ytMatch;
        while ((ytMatch = ytRegex.exec(unescapedText)) !== null) {
            let videoId = ytMatch[1];
            embeds.push(`<div class="embed-container"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`);
        }

        // Spotify parsing
        const spotifyRegex = /https:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/gi;
        let spMatch;
        while ((spMatch = spotifyRegex.exec(unescapedText)) !== null) {
            let type = spMatch[1];
            let id = spMatch[2];
            embeds.push(`<div class="embed-container"><iframe src="https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0" frameborder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`);
        }

        if (embeds.length > 0) {
            formattedText += '<div class="message-embeds">' + embeds.join('') + '</div>';
        }

        return formattedText;
    }

    // ─── Start ───────────────────────────────────────────────────
    init();
})();
