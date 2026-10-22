// Konfigurasi Koneksi Supabase
const SUPABASE_URL = 'https://pmtjequlrdxpjaeeswhd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtdGplcXVscmR4cGphZWVzd2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MzE1MTYsImV4cCI6MjEwODEwNzUxNn0.Xm9hlw-iWtvho3uHavQ4A3I53hivewoYHaPJB6oYEws';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Aplikasi
let state = {
    balance: 0,
    userName: 'Galang',
    userVa: '•••• 8829',
    userPin: '123456',
    avatarUrl: '',
    transactions: [],
    pendingTransaction: null
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

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await fetchAppDataFromSupabase();
    setupPinInputs();

    // Otomatis Kompres Foto saat dipilih dari Penyimpanan Internal
    const fileInput = document.getElementById('inputFileUpload');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                compressAndResizeImage(file, 300, 300, 0.7, function(compressedBase64) {
                    document.getElementById('modalAvatarPreviewBox').innerHTML = `<img src="${compressedBase64}" alt="Preview">`;
                    state.tempNewAvatar = compressedBase64;
                });
            }
        });
    }

    appendBotMessage(`Halo <b>${state.userName}</b>! 👋 Saya <b>DompetAI Assistant</b> yang terhubung langsung ke database <b>Supabase Cloud</b>.<br>Ada yang bisa saya bantu hari ini?`);

    // Theme Switcher
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', nextTheme);
        themeToggle.querySelector('i').className = nextTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    });
});

