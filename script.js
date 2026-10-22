// Konfigurasi Koneksi Supabase
const SUPABASE_URL = 'https://pmtjequlrdxpjaeeswhd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtdGplcXVscmR4cGphZWVzd2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MzE1MTYsImV4cCI6MjEwODEwNzUxNn0.Xm9hlw-iWtvho3uHavQ4A3I53hivewoYHaPJB6oYEws';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Aplikasi
let state = {
    currentUser: null,
    balance: 0,
    userName: 'Galang',
    userVa: '•••• 8829',
    userPin: '123456',
    avatarUrl: '',
    transactions: [],
    pendingTransaction: null,
    tempNewAvatar: ''
};

// DOM Elements
const balanceDisplay = document.getElementById('balanceDisplay');
const historyList = document.getElementById('historyList');
const txCount = document.getElementById('txCount');
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const themeToggle = document.getElementById('themeToggle');
const pinModal = document.getElementById('pinModal');
const modalTxDetail = document.getElementById('modalTxDetail');
const dashboardModal = document.getElementById('dashboardModal');
const profileModal = document.getElementById('profileModal');
const txCustomDate = document.getElementById('txCustomDate');
const authScreen = document.getElementById('authScreen');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Cek Session LocalStorage
    const savedUser = localStorage.getItem('dompetai_user');
    if (savedUser) {
        state.currentUser = JSON.parse(savedUser);
        if (authScreen) authScreen.classList.add('hidden');
        await fetchAppDataFromSupabase();
    }

    setupPinInputs();

    // Otomatis Kompres Foto saat dipilih dari Galeri / Penyimpanan Internal
    const fileInput = document.getElementById('inputFileUpload');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                compressAndResizeImage(file, 300, 300, 0.7, function(compressedBase64) {
                    const previewBox = document.getElementById('modalAvatarPreviewBox');
                    if (previewBox) {
                        previewBox.innerHTML = `<img src="${compressedBase64}" alt="Preview">`;
                    }
                    state.tempNewAvatar = compressedBase64;
                });
            }
        });
    }

    // Theme Switcher
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const html = document.documentElement;
            const currentTheme = html.getAttribute('data-theme');
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', nextTheme);
            themeToggle.querySelector('i').className = nextTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
        });
    }
});

// SWITCH FORM LOGIN & REGISTER
function toggleAuthMode(mode) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (mode === 'register') {
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
    } else {
        if (registerForm) registerForm.classList.add('hidden');
        if (loginForm) loginForm.classList.remove('hidden');
    }
}

// LOGIKA REGISTER AKUN BARU
async function handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('regFullName').value.trim();
    const username = document.getElementById('regUsername').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value.trim();

    if (!fullName || !username || !password) return;

    try {
        // Cek ketersediaan username
        let { data: existingUser } = await supabaseClient
            .from('wallet_users')
            .select('*')
            .eq('username', username)
            .maybeSingle();

        if (existingUser) {
            alert('Username sudah terpakai, silakan gunakan username lain!');
            return;
        }

        // Buat akun baru di wallet_users
        let { data: newUser, error: errUser } = await supabaseClient
            .from('wallet_users')
            .insert([{ username, password }])
            .select()
            .single();

        if (errUser) throw errUser;

        // Simpan session user
        state.currentUser = newUser;
        localStorage.setItem('dompetai_user', JSON.stringify(newUser));

        if (authScreen) authScreen.classList.add('hidden');
        await fetchAppDataFromSupabase();

        // Update nama awal profil
        await saveProfileDataDirect(fullName, '8829-1029-' + Math.floor(1000 + Math.random() * 9000), '123456', '');

        appendAndSaveBotMessage(`Selamat datang <b>${fullName}</b>! 👋 Akun Anda berhasil dibuat.`);
    } catch (err) {
        alert('Gagal pendaftaran: ' + err.message);
    }
}

// LOGIKA LOGIN
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value.trim();

    try {
        let { data: user, error } = await supabaseClient
            .from('wallet_users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .maybeSingle();

        if (error || !user) {
            alert('Username atau Password salah!');
            return;
        }

        state.currentUser = user;
        localStorage.setItem('dompetai_user', JSON.stringify(user));

        if (authScreen) authScreen.classList.add('hidden');
        chatMessages.innerHTML = '';
        await fetchAppDataFromSupabase();
    } catch (err) {
        alert('Gagal login: ' + err.message);
    }
}

