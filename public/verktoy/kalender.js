/*
  Logikken for kalender-verktøyet. Markup ligger i src/pages/fotoverktoy/kalender.astro,
  utseendet i src/styles/verktoy.css.

  Fila lastes med en vanlig <script>-tagg og kjører derfor i globalt navnerom —
  det er med vilje: knappene i markupen kaller funksjonene her direkte via
  onclick, slik verktøyet alltid har gjort.
*/

/*
  HEIC-konvertereren er 1,3 MB — mer enn alt annet på sida til sammen. Den ble
  tidligere lastet ved hvert eneste besøk, selv om de aller fleste bildene som
  slippes inn her er JPG. Nå hentes den først når noen faktisk drar inn en
  HEIC-fil, og bare den ene gangen.
*/
let heicKonverterer = null;

function lastHeicKonverterer() {
  if (heicKonverterer) return heicKonverterer;

  heicKonverterer = new Promise(function (resolve, reject) {
    var tagg = document.createElement('script');
    tagg.src = '/verktoy/heic2any.min.js';
    tagg.onload = function () { resolve(window.heic2any); };
    tagg.onerror = function () {
      // Neste HEIC-fil skal få prøve på nytt framfor å arve en feilet lasting.
      heicKonverterer = null;
      reject(new Error('Fikk ikke lastet HEIC-konvertereren'));
    };
    document.head.appendChild(tagg);
  });

  return heicKonverterer;
}

    // --- DATA MODEL ---
    const MONTH_NAMES = ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"];
    const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    const HOLIDAYS_2026 = {
        "0-1": "1. nyttårsdag",
        "2-29": "Palmesøndag",
        "3-2": "Skjærtorsdag",
        "3-3": "Langfredag",
        "3-5": "1. påskedag",
        "3-6": "2. påskedag",
        "4-1": "Arbeidernes dag",
        "4-14": "Kr. himmelfart",
        "4-17": "Grunnlovsdag",
        "4-24": "1. pinsedag",
        "4-25": "2. pinsedag",
        "11-25": "1. juledag",
        "11-26": "2. juledag"
    };

    let photoLibrary = [];
    let inboxIds = [];
    let monthData = Array(12).fill(null).map(() => ({
        photoIds: [],
        texts: {}
    }));

    let settings = {
        gapMM: 2,
        padMM: 0
    };

    // --- DB SETUP ---
    // KEEPING SAME DB NAME TO PRESERVE DATA
    const dbName = "Cal2026DB_v2";
    let db;

    async function initDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName, 1);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if(!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', {keyPath: 'id'});
                if(!db.objectStoreNames.contains('state')) db.createObjectStore('state', {keyPath: 'id'});
            };
            req.onsuccess = e => { db = e.target.result; resolve(); };
            req.onerror = e => reject(e);
        });
    }

    // --- INITIALIZATION ---
    (async function start() {
        await initDB();
        await loadData();

        document.getElementById('gapInput').value = settings.gapMM;
        document.getElementById('gapVal').textContent = settings.gapMM;
        document.getElementById('padInput').value = settings.padMM;
        document.getElementById('padVal').textContent = settings.padMM;

        renderInbox();
        renderCalendarPages();
    })();

    // --- RENDER LOGIC ---
    function updateSettings() {
        const gap = parseFloat(document.getElementById('gapInput').value);
        const pad = parseFloat(document.getElementById('padInput').value);

        settings.gapMM = gap;
        settings.padMM = pad;

        document.getElementById('gapVal').textContent = gap;
        document.getElementById('padVal').textContent = pad;

        for (let m = 0; m < 12; m++) {
            updateMonthGridLayout(m);
        }
        saveStateDebounced();
    }

    function renderInbox() {
        const container = document.getElementById('inboxScroll');
        container.innerHTML = '';
        document.getElementById('inboxCount').textContent = inboxIds.length + " bilder";

        // Tomteksten skrives herfra, ikke i markupen: denne funksjonen tømmer
        // containeren hver gang den kjører, så alt som står der fra før blir
        // strøket med.
        if (inboxIds.length === 0) {
            const tom = document.createElement('p');
            tom.className = 'inbox-empty';
            tom.textContent = 'Last opp bilder, og dra dem herfra opp på månedsarkene.';
            container.appendChild(tom);
            return;
        }

        inboxIds.forEach(id => {
            const photo = photoLibrary.find(p => p.id === id);
            if (!photo) return;

            const div = document.createElement('div');
            div.className = 'inbox-photo';
            div.draggable = true;
            div.ondragstart = (e) => dragStart(e, id, 'inbox');

            div.innerHTML = `<img src="${photo.src}">`;
            container.appendChild(div);
        });
    }

    function renderCalendarPages() {
        const container = document.getElementById('calendarScroll');
        container.innerHTML = '';

        for (let m = 0; m < 12; m++) {
            container.appendChild(createPageElement(m));
        }
        for (let m = 0; m < 12; m++) {
            updateMonthGridLayout(m);
        }
    }

    function createPageElement(monthIndex) {
        const page = document.createElement('div');
        page.className = 'a4-page';
        page.id = `page-${monthIndex}`;

        const photoArea = document.createElement('div');
        photoArea.className = 'photo-area';
        photoArea.id = `photo-area-${monthIndex}`;
        photoArea.ondragover = handleDragOver;
        photoArea.ondrop = (e) => handleDropToMonth(e, monthIndex);

        const calArea = document.createElement('div');
        calArea.className = 'calendar-area';

        const title = document.createElement('div');
        title.className = 'month-title';
        title.textContent = `${MONTH_NAMES[monthIndex]} 2026`;

        const grid = createCalendarGrid(monthIndex);

        calArea.appendChild(title);
        calArea.appendChild(grid);

        page.appendChild(photoArea);
        page.appendChild(calArea);

        return page;
    }

    function createCalendarGrid(monthIndex) {
        const grid = document.createElement('div');
        grid.className = 'cal-grid';

        const header = document.createElement('div');
        header.className = 'cal-row header';
        ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'cal-cell';
            cell.textContent = day;
            cell.style.textAlign = 'center';
            header.appendChild(cell);
        });
        grid.appendChild(header);

        const firstDayDate = new Date(2026, monthIndex, 1);
        let startDay = firstDayDate.getDay();
        if (startDay === 0) startDay = 7;

        const totalDays = DAYS_IN_MONTH[monthIndex];
        let currentDay = 1;

        for (let r = 0; r < 6; r++) {
            if (currentDay > totalDays) break;
            const row = document.createElement('div');
            row.className = 'cal-row';

            for (let d = 1; d <= 7; d++) {
                const cell = document.createElement('div');
                cell.className = 'cal-cell';

                if (r === 0 && d < startDay) {
                    cell.style.background = '#f9fafb';
                } else if (currentDay <= totalDays) {
                    const holidayName = HOLIDAYS_2026[`${monthIndex}-${currentDay}`];
                    const isSunday = (d === 7);

                    if (d === 6 || d === 7) cell.className += " weekend";
                    if (holidayName || isSunday) cell.className += " red-day";

                    const dateRow = document.createElement('div');
                    dateRow.className = 'cal-date-row';

                    const dateNum = document.createElement('div');
                    dateNum.className = 'cal-date';
                    dateNum.textContent = currentDay;
                    dateRow.appendChild(dateNum);

                    if(holidayName) {
                        const hTag = document.createElement('div');
                        hTag.className = 'holiday-name';
                        hTag.textContent = holidayName;
                        dateRow.appendChild(hTag);
                    }
                    cell.appendChild(dateRow);

                    const input = document.createElement('textarea');
                    input.className = 'cal-input';
                    input.placeholder = "Notat...";
                    input.dataset.month = monthIndex;
                    input.dataset.day = currentDay;
                    if (monthData[monthIndex].texts[currentDay]) {
                        input.value = monthData[monthIndex].texts[currentDay];
                    }
                    input.oninput = (e) => {
                        monthData[monthIndex].texts[e.target.dataset.day] = e.target.value;
                        saveStateDebounced();
                    };

                    cell.appendChild(input);
                    currentDay++;
                } else {
                    cell.style.background = '#f9fafb';
                }
                row.appendChild(cell);
            }
            grid.appendChild(row);
        }
        return grid;
    }

    function updateMonthGridLayout(mIndex) {
        const area = document.getElementById(`photo-area-${mIndex}`);
        area.innerHTML = '';

        const photoIds = monthData[mIndex].photoIds;
        if (photoIds.length === 0) {
            area.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:14px;">Dra bilder hit</div>`;
            return;
        }

        const photos = photoIds.map(id => photoLibrary.find(p => p.id === id)).filter(p => p);

        const pxPerMm = 3.7795;
        const totalW = 794;
        const totalH = 673;
        const padPx = settings.padMM * pxPerMm;
        const gapPx = settings.gapMM * pxPerMm;

        const effectiveW = totalW - (padPx * 2);
        const effectiveH = totalH - (padPx * 2);

        if (effectiveW < 50 || effectiveH < 50) return;

        const layout = calculateOptimalGrid(photos, effectiveW, effectiveH, gapPx);

        layout.cells.forEach(cell => {
            const div = document.createElement('div');
            div.className = 'grid-cell';
            div.style.left = (cell.x + padPx) + 'px';
            div.style.top = (cell.y + padPx) + 'px';
            div.style.width = cell.width + 'px';
            div.style.height = cell.height + 'px';

            div.draggable = true;
            div.ondragstart = (e) => dragStart(e, cell.photo.id, 'month', mIndex);

            div.innerHTML = `
                <img src="${cell.photo.src}">
                <button class="remove-btn" onclick="sendToInbox('${cell.photo.id}', ${mIndex})">×</button>
            `;
            area.appendChild(div);
        });
    }

    function calculateOptimalGrid(photos, width, height, gap) {
        if (photos.length === 0) return { cells: [] };

        let bestLayout = null;
        let bestScore = Infinity;

        for (let rows = 1; rows <= photos.length; rows++) {
            const result = generateRows(photos, rows, width, gap);
            const contentHeight = result.totalHeight;
            const scale = height / contentHeight;
            let score = Math.abs(1 - scale);
            if (scale > 1.5 || scale < 0.5) score += 10;

            if (score < bestScore) {
                bestScore = score;
                bestLayout = { ...result, fitScale: scale };
            }
        }

        const cells = [];
        let yOffset = 0;
        const rows = bestLayout.rows;
        let totalH = bestLayout.totalHeight;

        let scaleFactor = height / totalH;

        rows.forEach(row => {
            let xOffset = 0;
            const rowHeight = row.height * scaleFactor;

            row.photos.forEach(photo => {
                const cellW = (width - (row.photos.length - 1) * gap) * (photo.ratio / row.aspectSum);

                cells.push({
                    x: xOffset,
                    y: yOffset,
                    width: cellW,
                    height: rowHeight - gap,
                    photo: photo
                });
                xOffset += cellW + gap;
            });
            yOffset += rowHeight;
        });

        return { cells };
    }

    function generateRows(photos, numRows, width, gap) {
        const base = Math.floor(photos.length / numRows);
        const extra = photos.length % numRows;

        let pIdx = 0;
        const rows = [];
        let totalHeight = 0;

        for (let r = 0; r < numRows; r++) {
            const count = base + (r < extra ? 1 : 0);
            const rowPhotos = [];
            let aspectSum = 0;
            for (let i = 0; i < count; i++) {
                rowPhotos.push(photos[pIdx]);
                aspectSum += photos[pIdx].ratio;
                pIdx++;
            }
            const wAvailable = width - (count - 1) * gap;
            const h = wAvailable / aspectSum;

            rows.push({ photos: rowPhotos, height: h, aspectSum });
            totalHeight += h;
        }
        return { rows, totalHeight };
    }

    // --- DRAG AND DROP ---
    let dragData = null;

    function dragStart(e, id, source, mIndex) {
        dragData = { id, source, monthIndex: mIndex };
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }

    function handleDropToMonth(e, targetMonthIndex) {
        e.preventDefault();
        if (!dragData) return;

        const { id, source, monthIndex } = dragData;

        if (source === 'inbox') {
            inboxIds = inboxIds.filter(x => x !== id);
            monthData[targetMonthIndex].photoIds.push(id);
        } else if (source === 'month') {
            monthData[monthIndex].photoIds = monthData[monthIndex].photoIds.filter(x => x !== id);
            monthData[targetMonthIndex].photoIds.push(id);
        }

        renderInbox();
        updateMonthGridLayout(targetMonthIndex);
        if (source === 'month' && monthIndex !== targetMonthIndex) updateMonthGridLayout(monthIndex);
        saveState();
        dragData = null;
    }

    function handleDropToInbox(e) {
        e.preventDefault();
        if (!dragData) return;
        const { id, source, monthIndex } = dragData;

        if (source === 'month') {
            monthData[monthIndex].photoIds = monthData[monthIndex].photoIds.filter(x => x !== id);
            inboxIds.push(id);
            renderInbox();
            updateMonthGridLayout(monthIndex);
            saveState();
        }
        dragData = null;
    }

    function sendToInbox(id, mIndex) {
        monthData[mIndex].photoIds = monthData[mIndex].photoIds.filter(x => x !== id);
        inboxIds.push(id);
        renderInbox();
        updateMonthGridLayout(mIndex);
        saveState();
    }

    // --- FILE HANDLING ---
    document.getElementById('fileInput').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const uploadBtn = document.getElementById('uploadBtn');
        const originalBtnText = uploadBtn.innerText;
        uploadBtn.innerText = "Behandler...";
        uploadBtn.disabled = true;

        for (const file of files) {
            let processedBlob = file;
            let fileName = file.name.toLowerCase();

            if (fileName.endsWith('.heic') || file.type === "image/heic" || file.type === "image/heif") {
                try {
                    uploadBtn.innerText = "Konverterer HEIC...";
                    const result = await (await lastHeicKonverterer())({ blob: file, toType: "image/jpeg", quality: 0.8 });
                    processedBlob = Array.isArray(result) ? result[0] : result;
                } catch (err) {
                    console.error("HEIC konvertering feilet for", file.name, err);
                    alert("Kunne ikke konvertere " + file.name + ". Prøv et annet bilde.");
                    continue;
                }
            }

            const id = Date.now() + Math.random().toString();
            const src = URL.createObjectURL(processedBlob);

            const img = new Image();
            img.src = src;
            await new Promise(r => img.onload = r);
            const ratio = img.width / img.height;

            const photo = { id, src, file: processedBlob, ratio };
            photoLibrary.push(photo);
            inboxIds.push(id);

            const tx = db.transaction('photos', 'readwrite');
            tx.objectStore('photos').put({id, file: processedBlob, ratio});
        }

        renderInbox();
        saveState();
        uploadBtn.innerText = originalBtnText;
        uploadBtn.disabled = false;
    });

    // --- BACKUP & RESTORE ---
    async function downloadBackup() {
        if(!db) return;

        // Fetch all data
        const txP = db.transaction('photos', 'readonly');
        const allPhotos = await new Promise(r => { txP.objectStore('photos').getAll().onsuccess = e => r(e.target.result); });

        const txS = db.transaction('state', 'readonly');
        const state = await new Promise(r => { txS.objectStore('state').get('current').onsuccess = e => r(e.target.result); });

        // Convert Blobs to Base64 to save in JSON
        const photosSerialized = await Promise.all(allPhotos.map(async p => {
            return {
                id: p.id,
                ratio: p.ratio,
                base64: await blobToBase64(p.file)
            };
        }));

        const backupData = {
            date: new Date().toISOString(),
            state: state,
            photos: photosSerialized
        };

        const blob = new Blob([JSON.stringify(backupData)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `KalenderBackup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    }

    async function loadBackup(input) {
        const file = input.files[0];
        if(!file) return;

        if(!confirm("Dette vil overskrive alt gjeldende innhold. Fortsette?")) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Clear DB
                const txClear = db.transaction(['photos', 'state'], 'readwrite');
                txClear.objectStore('photos').clear();
                txClear.objectStore('state').clear();
                await new Promise(r => txClear.oncomplete = r);

                // Restore Photos
                const txP = db.transaction('photos', 'readwrite');
                for(const p of data.photos) {
                    const blob = await base64ToBlob(p.base64);
                    txP.objectStore('photos').put({id: p.id, ratio: p.ratio, file: blob});
                }
                await new Promise(r => txP.oncomplete = r);

                // Restore State
                const txS = db.transaction('state', 'readwrite');
                txS.objectStore('state').put(data.state);
                await new Promise(r => txS.oncomplete = r);

                alert("Backup gjenopprettet! Siden lastes på nytt.");
                location.reload();

            } catch(err) {
                console.error(err);
                alert("Feil ved lesing av backup-fil.");
            }
        };
        reader.readAsText(file);
    }

    function blobToBase64(blob) {
        return new Promise((resolve, _) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    async function base64ToBlob(base64) {
        const res = await fetch(base64);
        return await res.blob();
    }

    // --- PERSISTENCE ---
    function saveState() {
        if (!db) return;
        const tx = db.transaction('state', 'readwrite');
        tx.objectStore('state').put({
            id: 'current',
            inboxIds: inboxIds,
            monthData: monthData,
            projectName: document.getElementById('projectName').value,
            settings: settings
        });
    }

    let saveTimeout;
    function saveStateDebounced() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveState, 1000);
    }

    async function loadData() {
        if (!db) return;
        const txP = db.transaction('photos', 'readonly');
        const allPhotos = await new Promise(resolve => {
            const req = txP.objectStore('photos').getAll();
            req.onsuccess = () => resolve(req.result);
        });

        photoLibrary = allPhotos.map(p => ({
            id: p.id,
            src: URL.createObjectURL(p.file),
            file: p.file,
            ratio: p.ratio
        }));

        const txS = db.transaction('state', 'readonly');
        const state = await new Promise(resolve => {
            const req = txS.objectStore('state').get('current');
            req.onsuccess = () => resolve(req.result);
        });

        if (state) {
            const libIds = new Set(photoLibrary.map(p => p.id));
            inboxIds = state.inboxIds.filter(id => libIds.has(id));
            monthData = state.monthData.map(m => ({
                photoIds: m.photoIds.filter(id => libIds.has(id)),
                texts: m.texts || {}
            }));
            document.getElementById('projectName').value = state.projectName || "";
            if(state.settings) settings = state.settings;
        }
    }

    async function clearAll() {
        if(!confirm("Slett alt innhold?")) return;
        const tx = db.transaction(['photos', 'state'], 'readwrite');
        tx.objectStore('photos').clear();
        tx.objectStore('state').clear();
        location.reload();
    }

    // --- EXPORT LOGIC (UPDATED TO 450 DPI) ---
    async function exportCalendar() {
        const btn = document.getElementById('exportBtn');
        btn.textContent = "Genererer...";
        btn.disabled = true;

        const zip = new JSZip();
        const projectName = document.getElementById('projectName').value || "Kalender2026";

        // A4 450 DPI
        // 210mm / 25.4 * 450 = 3720
        // 297mm / 25.4 * 450 = 5262
        const exportW = 3720;
        const exportH = 5262;

        const pxPerMmExport = 17.7165; // 450 / 25.4
        const gapExport = settings.gapMM * pxPerMmExport;
        const padExport = settings.padMM * pxPerMmExport;

        const canvas = document.createElement('canvas');
        canvas.width = exportW;
        canvas.height = exportH;
        const ctx = canvas.getContext('2d');

        // Define fonts (Scaled 1.5x from 300dpi version)
        const fontMain = "300 150px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        const fontHeader = "600 52px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        const fontDate = "600 68px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        const fontHoliday = "600 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        const fontUserText = "400 48px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

        try {
            for (let m = 0; m < 12; m++) {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, exportW, exportH);

                // --- PHOTOS ---
                const photoIds = monthData[m].photoIds;
                if (photoIds.length > 0) {
                    const photos = photoIds.map(id => photoLibrary.find(p => p.id === id));
                    const totalAreaH = exportH * 0.6;

                    const effW = exportW - (padExport * 2);
                    const effH = totalAreaH - (padExport * 2);

                    if (effW > 100 && effH > 100) {
                        const layout = calculateOptimalGrid(photos, effW, effH, gapExport);

                        for (const cell of layout.cells) {
                            const img = new Image();
                            img.src = cell.photo.src;
                            await new Promise(r => img.onload = r);

                            const cx = cell.x + padExport;
                            const cy = cell.y + padExport;
                            const cw = cell.width;
                            const ch = cell.height;

                            let sWidth = img.width;
                            let sHeight = img.height;
                            let sx = 0; let sy = 0;
                            const aspectImg = sWidth / sHeight;
                            const aspectRect = cw / ch;

                            if (aspectImg > aspectRect) {
                                const newSW = sHeight * aspectRect;
                                sx = (sWidth - newSW) / 2;
                                sWidth = newSW;
                            } else {
                                const newSH = sWidth / aspectRect;
                                sy = (sHeight - newSH) / 2;
                                sHeight = newSH;
                            }

                            ctx.drawImage(img, sx, sy, sWidth, sHeight, cx, cy, cw, ch);
                        }
                    }
                }

                // --- CALENDAR GRID ---
                const startY = exportH * 0.6;
                const calH = exportH * 0.4;
                const margin = 180; // Scaled 120 * 1.5
                const contentW = exportW - (margin*2);

                // Month Title
                ctx.fillStyle = "#111827";
                ctx.font = fontMain;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(MONTH_NAMES[m].toUpperCase() + " 2026", exportW/2, startY + 75);

                // Grid config
                const gridY = startY + 300;
                const gridH = calH - 375;
                const cellW = contentW / 7;
                const cellH = gridH / 7;

                // Draw Headers (Man, Tir, ...)
                ctx.font = fontHeader;
                ctx.textAlign = "left";
                const days = ['MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR', 'SØN'];

                // Header Top Line (Thick black)
                ctx.strokeStyle = "#111827";
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(margin, gridY);
                ctx.lineTo(exportW - margin, gridY);
                ctx.stroke();

                for(let i=0; i<7; i++) {
                    const x = margin + (i * cellW);
                    const textWidth = ctx.measureText(days[i]).width;
                    ctx.fillStyle = "#4b5563"; // Grayish
                    ctx.fillText(days[i], x + (cellW/2) - (textWidth/2), gridY + 30);
                }

                // Header Bottom Line (Thin gray)
                ctx.strokeStyle = "#9ca3af";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(margin, gridY + 120);
                ctx.lineTo(exportW - margin, gridY + 120);
                ctx.stroke();

                // Draw Grid & Dates
                const firstDate = new Date(2026, m, 1);
                let startDay = firstDate.getDay(); if(startDay===0) startDay=7;
                let dayCounter = 1;
                const daysTotal = DAYS_IN_MONTH[m];

                // Grid Lines Settings
                ctx.strokeStyle = "#e5e7eb";
                ctx.lineWidth = 3;

                for (let r = 0; r < 6; r++) {
                    const y = gridY + 120 + (r * cellH);

                    if (r > 0) {
                        ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(exportW-margin, y); ctx.stroke();
                    }

                    for (let d = 0; d < 7; d++) {
                        const x = margin + (d * cellW);

                        if (d > 0) {
                            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cellH); ctx.stroke();
                        }

                        if ((r===0 && d+1 < startDay) || dayCounter > daysTotal) {
                             if(r===0 && d+1 < startDay) {
                                ctx.fillStyle = "#f9fafb";
                                ctx.fillRect(x, y, cellW, cellH);
                            }
                        } else {
                            const cx = x;
                            const cy = y;
                            const holidayName = HOLIDAYS_2026[`${m}-${dayCounter}`];

                            // Weekend bg
                            if (d >= 5) {
                                ctx.fillStyle = "#f9fafb";
                                ctx.fillRect(x+1, y+1, cellW-2, cellH-2);
                            }

                            // Day Number
                            ctx.fillStyle = "#111827";
                            if (d >= 5 || holidayName) ctx.fillStyle = "#dc2626"; // Red
                            ctx.textAlign = "left";
                            ctx.font = fontDate;
                            ctx.fillText(dayCounter, cx + 22, cy + 22);

                            // Holiday Name
                            if (holidayName) {
                                ctx.font = fontHoliday;
                                ctx.textAlign = "right";
                                ctx.fillText(holidayName, cx + cellW - 15, cy + 22);
                            }

                            // User Notes
                            const userText = monthData[m].texts[dayCounter];
                            if (userText) {
                                ctx.fillStyle = "#4b5563";
                                ctx.textAlign = "left";
                                ctx.font = fontUserText;
                                wrapText(ctx, userText, cx + 22, cy + 120, cellW - 45, 63);
                            }
                            dayCounter++;
                        }
                    }
                }

                // Grid Bottom Border
                ctx.strokeStyle = "#e5e7eb";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(margin, gridY + 120 + (6*cellH));
                ctx.lineTo(exportW - margin, gridY + 120 + (6*cellH));
                ctx.stroke();

                const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
                zip.file(`${m+1}_${MONTH_NAMES[m]}.jpg`, blob);
            }

            const content = await zip.generateAsync({type:"blob"});
            const a = document.createElement("a");
            a.href = URL.createObjectURL(content);
            a.download = `${projectName}.zip`;
            a.click();

        } catch (e) {
            console.error(e);
            alert("Feil under eksport: " + e.message);
        } finally {
            btn.textContent = "Last ned Kalender (ZIP)";
            btn.disabled = false;
        }
    }

    function wrapText(context, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';

        for(let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = context.measureText(testLine);
          const testWidth = metrics.width;
          if (testWidth > maxWidth && n > 0) {
            context.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
          }
          else {
            line = testLine;
          }
        }
        context.fillText(line, x, y);
    }