// Helper Formatter Tanggal Cantik (Contoh: "22 Okt 2026, 10:15")
function formatFormattedDate(dateObj = new Date()) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const mins = dateObj.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${mins}`;
}

// Convert Date ke format string untuk input datetime-local
function toDatetimeLocalString(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const mins = dateObj.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
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
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            callback(compressedBase64);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// 1. Ambil Data dari Supabase
async function fetchAppDataFromSupabase() {
    try {
        let { data: profile, error: profError } = await supabaseClient
            .from('wallet_profile')
            .select('*')
            .eq('id', 1)
            .single();

        if (profile) {
            state.balance = parseFloat(profile.balance);
            state.userName = profile.user_name || 'Galang';
            state.userPin = profile.user_pin || '123456';
            state.userVa = profile.virtual_account || '•••• 8829';
            state.avatarUrl = profile.avatar_url || '';
            state.tempNewAvatar = state.avatarUrl;
            
            updateProfileUI();
        }

        let { data: txs, error: txError } = await supabaseClient
            .from('transactions')
            .select('*')
            .order('id', { ascending: true });

        if (txs) {
            state.transactions = txs;
        }

        updateUI();
    } catch (err) {
        console.error("Gagal memuat data dari Supabase:", err);
    }
}

// Update UI Tampilan Profil & Foto
function updateProfileUI() {
    document.getElementById('userName').textContent = state.userName;
    document.getElementById('sidebarUserName').textContent = state.userName;
    document.getElementById('cardVirtualNum').textContent = state.userVa;

    document.getElementById('inputProfileName').value = state.userName;
    document.getElementById('inputProfileVA').value = state.userVa;
    document.getElementById('inputProfilePin').value = state.userPin;

    const topAvatarBox = document.getElementById('topProfileAvatarBox');
    if (state.avatarUrl) {
        topAvatarBox.innerHTML = `<img src="${state.avatarUrl}" alt="Avatar">`;
    } else {
        topAvatarBox.innerHTML = `<i class="fa-solid fa-user"></i>`;
    }

    const modalAvatarBox = document.getElementById('modalAvatarPreviewBox');
    if (state.avatarUrl) {
        modalAvatarBox.innerHTML = `<img src="${state.avatarUrl}" alt="Avatar Large">`;
    } else {
        modalAvatarBox.innerHTML = `<i class="fa-solid fa-user"></i>`;
    }
}

// Simpan Custom Profil & Foto ke Supabase
async function saveProfileData(e) {
    e.preventDefault();

    const newName = document.getElementById('inputProfileName').value.trim();
    const newVA = document.getElementById('inputProfileVA').value.trim();
    const newPin = document.getElementById('inputProfilePin').value.trim();
    const finalAvatar = state.tempNewAvatar || state.avatarUrl;

    if (!newName || !newVA || !newPin) {
        alert("Harap isi nama, virtual account, dan PIN!");
        return;
    }

    try {
        let { error } = await supabaseClient
            .from('wallet_profile')
            .update({
                user_name: newName,
                virtual_account: newVA,
                user_pin: newPin,
                avatar_url: finalAvatar
            })
            .eq('id', 1);

        if (error) {
            alert("Gagal menyimpan profil ke Supabase: " + error.message);
            return;
        }

        state.userName = newName;
        state.userVa = newVA;
        state.userPin = newPin;
        state.avatarUrl = finalAvatar;

        updateProfileUI();
        closeProfileModal();

        appendBotMessage(`👤 <b>Profil & Foto Berhasil Diperbarui!</b><br>Nama Pemilik: <b>${newName}</b><br>Virtual Account: <b>${newVA}</b>`);
    } catch (err) {
        console.error("Error saving profile:", err);
    }
}

// Modal Profil Engine
function openProfileModal() {
    state.tempNewAvatar = state.avatarUrl;
    const fileInp = document.getElementById('inputFileUpload');
    if (fileInp) fileInp.value = '';
    updateProfileUI();
    profileModal.classList.add('active');
}

function closeProfileModal() {
    profileModal.classList.remove('active');
}

// 2. Fungsi Hapus Semua Data
async function clearAllData() {
    if (!confirm("⚠️ Apakah Anda yakin ingin MENGHAPUS SELURUH DATA transaksi dan mereset saldo ke 0 di Supabase?")) return;

    try {
        let { error: errTx } = await supabaseClient
            .from('transactions')
            .delete()
            .neq('id', 0);

        let { error: errProf } = await supabaseClient
            .from('wallet_profile')
            .update({ balance: 0 })
            .eq('id', 1);

        if (errTx || errProf) {
            alert("Gagal menghapus data di Supabase.");
            return;
        }

        state.balance = 0;
        state.transactions = [];
        updateUI();
        closeDashboardModal();

        appendBotMessage(`🗑️ <b>Semua data berhasil dihapus!</b> Saldo Anda saat ini Rp 0.`);
    } catch (err) {
        console.error("Error deleting data:", err);
    }
}

// Format Currency
function formatRupiah(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
}

// Update UI Sidebar Status (Menampilkan Tanggal Transaksi)
function updateUI() {
    balanceDisplay.textContent = formatRupiah(state.balance);
    txCount.textContent = state.transactions.length;

    historyList.innerHTML = '';
    state.transactions.slice().reverse().forEach(tx => {
        const item = document.createElement('div');
        item.className = 'tx-item';
        
        let iconClass = 'fa-arrow-down-left';
        let bgClass = 'rgba(16, 185, 129, 0.15)';
        let colorClass = '#10b981';

        if (!tx.is_plus) {
            iconClass = 'fa-arrow-up-right';
            bgClass = 'rgba(239, 68, 68, 0.15)';
            colorClass = '#ef4444';
        }

        item.innerHTML = `
            <div class="tx-info">
                <div class="tx-icon" style="background: ${bgClass}; color: ${colorClass}">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div>
                    <strong style="display:block; font-size: 0.8rem;">${tx.title}</strong>
                    <small style="color: var(--text-muted); font-size: 0.68rem;"><i class="fa-regular fa-clock"></i> ${tx.date}</small>
                </div>
            </div>
            <div class="tx-amount ${tx.is_plus ? 'plus' : 'minus'}">
                ${tx.is_plus ? '+' : '-'}${formatRupiah(tx.amount)}
            </div>
        `;
        historyList.appendChild(item);
    });
}

// Handle User Input Submission
function handleFormSubmit(e) {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    userInput.value = '';

    const typingElem = showTypingIndicator();

    setTimeout(() => {
        typingElem.remove();
        processBotResponse(text);
    }, 600);
}

// Helper Quick Triggers
function quickFillInput(text) {
    userInput.value = text;
    userInput.focus();
}

function quickSendMessage(text) {
    userInput.value = text;
    handleFormSubmit(new Event('submit'));
}

// Render Messages
function appendUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message user';
    
    let avatarHtml = state.avatarUrl 
        ? `<img src="${state.avatarUrl}" alt="User">` 
        : `<i class="fa-solid fa-user"></i>`;

    msgDiv.innerHTML = `
        <div class="msg-avatar">${avatarHtml}</div>
        <div class="msg-bubble">
            ${escapeHtml(text)}
            <span class="msg-time">${getCurrentTime()}</span>
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

