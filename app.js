// [1] Firebase 및 전역 변수 초기화
const firebaseConfig = {
    apiKey: "AIzaSyBqrEr1J2isB6NpoK_ONxOgmyl_cvNAnVs",
    authDomain: "moyeora-75ccf.firebaseapp.com",
    projectId: "moyeora-75ccf",
    storageBucket: "moyeora-75ccf.firebasestorage.app",
    messagingSenderId: "740093064639",
    appId: "1:740093064639:web:bd5326613a98aa2ea9dd0a",
    measurementId: "G-ZCEJ9CPWQV"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let myRoomId = new URLSearchParams(window.location.search).get('room');
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let myInfo = { 
    name: localStorage.getItem('moyeora_name') || "", 
    emoji: localStorage.getItem('moyeora_emoji') || "🐱", 
    color: localStorage.getItem('moyeora_color') || "#FFE0C7" 
};
let mySelection = { dates: [], times: [], menu: "", place: "", address: "" };

// [2] 페이지 이동 함수
function goToPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + id);
    if(target) target.classList.add('active');
    
    if(id === 'datetime') renderCalendar();
    if(id === 'profile-setup') {
        document.getElementById('user-name').value = myInfo.name;
        updateProfilePreview();
    }
}

// [3] 프로필 관련
function randomizeProfile() {
    const emojis = ["🐱", "🐶", "🐰", "🦊", "🐻", "🐼", "🐹", "🦁", "🐧", "🐷", "🐨"];
    const colors = ["#FFE0C7", "#D6F3E7", "#E2DBFB", "#FFF3C4", "#FADBD8", "#D6EAF8"];
    myInfo.emoji = emojis[Math.floor(Math.random() * emojis.length)];
    myInfo.color = colors[Math.floor(Math.random() * colors.length)];
    updateProfilePreview();
}

function updateProfilePreview() {
    const preview = document.getElementById('profile-preview');
    if(preview) {
        preview.innerText = myInfo.emoji;
        preview.style.backgroundColor = myInfo.color;
    }
    localStorage.setItem('moyeora_emoji', myInfo.emoji);
    localStorage.setItem('moyeora_color', myInfo.color);
}

// [4] 입장 처리
async function handleEntry() {
    const nameInput = document.getElementById('user-name').value.trim();
    if(!nameInput) return alert("닉네임을 입력해주세요!");
    myInfo.name = nameInput;
    localStorage.setItem('moyeora_name', nameInput);

    if (!myRoomId) {
        myRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        await db.collection("rooms").doc(myRoomId).set({ 
            status: 'voting', 
            participants: [{...myInfo, votes: {dates: [], times: []}}],
            adminName: myInfo.name,
            confirmedSlot: null
        });
        window.location.href = window.location.origin + window.location.pathname + "?room=" + myRoomId;
    } else {
        const doc = await db.collection("rooms").doc(myRoomId).get();
        if(!doc.exists) return alert("방이 존재하지 않습니다.");
        const data = doc.data();
        const exists = data.participants.find(p => p.name === myInfo.name);
        if(!exists) {
            await db.collection("rooms").doc(myRoomId).update({ 
                participants: firebase.firestore.FieldValue.arrayUnion({...myInfo, votes: {dates: [], times: []}}) 
            });
        }
        startMonitoring();
        goToPage('datetime');
    }
}

// [5] 실시간 감시
function startMonitoring() {
    db.collection("rooms").doc(myRoomId).onSnapshot((doc) => {
        const data = doc.data();
        if(!data) return;

        document.getElementById('member-list').innerHTML = data.participants.map(p => `
            <div class="flex flex-col items-center">
                <div class="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm mb-1" style="background:${p.color}">${p.emoji}</div>
                <span class="text-[9px] font-bold text-gray-500">${p.name}</span>
            </div>
        `).join('');

        if (data.adminName === myInfo.name) {
            document.getElementById('admin-panel').classList.remove('hidden');
            document.getElementById('guest-panel').classList.add('hidden');
            calculateVoteRanking(data.participants);
        }

        if (data.status === 'place_voting' && data.confirmedSlot) {
            document.getElementById('display-final-time').innerText = data.confirmedSlot;
            goToPage('menu');
        }

        if (data.status === 'finished') {
            document.getElementById('ticket-info').innerHTML = `
                <div class="text-xl mb-6">${data.confirmedSlot}</div>
                <div class="text-2xl text-orange-400 mb-2 font-bold">${data.finalPlace}</div>
                <div class="text-[11px] text-gray-400 leading-tight">${data.finalAddr}</div>
            `;
            goToPage('ticket');
        }
    });
}

