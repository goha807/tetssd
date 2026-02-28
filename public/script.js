const days = ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота", "Неділя"];
const icons = ["⚡", "🔥", "💎", "🌟", "🍀", "🎉", "🎐"];

// --- STATE ---
let schedule = JSON.parse(localStorage.getItem('gh-schedule')) || {};
let userSettings = JSON.parse(localStorage.getItem('gh-settings')) || { accent: '#38bdf8', volume: 0.5 };
let musicData = JSON.parse(localStorage.getItem('gh-music')) || {
    tracks: [
        { title: "Lofi Study", src: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
        { title: "Deep Focus", src: "https://cdn.pixabay.com/download/audio/2022/02/07/audio_172c9a962a.mp3" }
    ],
    currentIndex: 0
};
let currentWeekIndex = 0;
let currentEditKey = null;
let isPlaying = false;
let socket = null;

// --- AUDIO ---
const audioPlayer = new Audio();
audioPlayer.volume = userSettings.volume;

function initAudio() {
    if(musicData.tracks.length > 0) {
        audioPlayer.src = musicData.tracks[musicData.currentIndex].src;
        updateIslandUI();
    }
    audioPlayer.onended = () => changeTrack(1);
}

function togglePlay(e) {
    if(e) e.stopPropagation();
    if(musicData.tracks.length === 0) return;
    if (isPlaying) { audioPlayer.pause(); } 
    else { audioPlayer.play().catch(e => console.log("Interaction needed")); }
    isPlaying = !isPlaying;
    updateIslandUI();
}

function changeTrack(dir) {
    musicData.currentIndex = (musicData.currentIndex + dir + musicData.tracks.length) % musicData.tracks.length;
    audioPlayer.src = musicData.tracks[musicData.currentIndex].src;
    if(isPlaying) audioPlayer.play();
    updateIslandUI();
    localStorage.setItem('gh-music', JSON.stringify(musicData));
}

function setVolume(val) {
    audioPlayer.volume = val;
    userSettings.volume = val;
    localStorage.setItem('gh-settings', JSON.stringify(userSettings));
}

function updateIslandUI() {
    const track = musicData.tracks[musicData.currentIndex];
    document.getElementById('islandTrack').textContent = track ? track.title : "Тиша";
    document.getElementById('expTrackName').textContent = track ? track.title : "Тиша";
    document.getElementById('islandStatus').textContent = isPlaying ? "Відтворюється" : "Пауза";
    document.getElementById('isoPlayBtn').textContent = isPlaying ? "⏸" : "▶";
    document.getElementById('expPlayBtn').textContent = isPlaying ? "⏸" : "▶";
    document.getElementById('expVolSlider').value = audioPlayer.volume;
}

function toggleIslandExpand() {
    document.getElementById('dynamicIsland').classList.toggle('expanded');
}

// --- SOCKET & CHAT ---
function initChat() {
    socket = io();
    socket.on('chat_message', (msg) => {
        appendMessage(msg);
        document.getElementById('chatBadge').style.display = 'block';
    });
    socket.on('chat_history', (history) => {
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        history.forEach(appendMessage);
    });
}

function sendChat() {
    const user = document.getElementById('chatUser').value || 'Гість';
    const text = document.getElementById('chatInput').value;
    if(text) {
        socket.emit('chat_message', { user, text });
        document.getElementById('chatInput').value = '';
    }
}

function appendMessage(msg) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'message';
    div.innerHTML = `<strong>${msg.user}</strong> ${msg.text} <span class="time">${msg.time}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function openChat() {
    document.getElementById('chatModal').style.display = 'flex';
    setTimeout(() => document.getElementById('chatModal').classList.add('open'), 10);
    document.getElementById('chatBadge').style.display = 'none';
}

// --- SCHEDULE LOGIC ---
function init() {
    applySettings();
    initAudio();
    initChat();
    checkURLForSchedule();
    render();
    setInterval(heartbeat, 1000);
    heartbeat();
}

function checkURLForSchedule() {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('schedule');
    if(data) {
        try {
            const decoded = JSON.parse(atob(data));
            schedule = decoded;
            localStorage.setItem('gh-schedule', JSON.stringify(schedule));
            alert("Розклад завантажено з посилання!");
        } catch(e) { console.error("Invalid share data"); }
    }
}

function shareSchedule() {
    const dataStr = btoa(JSON.stringify(schedule));
    const url = `${window.location.origin}${window.location.pathname}?schedule=${dataStr}`;
    navigator.clipboard.writeText(url).then(() => alert("Посилання скопійовано!"));
}

function heartbeat() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const currentDay = (now.getDay() + 6) % 7;
    let foundLesson = null;
    for(let sIdx = 0; sIdx < 8; sIdx++) {
        const key = `${currentWeekIndex}-${currentDay}-${sIdx}`;
        const lesson = schedule[key];
        if(lesson && lesson.start && lesson.end) {
            const s = timeToMin(lesson.start);
            const e = timeToMin(lesson.end);
            if (currentTime >= s && currentTime < e) {
                foundLesson = lesson;
                foundLesson.startMin = s;
                foundLesson.endMin = e;
                break;
            }
        }
    }
    if (foundLesson) {
        document.getElementById('islandStatus').textContent = `Урок: ${foundLesson.name}`;
    } else {
        document.getElementById('islandStatus').textContent = isPlaying ? "Музика грає" : "Вільний час";
    }
}

function render() {
    document.getElementById('currentWeekLabel').textContent = currentWeekIndex === 0 ? "Тиждень А" : "Тиждень Б";
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    const now = new Date();
    const currentDay = (now.getDay() + 6) % 7;
    const isEditMode = document.body.getAttribute('data-edit-mode') === 'true';

    days.forEach((day, dIdx) => {
        const isToday = dIdx === currentDay;
        const dayCol = document.createElement('div');
        dayCol.className = `day-column ${isToday ? 'is-today' : ''}`;
        dayCol.innerHTML = `<div class="day-title"><span>${icons[dIdx]}</span> ${day}</div>`;
        for(let sIdx = 0; sIdx < 8; sIdx++) {
            const key = `${currentWeekIndex}-${dIdx}-${sIdx}`;
            dayCol.appendChild(createLessonCard(schedule[key], key, isToday, sIdx, isEditMode));
        }
        grid.appendChild(dayCol);
    });
}

function createLessonCard(data, key, isToday, index, isEditMode) {
    const card = document.createElement('div');
    card.className = 'lesson-card glass';
    if(data) card.classList.add('has-data');
    const editBtnHTML = `<button class="edit-btn" onclick="event.stopPropagation(); openEditModal('${key}')">${data ? '⚙️' : '➕'}</button>`;
    
    if (!data) {
        card.innerHTML = `<div style="opacity:0.2; text-align:center;">пусто</div>${editBtnHTML}`;
        card.onclick = () => { if(isEditMode) openEditModal(key) };
        return card;
    }

    card.innerHTML = `
    ${editBtnHTML}
    <div class="time-badge">${data.start} — ${data.end}</div>
    <span class="lesson-name">${data.name}</span>
    ${data.link ? `<a href="${data.link}" target="_blank" class="lesson-link">🔗 Приєднатися</a>` : ''}
    `;
    card.onclick = () => { if(isEditMode) openEditModal(key) };
    return card;
}

function timeToMin(t) { if(!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }

function openEditModal(key) {
    currentEditKey = key;
    const data = schedule[key];
    document.getElementById('nameInp').value = data ? data.name : '';
    document.getElementById('startInp').value = data ? data.start : '08:30';
    document.getElementById('endInp').value = data ? data.end : '09:15';
    document.getElementById('linkInp').value = data ? data.link : '';
    const m = document.getElementById('modal'); 
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('open'), 10);
}

function closeModal(id) { 
    const m = document.getElementById(id); 
    m.classList.remove('open'); 
    setTimeout(() => m.style.display = 'none', 300); 
}

function saveLesson() {
    schedule[currentEditKey] = {
        name: document.getElementById('nameInp').value,
        start: document.getElementById('startInp').value,
        end: document.getElementById('endInp').value,
        link: document.getElementById('linkInp').value
    };
    localStorage.setItem('gh-schedule', JSON.stringify(schedule));
    render(); closeModal('modal');
}

function deleteLesson() {
    delete schedule[currentEditKey];
    localStorage.setItem('gh-schedule', JSON.stringify(schedule));
    render(); closeModal('modal');
}

function toggleEditMode() {
    const isEditing = document.body.getAttribute('data-edit-mode') === 'false';
    document.body.setAttribute('data-edit-mode', isEditing);
    document.getElementById('toggleEdit').classList.toggle('active', isEditing);
    render();
}

function openSettings() { 
    document.getElementById('settingsModal').style.display = 'flex'; 
    setTimeout(() => document.getElementById('settingsModal').classList.add('open'), 10); 
}

function setAccent(c) { 
    userSettings.accent = c; 
    localStorage.setItem('gh-settings', JSON.stringify(userSettings)); 
    applySettings(); 
}

function applySettings() {
    document.documentElement.style.setProperty('--accent', userSettings.accent);
}

function changeWeek(dir) {
    currentWeekIndex = (currentWeekIndex + dir + 2) % 2;
    render();
}

function toggleNotifications() {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then(permission => {
        const btn = document.getElementById('notifyBtn');
        if (permission === "granted") {
            btn.classList.add('active');
            btn.innerHTML = "🔔 Увімкнено";
        }
    });
}

init();