function appendBotMessage(htmlContent) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot';
    msgDiv.innerHTML = `
        <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="msg-bubble">
            ${htmlContent}
            <span class="msg-time">${getCurrentTime()}</span>
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.innerHTML = `
        <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="msg-bubble typing">
            <span></span><span></span><span></span>
        </div>
    `;
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Extract Angka & Singkatan Nominal
function parseNominal(text) {
    let matchK = text.match(/(\d+[\d\.]*)\s*(k|rb|ribu)/i);
    if (matchK) {
        return parseFloat(matchK[1].replace(',', '.')) * 1000;
    }
    let matchJt = text.match(/(\d+[\d\.]*)\s*(jt|juta)/i);
    if (matchJt) {
        return parseFloat(matchJt[1].replace(',', '.')) * 1000000;
    }
    let matchNum = text.match(/(\d+[\d\.]*)/);
    if (matchNum) {
        let clean = matchNum[0].replace(/\./g, '');
        return parseInt(clean, 10);
    }
    return null;
}

// Flexible Intent Engine
function processBotResponse(input) {
    const lower = input.toLowerCase();
    const amount = parseNominal(lower);

    // 1. Dashboard & Profil
    if (/profil|profile|akun|edit/i.test(lower)) {
        openProfileModal();
        appendBotMessage(`👤 Membuka <b>Halaman Custom Profil Pemilik E-Wallet</b> Anda.`);
        return;
    }

    if (/riwayat|histori|catatan|laporan|dashboard|transaksi/.test(lower) && !amount) {
        openDashboard();
        appendBotMessage(`📊 Membuka <b>Dashboard & Catatan Keuangan Supabase</b>.`);
        return;
    }

    // 2. Cek Saldo
    if (/saldo|uang|sisa|cek|kantong|dompet/.test(lower) && !amount) {
        appendBotMessage(`Total saldo aktif Anda saat ini adalah <b>${formatRupiah(state.balance)}</b>.`);
        return;
    }

    // 3. Pemasukan / Top Up
    if (/top\s*up|isi|tambah|dapet|dapat|terima|dikasih|gajian|masuk|setor/.test(lower)) {
        if (!amount) {
            appendBotMessage(`Sebutkan nominal pemasukannya ya. Contoh: <i>"Gajian 500k"</i>`);
            return;
        }

        state.pendingTransaction = {
            type: 'topup',
            title: capitalizeFirstLetter(input),
            amount: amount,
            is_plus: true
        };

        modalTxDetail.textContent = `Pemasukan: ${capitalizeFirstLetter(input)} (${formatRupiah(amount)})`;
        openPinModal();
        return;
    }

    // 4. Pengeluaran / Utang / Beli
    if (/ngutang|ngutangi|piutang|pinjam|pinjem|transfer|kirim|bayar|beli|jajan|makan|minum|kopi|soto|bakso|pulsa|listrik|kasih/.test(lower) || amount) {
        if (!amount) {
            appendBotMessage(`Berapa nominalnya? Contoh: <i>"Ngutangi Dava 5000"</i>`);
            return;
        }

        if (amount > state.balance) {
            appendBotMessage(`❌ Saldo Anda tidak cukup! (Saldo: ${formatRupiah(state.balance)}, Dibutuhkan: ${formatRupiah(amount)})`);
            return;
        }

        state.pendingTransaction = {
            type: 'payment',
            title: capitalizeFirstLetter(input),
            amount: amount,
            is_plus: false
        };

        modalTxDetail.textContent = `Konfirmasi: ${capitalizeFirstLetter(input)} (${formatRupiah(amount)})`;
        openPinModal();
        return;
    }

    // 5. Fallback Response
    appendBotMessage(`
        Saya kurang paham perintah itu.<br><br>
        <b>Coba ketik bahasa santai seperti:</b><br>
        • <i>"Ngutangi Dava 5000"</i><br>
        • <i>"Beli bakso 15k"</i><br>
        • <i>"Cek saldo"</i><br>
        • <i>"Edit profil"</i>
    `);
}

// PIN Modal Engine
function setupPinInputs() {
    const inputs = document.querySelectorAll('.pin-digit');
    inputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            if (input.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });
}

function openPinModal() {
    pinModal.classList.add('active');
    
    // Set default input tanggal dengan waktu saat ini
    if (txCustomDate) {
        txCustomDate.value = toDatetimeLocalString(new Date());
    }

    const inputs = document.querySelectorAll('.pin-digit');
    inputs.forEach(i => i.value = '');
    setTimeout(() => inputs[0].focus(), 100);
}

function closePinModal(cancelled = true) {
    pinModal.classList.remove('active');
    if (cancelled && state.pendingTransaction) {
        appendBotMessage(`❌ Transaksi <b>${state.pendingTransaction.title}</b> dibatalkan.`);
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

// Eksekusi & Simpan Transaksi Lengkap dengan Tanggal
async function executePendingTransaction() {
    const tx = state.pendingTransaction;
    if (!tx) return;

    let newBalance = tx.is_plus ? state.balance + tx.amount : state.balance - tx.amount;
    
    // Ambil tanggal dari input modal PIN, jika kosong gunakan tanggal saat ini
    let finalDateStr = formatFormattedDate();
    if (txCustomDate && txCustomDate.value) {
        const selectedDate = new Date(txCustomDate.value);
        finalDateStr = formatFormattedDate(selectedDate);
    }

    try {
        let { data, error: errTx } = await supabaseClient
            .from('transactions')
            .insert([{
                type: tx.type,
                title: tx.title,
                amount: tx.amount,
                date: finalDateStr,
                is_plus: tx.is_plus
            }])
            .select();

        let { error: errProf } = await supabaseClient
            .from('wallet_profile')
            .update({ balance: newBalance })
            .eq('id', 1);

        if (errTx || errProf) {
            alert("Gagal menyimpan transaksi ke Supabase!");
            return;
        }

        state.balance = newBalance;
        if (data && data.length > 0) {
            state.transactions.push(data[0]);
        }

        updateUI();

        appendBotMessage(`
            ✅ <b>Berhasil Dicatat & Disimpan ke Cloud!</b>
            <div class="bot-card-res">
                • Transaksi: <b>${tx.title}</b><br>
                • Nominal: <b>${formatRupiah(tx.amount)}</b><br>
                • Tanggal: <b>${finalDateStr}</b><br>
                • Sisa Saldo: <b>${formatRupiah(state.balance)}</b>
            </div>
        `);
    } catch (err) {
        console.error("Error executing transaction:", err);
    }

    state.pendingTransaction = null;
}

// Dashboard Modal Engine
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
        
        let iconClass = 'fa-arrow-down-left';
        let bgClass = 'rgba(16, 185, 129, 0.15)';
        let colorClass = '#10b981';

        if (!tx.is_plus) {
            iconClass = 'fa-arrow-up-right';
            bgClass = 'rgba(239, 68, 68, 0.15)';
            colorClass = '#ef4444';
        }

        item.innerHTML = `
            <div class="tx-info">
                <div class="tx-icon" style="background: ${bgClass}; color: ${colorClass}">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div>
                    <strong style="display:block; font-size: 0.8rem;">${tx.title}</strong>
                    <small style="color: var(--text-muted); font-size: 0.68rem;"><i class="fa-regular fa-clock"></i> ${tx.date}</small>
                </div>
            </div>
            <div class="tx-amount ${tx.is_plus ? 'plus' : 'minus'}">
                ${tx.is_plus ? '+' : '-'}${formatRupiah(tx.amount)}
            </div>
        `;
        dashHistoryList.appendChild(item);
    });

    dashboardModal.classList.add('active');
}

function closeDashboardModal() {
    dashboardModal.classList.remove('active');
}