// [6] 투표 순위 및 시간 확정
function calculateVoteRanking(participants) {
    let counts = {};
    participants.forEach(p => {
        if(p.votes && p.votes.dates) {
            p.votes.dates.forEach(d => {
                p.votes.times.forEach(t => {
                    const key = `${d} | ${t}`;
                    counts[key] = (counts[key] || 0) + 1;
                });
            });
        }
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const rankingDiv = document.getElementById('admin-ranking-list');
    rankingDiv.innerHTML = sorted.map(([slot, count]) => `
        <div class="slot-card" onclick="confirmSlot('${slot}')">
            <span class="font-bold text-gray-600">${slot}</span>
            <span class="bg-orange-100 text-orange-500 font-black px-2 py-1 rounded-lg text-[10px]">${count}명 🔥</span>
        </div>
    `).join('') || "<p class='text-center text-gray-300 py-6 text-xs'>투표를 기다리고 있어요!</p>";
}

async function confirmSlot(slotStr) {
    if(!confirm(`'${slotStr}' 로 시간을 확정할까요?`)) return;
    await db.collection("rooms").doc(myRoomId).update({ status: 'place_voting', confirmedSlot: slotStr });
}

// [7] 캘린더 관련
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    document.getElementById('calendar-month').innerText = `${viewYear}년 ${viewMonth + 1}월`;
    grid.innerHTML = "";
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div></div>`;
    for(let d=1; d<=lastDate; d++) {
        const dateStr = `${viewYear}-${viewMonth+1}-${d}`;
        const cell = document.createElement('div');
        cell.className = "date-cell" + (mySelection.dates.includes(dateStr) ? " date-active" : "");
        cell.innerText = d;
        cell.onclick = () => {
            if(mySelection.dates.includes(dateStr)) mySelection.dates = mySelection.dates.filter(v => v !== dateStr);
            else mySelection.dates.push(dateStr);
            renderCalendar();
        };
        grid.appendChild(cell);
    }
}
function changeMonth(s) { viewMonth += s; if(viewMonth<0){viewMonth=11;viewYear--;} if(viewMonth>11){viewMonth=0;viewYear++;} renderCalendar(); }

// [8] 시간 선택 칩
function selectTimeCategory(cat) {
    document.querySelectorAll('#page-datetime .selectable').forEach(b => b.classList.remove('selected'));
    const btnId = cat === '점심' ? 'btn-lunch' : (cat === '오후' ? 'btn-after' : 'btn-dinner');
    document.getElementById(btnId).classList.add('selected');
    
    const area = document.getElementById('detail-time-area'); area.innerHTML = "";
    const hS = cat === '점심' ? 11 : (cat === '오후' ? 14 : 18);
    const hE = cat === '점심' ? 14 : (cat === '오후' ? 17 : 22);
    for(let h = hS; h <= hE; h++) {
        ['00', '30'].forEach(m => {
            const timeStr = `${h}:${m}`;
            const chip = document.createElement('div');
            chip.className = "time-chip" + (mySelection.times.includes(timeStr) ? " time-active" : "");
            chip.innerText = timeStr;
            chip.onclick = () => {
                if(mySelection.times.includes(timeStr)) mySelection.times = mySelection.times.filter(v => v !== timeStr);
                else mySelection.times.push(timeStr);
                selectTimeCategory(cat);
                updateSummary();
            };
            area.appendChild(chip);
        });
    }
}

function updateSummary() {
    const summary = document.getElementById('selected-summary');
    summary.innerHTML = "";
    mySelection.times.sort().forEach(t => {
        const chip = document.createElement('div');
        chip.className = "summary-chip";
        chip.innerHTML = `${t} <span class="cursor-pointer opacity-70 ml-1" onclick="removeTime('${t}')">✕</span>`;
        summary.appendChild(chip);
    });
}
window.removeTime = (t) => {
    mySelection.times = mySelection.times.filter(v => v !== t);
    updateSummary();
    const activeBtn = document.querySelector('#page-datetime .selectable.selected');
    if(activeBtn) {
        const cat = activeBtn.id === 'btn-lunch' ? '점심' : (activeBtn.id === 'btn-after' ? '오후' : '저녁');
        selectTimeCategory(cat);
    }
}

async function submitVotes() {
    if(!mySelection.dates.length || !mySelection.times.length) return alert("날짜와 시간을 선택하세요!");
    const doc = await db.collection("rooms").doc(myRoomId).get();
    let parts = doc.data().participants;
    parts = parts.map(p => (p.name === myInfo.name) ? { ...p, votes: { dates: mySelection.dates, times: mySelection.times } } : p);
    await db.collection("rooms").doc(myRoomId).update({ participants: parts });
    goToPage('waiting');
}

// [9] 장소 검색 로직
function selectMenu(el, m) { document.querySelectorAll('#menu-list .selectable').forEach(s => s.classList.remove('selected')); el.classList.add('selected'); mySelection.menu = m; }

let ps = new kakao.maps.services.Places();
function searchPlaces() {
    const loc = document.getElementById('search-location').value.trim();
    if(!mySelection.menu || !loc) return alert("메뉴와 지역을 모두 입력하세요!");
    goToPage('vote');
    setTimeout(() => {
        ps.keywordSearch(`${loc} ${mySelection.menu}`, (data, status) => {
            if (status === kakao.maps.services.Status.OK) displayPlaces(data);
            else alert("결과가 없어요!");
        });
    }, 400);
}

function displayPlaces(places) {
    const listEl = document.getElementById('place-list'); listEl.innerHTML = "";
    const mapContainer = document.getElementById('map');
    const map = new kakao.maps.Map(mapContainer, { center: new kakao.maps.LatLng(places[0].y, places[0].x), level: 3 });
    const marker = new kakao.maps.Marker({ position: map.getCenter() }); marker.setMap(map);
    setTimeout(() => map.relayout(), 100);

    places.forEach((p) => {
        let emoji = p.category_name.includes("카페") ? "☕" : p.category_name.includes("한식") ? "🍚" : p.category_name.includes("일식") ? "🍣" : "🍝";
        const card = document.createElement('div');
        card.className = "place-card";
        card.innerHTML = `<div class="place-thumb">${emoji}</div><div class="flex-1"><div class="font-bold text-[13px] mb-1">${p.place_name}</div><div class="text-[10px] text-gray-400 leading-tight mb-1">${p.address_name}</div><a href="https://place.map.kakao.com/${p.id}" target="_blank" class="text-[9px] text-blue-500 font-bold border-b border-blue-100">운영시간 🔗</a></div>`;
        card.onclick = () => {
            document.querySelectorAll('.place-card').forEach(c => c.classList.remove('selected')); card.classList.add('selected');
            mySelection.place = p.place_name; mySelection.address = p.address_name;
            const pos = new kakao.maps.LatLng(p.y, p.x); map.panTo(pos); marker.setPosition(pos);
        };
        listEl.appendChild(card);
    });
}

async function finishVote() {
    if(!mySelection.place) return alert("장소를 골라주세요!");
    await db.collection("rooms").doc(myRoomId).update({ status: 'finished', finalPlace: mySelection.place, finalAddr: mySelection.address });
}

function copyLink() { navigator.clipboard.writeText(window.location.href); alert("링크 복사 완료!"); }

// 초기화 실행
window.onload = () => {
    if (myRoomId) {
        goToPage('profile-setup');
    } else {
        randomizeProfile();
        goToPage('home');
    }
};