// LOGOUT AKUN
function handleLogout() {
    if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
        localStorage.removeItem('dompetai_user');
        state.currentUser = null;
        location.reload();
    }
}

// FORMAT TANGGAL CANTIK
function formatFormattedDate(dateObj = new Date()) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}, ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
}

function toDatetimeLocalString(dateObj = new Date()) {
    return `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}T${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
}

// FUNGSI KOMPRESI FOTO
function compressAndResizeImage(file, maxWidth, maxHeight, quality, callback) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
            } else {
                if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// FETCH DATA TERPISAH PER USER
async function fetchAppDataFromSupabase() {
    if (!state.currentUser) return;
    const currentUserId = state.currentUser.id;

    try {
        // 1. Ambil Profil User
        let { data: profile } = await supabaseClient
            .from('wallet_profile')
            .select('*')
            .eq('user_id', currentUserId)
            .maybeSingle();

        if (profile) {
            state.balance = parseFloat(profile.balance);
            state.userName = profile.user_name || state.currentUser.username;
            state.userPin = profile.user_pin || '123456';
            state.userVa = profile.virtual_account || '•••• 8829';
            state.avatarUrl = profile.avatar_url || '';
            state.tempNewAvatar = state.avatarUrl;
        } else {
            // Jika akun baru, buat entry profil default khusus user_id ini
            let { data: newProf } = await supabaseClient
                .from('wallet_profile')
                .insert([{
                    user_id: currentUserId,
                    balance: 0,
                    user_name: state.currentUser.username,
                    user_pin: '123456',
                    virtual_account: '8829-1029-' + Math.floor(1000 + Math.random() * 9000)
                }])
                .select()
                .single();

            if (newProf) {
                state.balance = 0;
                state.userName = newProf.user_name;
                state.userPin = newProf.user_pin;
                state.userVa = newProf.virtual_account;
                state.avatarUrl = '';
                state.tempNewAvatar = '';
            }
        }
        updateProfileUI();

        // 2. Ambil Transaksi User
        let { data: txs } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', currentUserId)
            .order('id', { ascending: true });

        state.transactions = txs || [];
        updateUI();

        // 3. Ambil Chat User
        let { data: chats } = await supabaseClient
            .from('chat_history')
            .select('*')
            .eq('user_id', currentUserId)
            .order('id', { ascending: true });

        chatMessages.innerHTML = '';
        if (chats && chats.length > 0) {
            chats.forEach(c => {
                if (c.sender === 'user') {
                    appendUserMessageUI(c.message);
                } else {
                    appendBotMessageUI(c.message);
                }
            });
        } else {
            appendAndSaveBotMessage(`Halo <b>${state.userName}</b>! 👋 Saya <b>DompetAI Assistant</b>. Ada yang bisa saya bantu hari ini?`);
        }
    } catch (err) {
        console.error("Gagal memuat data:", err);
    }
}

function updateProfileUI() {
    if (document.getElementById('userName')) document.getElementById('userName').textContent = state.userName;
    if (document.getElementById('sidebarUserName')) document.getElementById('sidebarUserName').textContent = state.userName;
    if (document.getElementById('cardVirtualNum')) document.getElementById('cardVirtualNum').textContent = state.userVa;

    if (document.getElementById('inputProfileName')) document.getElementById('inputProfileName').value = state.userName;
    if (document.getElementById('inputProfileVA')) document.getElementById('inputProfileVA').value = state.userVa;
    if (document.getElementById('inputProfilePin')) document.getElementById('inputProfilePin').value = state.userPin;

    const topAvatarBox = document.getElementById('topProfileAvatarBox');
    if (topAvatarBox) {
        topAvatarBox.innerHTML = state.avatarUrl ? `<img src="${state.avatarUrl}" alt="Avatar">` : `<i class="fa-solid fa-user"></i>`;
    }

    const modalAvatarBox = document.getElementById('modalAvatarPreviewBox');
    if (modalAvatarBox) {
        modalAvatarBox.innerHTML = state.avatarUrl ? `<img src="${state.avatarUrl}" alt="Avatar Large">` : `<i class="fa-solid fa-user"></i>`;
    }
}

// SIMPAN PROFIL KUSTOM
async function saveProfileData(e) {
    e.preventDefault();
    const newName = document.getElementById('inputProfileName').value.trim();
    const newVA = document.getElementById('inputProfileVA').value.trim();
    const newPin = document.getElementById('inputProfilePin').value.trim();
    const finalAvatar = state.tempNewAvatar || state.avatarUrl;

    if (!newName || !newVA || !newPin) return alert("Harap isi semua kolom!");

    await saveProfileDataDirect(newName, newVA, newPin, finalAvatar);
    closeProfileModal();
    appendAndSaveBotMessage(`👤 <b>Profil & Foto Berhasil Diperbarui!</b>`);
}

async function saveProfileDataDirect(newName, newVA, newPin, finalAvatar) {
    if (!state.currentUser) return;
    try {
        await supabaseClient.from('wallet_profile').update({
            user_name: newName,
            virtual_account: newVA,
            user_pin: newPin,
            avatar_url: finalAvatar
        }).eq('user_id', state.currentUser.id);

        state.userName = newName;
        state.userVa = newVA;
        state.userPin = newPin;
        state.avatarUrl = finalAvatar;
        updateProfileUI();
    } catch (err) {
        console.error("Gagal menyimpan profil:", err);
    }
}

function openProfileModal() {
    state.tempNewAvatar = state.avatarUrl;
    const fileInp = document.getElementById('inputFileUpload');
    if (fileInp) fileInp.value = '';
    updateProfileUI();
    profileModal.classList.add('active');
}

function closeProfileModal() { profileModal.classList.remove('active'); }

async function clearAllData() {
    if (!confirm("⚠️ Apakah Anda yakin ingin menghapus seluruh transaksi & riwayat chat Anda?")) return;
    if (!state.currentUser) return;

    const currentUserId = state.currentUser.id;
    try {
        await supabaseClient.from('transactions').delete().eq('user_id', currentUserId);
        await supabaseClient.from('chat_history').delete().eq('user_id', currentUserId);
        await supabaseClient.from('wallet_profile').update({ balance: 0 }).eq('user_id', currentUserId);

        state.balance = 0;
        state.transactions = [];
        updateUI();
        closeDashboardModal();
        chatMessages.innerHTML = '';
        appendAndSaveBotMessage(`🗑️ <b>Semua data dan riwayat chat Anda telah dibersihkan!</b>`);
    } catch (err) {
        console.error(err);
    }
}

function formatRupiah(amount) { return 'Rp ' + amount.toLocaleString('id-ID'); }

function updateUI() {
    if (balanceDisplay) balanceDisplay.textContent = formatRupiah(state.balance);
    if (txCount) txCount.textContent = state.transactions.length;

    if (historyList) {
        historyList.innerHTML = '';
        state.transactions.slice().reverse().forEach(tx => {
            const item = document.createElement('div');
            item.className = 'tx-item';
            item.innerHTML = `
                <div class="tx-info">
                    <div class="tx-icon" style="background: ${tx.is_plus ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${tx.is_plus ? '#10b981' : '#ef4444'}">
                        <i class="fa-solid ${tx.is_plus ? 'fa-arrow-down-left' : 'fa-arrow-up-right'}"></i>
                    </div>
                    <div>
                        <strong style="display:block; font-size: 0.8rem;">${tx.title}</strong>
                        <small style="color: var(--text-muted); font-size: 0.68rem;"><i class="fa-regular fa-clock"></i> ${tx.date}</small>
                    </div>
                </div>
                <div class="tx-amount ${tx.is_plus ? 'plus' : 'minus'}">${tx.is_plus ? '+' : '-'}${formatRupiah(tx.amount)}</div>
            `;
            historyList.appendChild(item);
        });
    }
}

function handleFormSubmit(e) {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    appendAndSaveUserMessage(text);
    userInput.value = '';

    const typingElem = showTypingIndicator();
    setTimeout(() => {
        typingElem.remove();
        processBotResponse(text);
    }, 600);
}

function quickFillInput(text) { userInput.value = text; userInput.focus(); }
function quickSendMessage(text) { userInput.value = text; handleFormSubmit(new Event('submit')); }

// SIMPAN CHAT KE SUPABASE PER USER
async function appendAndSaveUserMessage(text) {
    appendUserMessageUI(text);
    if (state.currentUser) {
        await supabaseClient.from('chat_history').insert([{
            user_id: state.currentUser.id,
            sender: 'user',
            message: text
        }]);
    }
}

async function appendAndSaveBotMessage(htmlContent) {
    appendBotMessageUI(htmlContent);
    if (state.currentUser) {
        await supabaseClient.from('chat_history').insert([{
            user_id: state.currentUser.id,
            sender: 'bot',
            message: htmlContent
        }]);
    }
}

function appendUserMessageUI(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message user';
    msgDiv.innerHTML = `
        <div class="msg-avatar">${state.avatarUrl ? `<img src="${state.avatarUrl}" alt="User">` : `<i class="fa-solid fa-user"></i>`}</div>
        <div class="msg-bubble">${escapeHtml(text)}<span class="msg-time">${getCurrentTime()}</span></div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

function appendBotMessageUI(htmlContent) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot';
    msgDiv.innerHTML = `
        <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="msg-bubble">${htmlContent}<span class="msg-time">${getCurrentTime()}</span></div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.innerHTML = `<div class="msg-avatar"><i class="fa-solid fa-robot"></i></div><div class="msg-bubble typing"><span></span><span></span><span></span></div>`;
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
}

function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }
function getCurrentTime() { const now = new Date(); return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'); }
function escapeHtml(text) { const div = document.createElement('div'); div.innerText = text; return div.innerHTML; }
function capitalizeFirstLetter(string) { return string.charAt(0).toUpperCase() + string.slice(1); }

function parseNominal(text) {
    let matchK = text.match(/(\d+[\d\.]*)\s*(k|rb|ribu)/i);
    if (matchK) return parseFloat(matchK[1].replace(',', '.')) * 1000;
    let matchJt = text.match(/(\d+[\d\.]*)\s*(jt|juta)/i);
    if (matchJt) return parseFloat(matchJt[1].replace(',', '.')) * 1000000;
    let matchNum = text.match(/(\d+[\d\.]*)/);
    if (matchNum) return parseInt(matchNum[0].replace(/\./g, ''), 10);
    return null;
}

function processBotResponse(input) {
    const lower = input.toLowerCase();
    const amount = parseNominal(lower);

    if (/profil|profile|akun|edit/i.test(lower)) {
        openProfileModal();
        appendAndSaveBotMessage(`👤 Membuka <b>Halaman Custom Profil Pemilik E-Wallet</b> Anda.`);
        return;
    }

    if (/riwayat|histori|catatan|laporan|dashboard|transaksi/.test(lower) && !amount) {
        openDashboard();
        appendAndSaveBotMessage(`📊 Membuka <b>Dashboard & Catatan Keuangan Supabase</b>.`);
        return;
    }

    if (/saldo|uang|sisa|cek|kantong|dompet/.test(lower) && !amount) {
        appendAndSaveBotMessage(`Total saldo aktif Anda saat ini adalah <b>${formatRupiah(state.balance)}</b>.`);
        return;
    }

    if (/top\s*up|isi|tambah|dapet|dapat|terima|dikasih|gajian|masuk|setor/.test(lower)) {
        if (!amount) {
            appendAndSaveBotMessage(`Sebutkan nominal pemasukannya ya. Contoh: <i>"Gajian 500k"</i>`);
            return;
        }
        state.pendingTransaction = { type: 'topup', title: capitalizeFirstLetter(input), amount: amount, is_plus: true };
        modalTxDetail.textContent = `Pemasukan: ${capitalizeFirstLetter(input)} (${formatRupiah(amount)})`;
        openPinModal();
        return;
    }

    if (/ngutang|ngutangi|piutang|pinjam|pinjem|transfer|kirim|bayar|beli|jajan|makan|minum|kopi|soto|bakso|pulsa|listrik|kasih/.test(lower) || amount) {
        if (!amount) {
            appendAndSaveBotMessage(`Berapa nominalnya? Contoh: <i>"Ngutangi Dava 5000"</i>`);
            return;
        }
        if (amount > state.balance) {
            appendAndSaveBotMessage(`❌ Saldo Anda tidak cukup! (Saldo: ${formatRupiah(state.balance)}, Dibutuhkan: ${formatRupiah(amount)})`);
            return;
        }
        state.pendingTransaction = { type: 'payment', title: capitalizeFirstLetter(input), amount: amount, is_plus: false };
        modalTxDetail.textContent = `Konfirmasi: ${capitalizeFirstLetter(input)} (${formatRupiah(amount)})`;
        openPinModal();
        return;
    }

    appendAndSaveBotMessage(`Saya kurang paham perintah itu.<br><br><b>Coba ketik bahasa santai seperti:</b><br>• <i>"Ngutangi Dava 5000"</i><br>• <i>"Cek saldo"</i>`);
}

function setupPinInputs() {
    const inputs = document.querySelectorAll('.pin-digit');
    inputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            if (input.value.length === 1 && index < inputs.length - 1) inputs[index + 1].focus();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) inputs[index - 1].focus();
        });
    });
}

function openPinModal() {
    pinModal.classList.add('active');
    if (txCustomDate) txCustomDate.value = toDatetimeLocalString(new Date());
    const inputs = document.querySelectorAll('.pin-digit');
    inputs.forEach(i => i.value = '');
    setTimeout(() => inputs[0].focus(), 100);
}

function closePinModal(cancelled = true) {
    pinModal.classList.remove('active');
    if (cancelled && state.pendingTransaction) {
        appendAndSaveBotMessage(`❌ Transaksi <b>${state.pendingTransaction.title}</b> dibatalkan.`);
        state.pendingTransaction = null;
    }
}

function submitPin() {
    const inputs = document.querySelectorAll('.pin-digit');
    let enteredPin = '';
    inputs.forEach(i => enteredPin += i.value);

    if (enteredPin === state.userPin) {
        executePendingTransaction();
        closePinModal(false);
    } else {
        alert('PIN Salah!');
        inputs.forEach(i => i.value = '');
        inputs[0].focus();
    }
}

async function executePendingTransaction() {
    const tx = state.pendingTransaction;
    if (!tx || !state.currentUser) return;

    let newBalance = tx.is_plus ? state.balance + tx.amount : state.balance - tx.amount;
    let finalDateStr = formatFormattedDate();
    if (txCustomDate && txCustomDate.value) {
        finalDateStr = formatFormattedDate(new Date(txCustomDate.value));
    }

    try {
        let { data, error: errTx } = await supabaseClient.from('transactions').insert([{
            user_id: state.currentUser.id,
            type: tx.type,
            title: tx.title,
            amount: tx.amount,
            date: finalDateStr,
            is_plus: tx.is_plus
        }]).select();

        let { error: errProf } = await supabaseClient.from('wallet_profile')
            .update({ balance: newBalance })
            .eq('user_id', state.currentUser.id);

        if (errTx || errProf) {
            alert("Gagal menyimpan transaksi!");
            return;
        }

        state.balance = newBalance;
        if (data && data.length > 0) state.transactions.push(data[0]);
        updateUI();

        appendAndSaveBotMessage(`
            ✅ <b>Berhasil Dicatat & Disimpan ke Cloud!</b>
            <div class="bot-card-res">
                • Transaksi: <b>${tx.title}</b><br>
                • Nominal: <b>${formatRupiah(tx.amount)}</b><br>
                • Tanggal: <b>${finalDateStr}</b><br>
                • Sisa Saldo: <b>${formatRupiah(state.balance)}</b>
            </div>
        `);
    } catch (err) {
        console.error(err);
    }
    state.pendingTransaction = null;
}

function openDashboard() {
    const totalIn = state.transactions.filter(t => t.is_plus).reduce((acc, curr) => acc + curr.amount, 0);
    const totalOut = state.transactions.filter(t => !t.is_plus).reduce((acc, curr) => acc + curr.amount, 0);

    document.getElementById('dashTotalIn').textContent = formatRupiah(totalIn);
    document.getElementById('dashTotalOut').textContent = formatRupiah(totalOut);
    document.getElementById('dashTxCount').textContent = state.transactions.length;

    const dashHistoryList = document.getElementById('dashHistoryList');
    dashHistoryList.innerHTML = '';

    state.transactions.slice().reverse().forEach(tx => {
        const item = document.createElement('div');
        item.className = 'tx-item';
        item.innerHTML = `
            <div class="tx-info">
                <div class="tx-icon" style="background: ${tx.is_plus ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${tx.is_plus ? '#10b981' : '#ef4444'}">
                    <i class="fa-solid ${tx.is_plus ? 'fa-arrow-down-left' : 'fa-arrow-up-right'}"></i>
                </div>
                <div>
                    <strong style="display:block; font-size: 0.8rem;">${tx.title}</strong>
                    <small style="color: var(--text-muted); font-size: 0.68rem;"><i class="fa-regular fa-clock"></i> ${tx.date}</small>
                </div>
            </div>
            <div class="tx-amount ${tx.is_plus ? 'plus' : 'minus'}">${tx.is_plus ? '+' : '-'}${formatRupiah(tx.amount)}</div>
        `;
        dashHistoryList.appendChild(item);
    });

    dashboardModal.classList.add('active');
}

function closeDashboardModal() { dashboardModal.classList.remove('active'); }
