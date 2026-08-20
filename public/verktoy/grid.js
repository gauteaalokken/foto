/*
  Logikken for grid-verktøyet. Markup ligger i src/pages/fotoverktoy/grid.astro,
  utseendet i src/styles/verktoy.css.

  Fila lastes med en vanlig <script>-tagg og kjører derfor i globalt navnerom —
  det er med vilje: knappene i markupen kaller funksjonene her direkte via
  onclick, slik verktøyet alltid har gjort.
*/

    // --- KONFIGURASJON ---
    const PAPER_SIZES = {
      A4: { width: 210, height: 297 },
      A3: { width: 297, height: 420 },
      A2: { width: 420, height: 594 },
      LETTER: { width: 216, height: 279 },
      PHOTO_10X15: { width: 100, height: 150 },
      INSTASTORY: { width: 108, height: 192 },
      INSTAINLEGG: { width: 108, height: 135 },
      CUSTOM: { width: 0, height: 0 }
    };

    let customDimensions = { width: 200, height: 200 };
    let previousPaperSize = 'A4';

    let photos = [];
    let pages = [];
    let depotPhotos = [];

    let orientation = 'portrait';
    let currentPageIndex = 0;
    let previewQuality = 'low';
    let historyStack = [];
    let redoStack = [];
    const MAX_HISTORY = 20;
    let currentLayoutId = 1;

    // Safety lock to prevent saving while switching layouts
    let isRestoring = false;

    // --- DATABASE ---
    const dbName = 'PhotoGridDB_Multi_V3';
    const storeName = 'photos';
    const settingsStore = 'settings';
    const layoutsStore = 'layouts';
    let db;

    async function initDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 2);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(storeName)) { db.createObjectStore(storeName, { keyPath: 'id' }); }
          if (!db.objectStoreNames.contains(settingsStore)) { db.createObjectStore(settingsStore, { keyPath: 'key' }); }
          if (!db.objectStoreNames.contains(layoutsStore)) { db.createObjectStore(layoutsStore, { keyPath: 'id' }); }
        };
        request.onsuccess = (event) => { db = event.target.result; resolve(db); };
        request.onerror = (event) => reject(event.target.error);
      });
    }

    // --- SAVED LAYOUTS (named designs, switchable via dropdown) ---
    async function getAllLayouts() {
      if (!db) return [];
      return new Promise(resolve => {
        const tx = db.transaction([layoutsStore], 'readonly');
        tx.objectStore(layoutsStore).getAll().onsuccess = (e) => {
          const layouts = e.target.result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          resolve(layouts);
        };
      });
    }

    async function upsertLayoutMeta(id, name) {
      if (!db) return;
      db.transaction([layoutsStore], 'readwrite').objectStore(layoutsStore).put({ id, name, updatedAt: Date.now() });
    }

    async function touchLayoutTimestamp() {
      if (!db) return;
      const tx = db.transaction([layoutsStore], 'readwrite');
      const store = tx.objectStore(layoutsStore);
      const req = store.get(currentLayoutId);
      req.onsuccess = () => {
        const rec = req.result;
        if (rec) { rec.updatedAt = Date.now(); store.put(rec); }
      };
    }

    async function deleteLayoutMeta(id) {
      if (!db) return;
      db.transaction([layoutsStore], 'readwrite').objectStore(layoutsStore).delete(id);
    }

    // One-time migration: turn the old fixed "Grid 1/2/3" slots into named layout entries
    async function migrateLegacyLayouts() {
      const existing = await getAllLayouts();
      if (existing.length > 0) return;
      const legacyNames = { 1: 'Grid 1', 2: 'Grid 2', 3: 'Grid 3' };
      let migratedAny = false;
      for (const id of [1, 2, 3]) {
        const settings = await new Promise(resolve => {
          const tx = db.transaction([settingsStore], 'readonly');
          tx.objectStore(settingsStore).get('settings_layout_' + id).onsuccess = (e) => resolve(e.target.result);
        });
        if (settings) {
          await upsertLayoutMeta(id, settings.projectName || legacyNames[id]);
          migratedAny = true;
        }
      }
      if (!migratedAny) { await upsertLayoutMeta(1, 'Design 1'); }
    }

    async function refreshLayoutSelect() {
      const layouts = await getAllLayouts();
      const select = document.getElementById('layoutSelect');
      select.innerHTML = '';
      layouts.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = l.name;
        if (l.id === currentLayoutId) opt.selected = true;
        select.appendChild(opt);
      });
      document.getElementById('deleteLayoutBtn').disabled = layouts.length <= 1;
    }

    function onLayoutSelectChange(rawValue) {
      const id = /^\d+$/.test(rawValue) ? Number(rawValue) : rawValue;
      switchLayout(id);
    }

    async function saveLayoutAs() {
      const proposed = document.getElementById('projectName').value.trim() || 'Nytt design';
      const name = prompt('Navn på design:', proposed);
      if (!name || !name.trim()) return;
      const trimmedName = name.trim();

      await saveSettings(); // persist current design before branching off a copy

      const newId = 'layout_' + Date.now();
      currentLayoutId = newId;
      document.getElementById('projectName').value = trimmedName;

      for (const p of photos) { await savePhotoToDB(p); }

      await upsertLayoutMeta(newId, trimmedName);
      await saveSettings();
      await refreshLayoutSelect();

      const status = document.getElementById('saveStatus');
      status.style.display = 'block';
      setTimeout(() => status.style.display = 'none', 1000);
    }

    async function deleteCurrentLayout() {
      const layouts = await getAllLayouts();
      if (layouts.length <= 1) { alert('Du må ha minst ett design.'); return; }
      const current = layouts.find(l => l.id === currentLayoutId);
      const label = current ? current.name : 'dette designet';
      if (!confirm(`Slette "${label}" permanent? Bildene i dette designet blir også slettet.`)) return;

      await clearDBForLayout();
      await deleteLayoutMeta(currentLayoutId);

      photos.forEach(p => { URL.revokeObjectURL(p.originalSrc); URL.revokeObjectURL(p.previewSrc); });
      depotPhotos.forEach(p => { URL.revokeObjectURL(p.originalSrc); URL.revokeObjectURL(p.previewSrc); });
      photos = []; pages = []; depotPhotos = []; historyStack = []; redoStack = [];

      isRestoring = true;
      const remaining = layouts.filter(l => l.id !== currentLayoutId);
      currentLayoutId = remaining[0].id;
      await refreshLayoutSelect();
      document.getElementById('projectName').value = '';
      orientation = 'portrait';

      const loadedPhotos = await loadPhotosFromDB();
      const savedSettings = await loadSettings();
      applyLoadedState(loadedPhotos, savedSettings);
    }

    async function savePhotoToDB(photo) {
      if (!db) return;
      const tx = db.transaction([storeName], 'readwrite');
      tx.objectStore(storeName).put({
        id: photo.id, layoutId: currentLayoutId, name: photo.name,
        width: photo.width, height: photo.height, aspectRatio: photo.aspectRatio,
        file: photo.originalFile
      });
    }

    async function loadPhotosFromDB() {
      if (!db) return [];
      return new Promise((resolve) => {
        const tx = db.transaction([storeName], 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = async () => {
          const layoutRecords = req.result.filter(r => r.layoutId === currentLayoutId);
          const loadedPhotos = [];
          for (const rec of layoutRecords) {
            const thumbData = await createThumbnail(rec.file);
            loadedPhotos.push({
              id: rec.id, name: rec.name, width: rec.width, height: rec.height, aspectRatio: rec.aspectRatio,
              originalFile: rec.file, originalSrc: URL.createObjectURL(rec.file),
              previewSrc: thumbData.src,
              hue: thumbData.hue || 0,
              sat: thumbData.sat || 0,
              light: thumbData.light || 0.5
            });
          }
          resolve(loadedPhotos);
        };
      });
    }

    // --- CRITICAL FIX: PREVENT SAVE DURING RESTORE ---
    async function saveSettings() {
      if(!db || isRestoring) return; // Dont save if we are restoring!

      const pagesStructure = pages.map(page => page.map(p => p.id));
      const depotStructure = depotPhotos.map(p => p.id);

      const tx = db.transaction([settingsStore], 'readwrite');
      const store = tx.objectStore(settingsStore);
      const settings = {
        key: 'settings_layout_' + currentLayoutId,
        pagesStructure: pagesStructure,
        depotStructure: depotStructure,
        projectName: document.getElementById('projectName').value,
        photosPerPage: document.getElementById('photosPerPage').value,
        maxPages: document.getElementById('maxPages').value,
        paperSize: document.getElementById('paperSize').value,
        customDimensions: customDimensions,
        orientation: orientation,
        margin: document.getElementById('margin').value,
        gap: document.getElementById('gap').value,
        bgColor: document.getElementById('bgColorText').value
      };
      store.put(settings);
      touchLayoutTimestamp();
      const status = document.getElementById('saveStatus');
      status.style.display = 'block'; setTimeout(() => status.style.display = 'none', 1000);
    }

    async function loadSettings() {
      if(!db) return null;
      return new Promise(resolve => {
        const tx = db.transaction([settingsStore], 'readonly');
        const req = tx.objectStore(settingsStore).get('settings_layout_' + currentLayoutId);
        req.onsuccess = () => resolve(req.result);
      });
    }

    async function deletePhotoFromDB(id) {
        if(!db) return;
        db.transaction([storeName], 'readwrite').objectStore(storeName).delete(id);
    }

    async function clearDBForLayout() {
      if(!db) return;
      const tx = db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      store.getAll().onsuccess = (e) => {
          e.target.result.forEach(r => { if (r.layoutId === currentLayoutId) store.delete(r.id); });
      };
      db.transaction([settingsStore], 'readwrite').objectStore(settingsStore).delete('settings_layout_' + currentLayoutId);
    }

    // --- Page & Insert Logic ---
    function insertPageAt(index) {
        pushHistory();
        pages.splice(index, 0, []);
        if (index <= currentPageIndex) currentPageIndex++;
        saveSettings();
        renderGrid(false);
        setTimeout(() => {
            const wrapper = document.getElementById('canvasWrapper');
            const targetChild = wrapper.children[(index * 2) + 1];
            if(targetChild) {
                targetChild.scrollIntoView({behavior: 'smooth', inline: 'center'});
            }
        }, 100);
    }

    function createInsertZone(index) {
        const div = document.createElement('div');
        div.className = 'insert-zone';
        div.innerHTML = `<button class="btn-insert" onclick="insertPageAt(${index})" title="Sett inn ny side her">+</button>`;
        return div;
    }

    function removePage(pageIndex) {
        if (pages.length <= 1) {
             if(confirm("Dette er siste side. Vil du tømme den?")) {
                 pushHistory();
                 const photosToRemove = pages[pageIndex];
                 photosToRemove.forEach(p => deletePhotoFromDB(p.id));
                 photos = photos.filter(p => !photosToRemove.includes(p));
                 pages[pageIndex] = [];
                 renderGrid(true);
             }
             return;
        }
        if (!confirm("Vil du slette denne siden? Bildene blir slettet permanent.")) return;

        pushHistory();
        const photosToRemove = pages[pageIndex];
        photosToRemove.forEach(p => deletePhotoFromDB(p.id));
        const idsToRemove = new Set(photosToRemove.map(p => p.id));
        photos = photos.filter(p => !idsToRemove.has(p.id));

        pages.splice(pageIndex, 1);
        if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1;
        renderGrid(true);
    }

    // "Maks sider" overrides "Bilder pr side" only when the manual value
    // would otherwise produce more pages than the cap allows — it raises the
    // target, it never lowers it below what the user set.
    function getEffectivePhotosPerPage(totalCount) {
        const manual = parseInt(document.getElementById('photosPerPage').value) || 10;
        const maxPages = parseInt(document.getElementById('maxPages').value) || 0;
        const note = document.getElementById('photosPerPageNote');

        if (maxPages > 0 && totalCount > 0) {
            const requiredForCap = Math.ceil(totalCount / maxPages);
            const effective = Math.max(manual, requiredForCap);
            if (note) {
                if (effective !== manual) {
                    note.textContent = `Styrt til ${effective} av "Maks sider" (${maxPages})`;
                    note.style.display = 'block';
                } else {
                    note.style.display = 'none';
                }
            }
            return effective;
        }

        if (note) note.style.display = 'none';
        return manual;
    }

    // --- NEW: Empty Depot to Pages ---
    function moveDepotToPages() {
        if (depotPhotos.length === 0) return;
        pushHistory();
        // Collect everything
        const allPhotos = [];
        pages.forEach(p => allPhotos.push(...p));
        allPhotos.push(...depotPhotos);
        depotPhotos = []; // Clear depot

        // Use partition logic to redistribute everything
        const photosPerPage = getEffectivePhotosPerPage(allPhotos.length);
        const tolerance = parseInt(document.getElementById('pageTolerance').value) || 0;
        const paper = getPaperDimensions();
        const margin = parseFloat(document.getElementById('margin').value) || 0;
        const gap = parseFloat(document.getElementById('gap').value) || 0;
        const availableWidth = paper.width - (2*margin);
        const availableHeight = paper.height - (2*margin);

        pages = partitionPhotosIntoPages(allPhotos, photosPerPage, tolerance, availableWidth, availableHeight, gap);
        if (pages.length === 0) pages = [[]];
        currentPageIndex = 0;
        renderGrid(true);
    }

    function autoFlow(includeDepot = false) {
        pushHistory();
        const tolerance = parseInt(document.getElementById('pageTolerance').value) || 0;
        const paper = getPaperDimensions();
        const margin = parseFloat(document.getElementById('margin').value) || 0;
        const gap = parseFloat(document.getElementById('gap').value) || 0;
        const availableWidth = paper.width - (2*margin);
        const availableHeight = paper.height - (2*margin);

        const allPagePhotos = [];
        pages.forEach(p => allPagePhotos.push(...p));

        if (includeDepot) {
            allPagePhotos.push(...depotPhotos);
            depotPhotos = [];
        }

        const photosPerPage = getEffectivePhotosPerPage(allPagePhotos.length);
        pages = partitionPhotosIntoPages(allPagePhotos, photosPerPage, tolerance, availableWidth, availableHeight, gap);
        if (pages.length === 0) pages = [[]];
        renderGrid(true);
    }

    function checkPaperSize(select) {
        if (select.value === 'CUSTOM') {
            document.getElementById('customSizeModal').classList.add('open');
            document.getElementById('customWidth').focus();
        } else {
            previousPaperSize = select.value;
            autoFlow(false);
        }
    }
    function closeCustomModal() { document.getElementById('customSizeModal').classList.remove('open'); document.getElementById('paperSize').value = previousPaperSize; }
    function applyCustomSize() {
        const w = parseFloat(document.getElementById('customWidth').value);
        const h = parseFloat(document.getElementById('customHeight').value);
        if (w > 0 && h > 0) {
            customDimensions = { width: w, height: h };
            updateCustomOptionText();
            document.getElementById('customSizeModal').classList.remove('open');
            previousPaperSize = 'CUSTOM';
            autoFlow(false);
        }
        else { alert("Ugyldige dimensjoner"); }
    }
    function updateCustomOptionText() { const opt = document.querySelector('option[value="CUSTOM"]'); if(opt) opt.textContent = `Spesial (${customDimensions.width}×${customDimensions.height}mm)`; }

    async function switchLayout(newId) {
        if (newId === currentLayoutId) return;

        // Save current before switching
        await saveSettings();

        // SET LOCK: DO NOT SAVE while switching!
        isRestoring = true;

        // Revoke URLs to free memory
        photos.forEach(p => { URL.revokeObjectURL(p.originalSrc); URL.revokeObjectURL(p.previewSrc); });
        depotPhotos.forEach(p => { URL.revokeObjectURL(p.originalSrc); URL.revokeObjectURL(p.previewSrc); });

        photos = []; pages = []; depotPhotos = []; historyStack = []; redoStack = [];
        currentLayoutId = newId;
        await refreshLayoutSelect();
        document.getElementById('projectName').value = '';
        orientation = 'portrait';

        const loadedPhotos = await loadPhotosFromDB();
        const savedSettings = await loadSettings();
        applyLoadedState(loadedPhotos, savedSettings);

        // UNLOCK will happen inside applyLoadedState when done
    }

    // --- UPDATED: Ensures all photos are accounted for ---
    function applyLoadedState(loadedPhotos, savedSettings) {
        const photoMap = new Map(loadedPhotos.map(p => [p.id, p]));

        // Ensure lock is ON (it should be, but just in case)
        isRestoring = true;

        if (savedSettings) {
            document.getElementById('projectName').value = savedSettings.projectName || '';
            document.getElementById('photosPerPage').value = savedSettings.photosPerPage;
            document.getElementById('maxPages').value = savedSettings.maxPages || '0';
            document.getElementById('paperSize').value = savedSettings.paperSize;
            if (savedSettings.customDimensions) {
                customDimensions = savedSettings.customDimensions;
                document.getElementById('customWidth').value = customDimensions.width;
                document.getElementById('customHeight').value = customDimensions.height;
                updateCustomOptionText();
            }
            previousPaperSize = savedSettings.paperSize;
            orientation = savedSettings.orientation || 'portrait';
            // Update buttons visually but don't trigger render yet
            document.getElementById('portraitBtn').className = orientation === 'portrait' ? 'active' : '';
            document.getElementById('landscapeBtn').className = orientation === 'landscape' ? 'active' : '';

            document.getElementById('margin').value = savedSettings.margin;
            document.getElementById('gap').value = savedSettings.gap;
            // Bryterne over er satt, men tallene ved siden av dem sto igjen på
            // verdiene fra markupen — de må settes eksplisitt.
            syncSliderLabels();
            const bg = savedSettings.bgColor || '#FFFFFF';
            document.getElementById('bgColorText').value = bg;
            document.getElementById('bgColorPicker').value = bg;

            // 1. Reconstruct Pages
            if (savedSettings.pagesStructure) {
                pages = savedSettings.pagesStructure.map(pageIds => {
                    return pageIds.map(id => photoMap.get(id)).filter(p => p);
                });
            } else {
                pages = [loadedPhotos];
                // Dont autoflow here if we are just loading empty state, wait.
            }

            // 2. Reconstruct Depot
            depotPhotos = [];
            if (savedSettings.depotStructure) {
                savedSettings.depotStructure.forEach(id => {
                    const p = photoMap.get(id);
                    if(p) depotPhotos.push(p);
                });
            }

            // 3. ORPHAN CHECK
            const placedIds = new Set();
            pages.forEach(page => page.forEach(p => placedIds.add(p.id)));
            depotPhotos.forEach(p => placedIds.add(p.id));

            loadedPhotos.forEach(p => {
                if (!placedIds.has(p.id)) {
                    // Only dump to depot if we actually had settings to begin with
                    // Otherwise it might just be a fresh load
                    console.log("Reddet forsvunnet bilde til depot:", p.name);
                    depotPhotos.push(p);
                }
            });

            photos = loadedPhotos;
        } else {
            // New project
            document.getElementById('projectName').value = "Prosjekt " + currentLayoutId;
            document.getElementById('paperSize').value = 'A4';
            previousPaperSize = 'A4';
            pages = [loadedPhotos];
            depotPhotos = [];
            photos = loadedPhotos;
            setTimeout(() => autoFlow(false), 100);
        }

        // RELEASE LOCK and Render ONE time
        isRestoring = false;
        renderGrid(false); // Render visual but dont save immediately
    }

    // --- OPTIMIZED COLOR CALCULATION ---
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s, l: l };
    }

    // Averaging RGB across the whole photo first (the old approach) muddies
    // mixed-color scenes toward brown/olive — a red flower on green leaves
    // averages to neither red nor green. Instead, convert each sampled pixel
    // to HSL and take a circular mean of hue weighted by sat^2, so a small
    // saturated subject against a duller background still sets the photo's
    // sort color, and reds near the 0°/360° seam average correctly (a plain
    // numeric mean of e.g. 350° and 10° would wrongly give 180°).
    function dominantColorFromPixels(data) {
        let sumX = 0, sumY = 0, sumWeight = 0, sumL = 0, sumS = 0, count = 0;
        for (let i = 0; i < data.length; i += 40) {
            const hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
            const weight = hsl.s * hsl.s;
            const rad = hsl.h * Math.PI / 180;
            sumX += weight * Math.cos(rad);
            sumY += weight * Math.sin(rad);
            sumWeight += weight;
            sumL += hsl.l;
            sumS += hsl.s;
            count++;
        }
        if (count === 0) return { hue: 0, sat: 0, light: 0.5 };
        let hue = 0;
        if (sumWeight > 1e-6) {
            hue = Math.atan2(sumY, sumX) * 180 / Math.PI;
            if (hue < 0) hue += 360;
        }
        return { hue, sat: sumS / count, light: sumL / count };
    }

    function createThumbnail(file, maxWidth = 600) {
      return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const w = img.width * scale;
          const h = img.height * scale;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const data = imageData.data;
          const dominant = dominantColorFromPixels(data);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(url);
            resolve({ src: URL.createObjectURL(blob), width: img.width, height: img.height, hue: dominant.hue, sat: dominant.sat, light: dominant.light });
          }, 'image/jpeg', 0.7);
        };
        img.onerror = () => resolve({ src: url, width: 1000, height: 1000, hue: 0, sat: 0, light: 0.5 });
        img.src = url;
      });
    }

    // --- IMPROVED SORT ---
    function sortByColor() {
        if (photos.length < 2) return;
        pushHistory();

        let allPhotos = [];
        pages.forEach(p => allPhotos.push(...p));
        allPhotos.push(...depotPhotos);
        depotPhotos = [];

        const grayscale = [];
        let colored = [];
        const SAT_THRESHOLD = 0.15;

        allPhotos.forEach(p => {
             const s = (p.sat !== undefined) ? p.sat : 0.5;
             const l = (p.light !== undefined) ? p.light : 0.5;
             if (s < SAT_THRESHOLD) { grayscale.push(p); } else { colored.push(p); }
        });

        grayscale.sort((a, b) => {
             const la = (a.light !== undefined) ? a.light : 0.5;
             const lb = (b.light !== undefined) ? b.light : 0.5;
             return la - lb;
        });

        colored.sort((a, b) => a.hue - b.hue || a.light - b.light);

        // Hue is circular (0deg and 360deg are the same color), so a plain
        // ascending sort splits near-identical reds to opposite ends of the
        // sequence. Rotate the array to start right after the single largest
        // gap between consecutive hues, so that seam lands where there are
        // the fewest photos instead of in the middle of a color the set
        // actually contains.
        if (colored.length > 2) {
            let maxGap = -1, gapIndex = colored.length - 1;
            for (let i = 0; i < colored.length - 1; i++) {
                const gap = colored[i + 1].hue - colored[i].hue;
                if (gap > maxGap) { maxGap = gap; gapIndex = i; }
            }
            const wrapGap = (colored[0].hue + 360) - colored[colored.length - 1].hue;
            if (wrapGap > maxGap) { gapIndex = colored.length - 1; }
            colored = [...colored.slice(gapIndex + 1), ...colored.slice(0, gapIndex + 1)];
        }

        allPhotos = [...grayscale, ...colored];

        const photosPerPage = getEffectivePhotosPerPage(allPhotos.length);
        const tolerance = parseInt(document.getElementById('pageTolerance').value) || 0;
        const paper = getPaperDimensions();
        const margin = parseFloat(document.getElementById('margin').value) || 0;
        const gap = parseFloat(document.getElementById('gap').value) || 0;
        const availableWidth = paper.width - (2*margin);
        const availableHeight = paper.height - (2*margin);

        pages = partitionPhotosIntoPages(allPhotos, photosPerPage, tolerance, availableWidth, availableHeight, gap);
        if (pages.length === 0) pages = [[]];

        renderGrid(true);
    }

    // --- HISTORY (UNDO / REDO) ---
    function captureState() {
        return {
            pages: pages.map(page => page.map(p => p.id)),
            depot: depotPhotos.map(p => p.id)
        };
    }

    function pushHistory() {
        const currentState = captureState();
        if(historyStack.length > 0) {
            const last = historyStack[historyStack.length - 1];
            if(JSON.stringify(last) === JSON.stringify(currentState)) return;
        }
        historyStack.push(currentState);
        if (historyStack.length > MAX_HISTORY) historyStack.shift();
        redoStack = []; // a genuinely new action invalidates whatever could be redone
        updateUndoBtn();
    }

    function restoreState(state) {
        const photoMap = new Map(photos.map(p => [p.id, p]));

        pages = state.pages.map(pageIds => {
            return pageIds.map(id => photoMap.get(id)).filter(p => p);
        });

        depotPhotos = [];
        if(state.depot) {
            state.depot.forEach(id => {
                const p = photoMap.get(id);
                if(p) depotPhotos.push(p);
            });
        }
    }

    function undo() {
        if (historyStack.length === 0) return;
        redoStack.push(captureState());
        if (redoStack.length > MAX_HISTORY) redoStack.shift();

        restoreState(historyStack.pop());
        renderGrid(false);
        updateUndoBtn();
    }

    function redo() {
        if (redoStack.length === 0) return;
        historyStack.push(captureState());
        if (historyStack.length > MAX_HISTORY) historyStack.shift();

        restoreState(redoStack.pop());
        renderGrid(false);
        updateUndoBtn();
    }

    function updateUndoBtn() {
        const undoBtn = document.getElementById('undoBtn');
        undoBtn.disabled = historyStack.length === 0;
        undoBtn.textContent = `Angre (${historyStack.length})`;

        const redoBtn = document.getElementById('redoBtn');
        redoBtn.disabled = redoStack.length === 0;
        redoBtn.textContent = `Gjenta (${redoStack.length})`;
    }

    document.addEventListener('keydown', function(e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
        else if (e.key === 'z') { e.preventDefault(); undo(); }
        else if (e.key === 'y') { e.preventDefault(); redo(); }
    });

    // --- DEBOUNCE & HANDLERS ---
    function debounce(func, wait) {
      let timeout;
      return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); };
    }
    const debouncedRender = debounce(() => { renderGrid(true); }, 50);
    const debouncedAutoFlow = debounce(() => { autoFlow(false); }, 200);

    // Skriver av verdien fra hver glidebryter til tallet som vises ved siden av
    // den. Kalles ved gjenoppretting fra lagret prosjekt; ellers holder
    // handleSliderChange/handleInputChange dem i takt fortløpende.
    function syncSliderLabels() {
      const par = [
        ['photosPerPage', 'photosPerPageInput'],
        ['pageTolerance', 'toleranceValue'],
        ['margin', 'marginValue'],
        ['gap', 'gapValue'],
      ];

      for (const [bryterId, visningId] of par) {
        const bryter = document.getElementById(bryterId);
        const visning = document.getElementById(visningId);
        if (!bryter || !visning) continue;

        if ('value' in visning && visning.tagName === 'INPUT') visning.value = bryter.value;
        else visning.textContent = bryter.value;
      }
    }

    function handleSliderChange(type, value) {
      const val = parseFloat(value) || 0;
      if (type === 'photosPerPage') {
          document.getElementById('photosPerPageInput').value = parseInt(value);
          debouncedAutoFlow();
      }
      else if (type === 'tolerance') { document.getElementById('pageToleranceInput').value = parseInt(value); document.getElementById('toleranceValue').textContent = parseInt(value); debouncedRender(); }
      else if (type === 'margin') { document.getElementById('marginInput').value = val; document.getElementById('marginValue').textContent = val; debouncedRender(); }
      else if (type === 'gap') { document.getElementById('gapInput').value = val; document.getElementById('gapValue').textContent = val; debouncedRender(); }
    }

    function handleInputChange(type, value) {
      const val = parseFloat(value) || 0;
      if (type === 'photosPerPage') {
          document.getElementById('photosPerPage').value = parseInt(value);
          debouncedAutoFlow();
      }
      else if (type === 'tolerance') { document.getElementById('pageTolerance').value = parseInt(value); document.getElementById('toleranceValue').textContent = parseInt(value); debouncedRender(); }
      else if (type === 'margin') { document.getElementById('margin').value = val; document.getElementById('marginValue').textContent = val; debouncedRender(); }
      else if (type === 'gap') { document.getElementById('gap').value = val; document.getElementById('gapValue').textContent = val; debouncedRender(); }
    }
    function resetAndRender(save = true) { renderGrid(save); }

    // --- DRAG & DROP UTILS ---
    let draggedPhotoId = null;
    let draggedPageIdx = null;
    let dragSourceType = null;
    let dragType = null;

    // PHOTO DRAG
    function handleDragStart(e, id, sourcePageIndex, sourceType = 'page') {
        e.stopPropagation();
        draggedPhotoId = id;
        draggedPageIdx = sourcePageIndex;
        dragSourceType = sourceType;
        dragType = 'photo';
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    // PAGE DRAG
    function handlePageDragStart(e, pageIndex) {
        draggedPageIdx = pageIndex;
        dragType = 'page-move';
        const pageContainer = document.getElementById(`page-${pageIndex}`);
        if(pageContainer) {
            pageContainer.classList.add('page-dragging');
        }
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (dragType === 'page-move') {
             const pageContainer = e.target.closest('.page-container');
             if (pageContainer && pageContainer.dataset.index != draggedPageIdx) {
                 pageContainer.classList.add('page-drop-target');
             }
        } else if (dragType === 'photo') {
             const page = e.target.closest('.page-container');
             if (page) page.classList.add('drag-active');

             const depot = e.target.closest('.depot-content');
             if (depot) depot.classList.add('drag-over');

             const cell = e.target.closest('.photo-cell');
             if (cell && cell.dataset.id !== String(draggedPhotoId)) cell.classList.add('drag-over');
        }
        return false;
    }

    function handleDragEnter(e) { e.preventDefault(); }

    function handleDragLeave(e) {
        if (dragType === 'photo') {
            const target = e.target.closest('.photo-cell'); if (target) target.classList.remove('drag-over');
            const page = e.target.closest('.page-container'); if (page && !page.contains(e.relatedTarget)) page.classList.remove('drag-active');
            const depot = e.target.closest('.depot-content'); if(depot && !depot.contains(e.relatedTarget)) depot.classList.remove('drag-over');
        }
        if (dragType === 'page-move') {
            const pageContainer = e.target.closest('.page-container');
            if (pageContainer) pageContainer.classList.remove('page-drop-target');
        }
    }

    function handleDrop(e, targetId) {
      e.stopPropagation(); e.preventDefault();

      document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      document.querySelectorAll('.page-drop-target').forEach(el => el.classList.remove('page-drop-target'));
      document.querySelectorAll('.page-dragging').forEach(el => el.classList.remove('page-dragging'));
      document.querySelectorAll('.page-container').forEach(el => el.classList.remove('drag-active'));
      document.querySelectorAll('.depot-content').forEach(el => el.classList.remove('drag-over'));

      // --- HANDLE PAGE REORDER ---
      if (dragType === 'page-move') {
          const targetPageEl = e.target.closest('.page-container');
          if (!targetPageEl) return;
          const targetIdx = parseInt(targetPageEl.dataset.index);

          if (draggedPageIdx !== null && draggedPageIdx !== targetIdx) {
              pushHistory();
              const pageToMove = pages[draggedPageIdx];
              pages.splice(draggedPageIdx, 1);
              pages.splice(targetIdx, 0, pageToMove);
              currentPageIndex = targetIdx;
              renderGrid(true);
          }
          draggedPageIdx = null; dragType = null;
          return;
      }

      // --- HANDLE PHOTO DROP ---
      if (dragType === 'photo' && draggedPhotoId !== null) {
          pushHistory();
          let photoItem;

          // 1. Remove from Source
          if (dragSourceType === 'depot') {
              photoItem = depotPhotos.find(p => p.id === draggedPhotoId);
              depotPhotos = depotPhotos.filter(p => p.id !== draggedPhotoId);
          } else {
              photoItem = pages[draggedPageIdx].find(p => p.id === draggedPhotoId);
              pages[draggedPageIdx] = pages[draggedPageIdx].filter(p => p.id !== draggedPhotoId);
          }

          if (!photoItem) return;

          // 2. Add to Target
          if (targetId === 'depot') {
              depotPhotos.push(photoItem);
          } else {
              const pageEl = e.target.closest('.page-container');
              if (!pageEl) {
                  if(dragSourceType === 'depot') depotPhotos.push(photoItem);
                  else pages[draggedPageIdx].push(photoItem);
                  renderGrid(true); return;
              }

              const targetPageIndex = parseInt(pageEl.dataset.index);

              if (targetId && targetId !== 'depot') {
                  const targetIndex = pages[targetPageIndex].findIndex(p => p.id === targetId);
                  if (targetIndex > -1) { pages[targetPageIndex].splice(targetIndex, 0, photoItem); }
                  else { pages[targetPageIndex].push(photoItem); }
              } else {
                  pages[targetPageIndex].push(photoItem);
              }
          }

          draggedPhotoId = null; dragSourceType = null; dragType = null;
          renderGrid(true);
      }
      return false;
    }

    function handleDragEnd(e) {
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        document.querySelectorAll('.page-drop-target').forEach(el => el.classList.remove('page-drop-target'));
        draggedPhotoId = null; draggedPageIdx = null; dragType = null;
    }

    // --- TOUCH DRAG SUPPORT ---
    // Native HTML5 drag-and-drop (dragstart/dragover/drop) has no touch
    // equivalent, so this translates single-finger touch gestures on the same
    // draggable elements into the exact same handleDragStart/handleDragOver/
    // handleDrop/handlePageDragStart functions the mouse path uses, via a
    // synthetic event that carries only what those functions actually read
    // (target, preventDefault, stopPropagation, dataTransfer). A short
    // long-press is required before a touch becomes a drag, so a quick swipe
    // on a photo still scrolls the page horizontally as normal instead of
    // being hijacked into a drag.
    let touchGhost = null;
    let activeTouchDragKind = null; // 'photo' | 'page-move', mirrors dragType while a touch drag is live

    function makeSyntheticEvent(clientX, clientY, fallbackTarget) {
        const target = document.elementFromPoint(clientX, clientY) || fallbackTarget || document.body;
        return {
            target,
            preventDefault() {},
            stopPropagation() {},
            dataTransfer: { dropEffect: '', effectAllowed: '' },
        };
    }

    function clearTouchDragVisuals() {
        document.querySelectorAll('.drag-over, .page-drop-target, .drag-active').forEach((el) => {
            el.classList.remove('drag-over', 'page-drop-target', 'drag-active');
        });
    }

    function createTouchGhost(sourceEl, x, y) {
        const rect = sourceEl.getBoundingClientRect();
        const ghost = sourceEl.cloneNode(true);
        ghost.classList.remove('dragging', 'page-dragging');
        ghost.style.position = 'fixed';
        ghost.style.zIndex = '9999';
        ghost.style.pointerEvents = 'none';
        ghost.style.width = rect.width + 'px';
        ghost.style.height = rect.height + 'px';
        ghost.style.left = (x - rect.width / 2) + 'px';
        ghost.style.top = (y - rect.height / 2) + 'px';
        ghost.style.opacity = '0.85';
        ghost.style.transform = 'scale(1.05)';
        ghost.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
        ghost.style.borderRadius = '6px';
        document.body.appendChild(ghost);
        return ghost;
    }

    function moveTouchGhost(x, y) {
        if (!touchGhost) return;
        touchGhost.style.left = (x - touchGhost.offsetWidth / 2) + 'px';
        touchGhost.style.top = (y - touchGhost.offsetHeight / 2) + 'px';
    }

    // Wires touchstart/move/end onto a draggable element so it can also be
    // dragged with a finger. getArgs() is called once the long-press fires
    // and supplies the same arguments the mouse dragstart handler receives.
    function attachTouchDrag(el, kind, startFn, getArgs) {
        let pressTimer = null;
        let startX = 0, startY = 0;
        let dragLive = false;

        el.addEventListener('touchstart', (e) => {
            if (e.target.closest('.remove-btn')) return;
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            startX = touch.clientX; startY = touch.clientY;
            dragLive = false;

            pressTimer = setTimeout(() => {
                dragLive = true;
                activeTouchDragKind = kind;
                const synthetic = makeSyntheticEvent(touch.clientX, touch.clientY, el);
                synthetic.target = el;
                startFn(synthetic, ...getArgs());
                touchGhost = createTouchGhost(el, touch.clientX, touch.clientY);
                if (navigator.vibrate) navigator.vibrate(10);
            }, 200);
        }, { passive: true });

        el.addEventListener('touchmove', (e) => {
            if (dragLive) return; // document-level listener takes over once a drag is live
            const touch = e.touches[0];
            if (!touch) return;
            if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
                clearTimeout(pressTimer); // moved before the long-press fired: treat as a scroll, not a drag
            }
        }, { passive: true });

        el.addEventListener('touchend', () => { clearTimeout(pressTimer); dragLive = false; }, { passive: true });
        el.addEventListener('touchcancel', () => { clearTimeout(pressTimer); dragLive = false; }, { passive: true });
    }

    document.addEventListener('touchmove', (e) => {
        if (!activeTouchDragKind) return;
        e.preventDefault(); // block scrolling while a drag is live
        const touch = e.touches[0];
        if (!touch) return;
        moveTouchGhost(touch.clientX, touch.clientY);
        clearTouchDragVisuals();
        handleDragOver(makeSyntheticEvent(touch.clientX, touch.clientY));
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (!activeTouchDragKind) return;
        const touch = e.changedTouches[0];
        if (touchGhost) { touchGhost.remove(); touchGhost = null; }

        const synthetic = touch ? makeSyntheticEvent(touch.clientX, touch.clientY) : { target: document.body, preventDefault(){}, stopPropagation(){}, dataTransfer: {} };
        const dropEl = synthetic.target;

        let targetId;
        if (activeTouchDragKind === 'photo') {
            const cell = dropEl.closest('.photo-cell');
            const depot = dropEl.closest('.depot-content');
            if (cell && cell.dataset.id !== String(draggedPhotoId)) targetId = parseFloat(cell.dataset.id);
            else if (depot) targetId = 'depot';
        }

        handleDrop(synthetic, targetId);
        handleDragEnd(synthetic);
        activeTouchDragKind = null;
    }, { passive: false });

    function changePage(delta) {
      const totalPages = pages.length || 1;
      let newIndex = currentPageIndex + delta;
      if (newIndex >= 0 && newIndex < totalPages) { currentPageIndex = newIndex; renderGrid(false); }
    }

    document.getElementById('fileInput').addEventListener('change', handleFileUpload);

    // --- MAIN RENDER FUNCTION ---
    function renderGrid(save = true) {
      if (save) saveSettings();

      const paper = getPaperDimensions();
      const aspectRatio = paper.width / paper.height;
      const isMobile = window.innerWidth <= 900;
      const padding = 80;
      const sidebarWidth = isMobile ? 0 : 340;
      const maxWidth = window.innerWidth - sidebarWidth - (padding * 2);
      // Measured, not a hardcoded window.innerHeight offset: that guess predates
      // the site header added above the tool, so it no longer matched the real
      // available space and let the page preview render taller than the visible
      // area — .canvas-scroller's overflow-y:hidden then clipped the bottom of
      // it right where the depot bar sits, looking like the depot was covering
      // the grid. clientHeight already reflects the real space after the header
      // and depot bar take theirs, so this stays correct if either ever changes.
      const maxHeight = document.getElementById('canvasWrapper').clientHeight - 80;

      let displayWidth = maxWidth;
      let displayHeight = displayWidth / aspectRatio;
      if (displayHeight > maxHeight) { displayHeight = maxHeight; displayWidth = displayHeight * aspectRatio; }
      displayWidth = Math.max(100, displayWidth); displayHeight = Math.max(100, displayHeight);

      const margin = parseFloat(document.getElementById('margin').value) || 0;
      const gap = parseFloat(document.getElementById('gap').value) || 0;

      const marginPx = (margin / paper.width) * displayWidth;
      const gapPx = (gap / paper.width) * displayWidth;
      const availableWidth = displayWidth - (2 * marginPx);
      const availableHeight = displayHeight - (2 * marginPx);

      const canvasWrapper = document.getElementById('canvasWrapper');
      canvasWrapper.innerHTML = '';

      if (pages.length === 0 && photos.length > 0) { pages = [[]]; }

      const totalPages = pages.length;
      if (currentPageIndex >= totalPages) currentPageIndex = totalPages - 1;
      if (currentPageIndex < 0) currentPageIndex = 0;

      document.getElementById('photoCount').textContent = photos.length;
      document.getElementById('pageNav').style.display = totalPages > 0 ? 'flex' : 'none';
      document.getElementById('pageIndicator').textContent = `Side ${currentPageIndex + 1} av ${Math.max(1, totalPages)}`;
      document.getElementById('prevBtn').disabled = currentPageIndex <= 0;
      document.getElementById('nextBtn').disabled = currentPageIndex >= totalPages - 1;

      canvasWrapper.appendChild(createInsertZone(0));

      pages.forEach((pagePhotos, i) => {
          const pageContainer = document.createElement('div');
          pageContainer.className = 'page-container';
          if (i === currentPageIndex) pageContainer.classList.add('active');
          pageContainer.id = `page-${i}`;
          pageContainer.dataset.index = i;

          pageContainer.onclick = () => { currentPageIndex = i; renderGrid(false); };

          // Header
          const header = document.createElement('div');
          header.className = 'page-header';

          const labelGroup = document.createElement('div');
          labelGroup.className = 'page-label-group';

          const dragHandle = document.createElement('div');
          dragHandle.className = 'page-drag-handle';
          dragHandle.title = 'Dra for å flytte side';
          dragHandle.innerHTML = '☰';
          dragHandle.style.cursor = 'grab';
          dragHandle.style.marginRight = '6px';
          dragHandle.draggable = true;
          dragHandle.ondragstart = (e) => handlePageDragStart(e, i);
          dragHandle.ondragend = handleDragEnd;
          attachTouchDrag(dragHandle, 'page-move', handlePageDragStart, () => [i]);

          const label = document.createElement('div');
          label.className = 'page-label';
          label.textContent = `Side ${i + 1}`;

          labelGroup.appendChild(dragHandle);
          labelGroup.appendChild(label);

          const delBtn = document.createElement('button');
          delBtn.className = 'delete-page-btn';
          delBtn.innerHTML = '×';
          delBtn.title = 'Slett side';
          delBtn.onclick = (e) => { e.stopPropagation(); removePage(i); };

          header.appendChild(labelGroup);
          header.appendChild(delBtn);
          pageContainer.appendChild(header);

          // Canvas
          const canvasEl = document.createElement('div');
          canvasEl.className = 'canvas';
          canvasEl.style.width = displayWidth + 'px';
          canvasEl.style.height = displayHeight + 'px';
          canvasEl.style.backgroundColor = document.getElementById('bgColorText').value;
          canvasEl.ondragover = handleDragOver;
          canvasEl.ondrop = (e) => {
    const cell = e.target.closest('.photo-cell');
    handleDrop(e, cell ? cell.dataset.id : null);
};

          // Grid Calculation
          const gridEl = document.createElement('div');
          gridEl.style.position = 'absolute';
          gridEl.style.width = availableWidth + 'px';
          gridEl.style.height = availableHeight + 'px';
          gridEl.style.left = marginPx + 'px';
          gridEl.style.top = marginPx + 'px';

          const grid = calculateOptimalGrid(pagePhotos, availableWidth, availableHeight, gapPx);

          grid.cells.forEach((cell) => {
            const div = document.createElement('div');
            div.className = 'photo-cell';
            div.style.left = cell.x + 'px'; div.style.top = cell.y + 'px';
            div.style.width = cell.width + 'px'; div.style.height = cell.height + 'px';
            div.draggable = true;
            div.dataset.id = cell.photo.id;
            div.ondragstart = (e) => handleDragStart(e, cell.photo.id, i, 'page');
            div.ondrop = (e) => { e.stopPropagation(); handleDrop(e, cell.photo.id); };
            div.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); };
            attachTouchDrag(div, 'photo', handleDragStart, () => [cell.photo.id, i, 'page']);

            const img = document.createElement('img');
            img.src = previewQuality === 'low' ? cell.photo.previewSrc : cell.photo.originalSrc;

            const btn = document.createElement('button');
            btn.className = 'remove-btn';
            btn.innerHTML = '×';
            btn.title = "Slett bilde (permanent)";
            btn.onclick = (e) => {
              e.stopPropagation();
              if(confirm("Slette bildet permanent?")) {
                  pushHistory();
                  pages[i] = pages[i].filter(p => p.id !== cell.photo.id);
                  deletePhotoFromDB(cell.photo.id);
                  photos = photos.filter(p => p.id !== cell.photo.id);
                  renderGrid(true);
              }
            };

            div.appendChild(img);
            div.appendChild(btn);
            gridEl.appendChild(div);
          });

          canvasEl.appendChild(gridEl);
          pageContainer.appendChild(canvasEl);
          canvasWrapper.appendChild(pageContainer);
          canvasWrapper.appendChild(createInsertZone(i + 1));
      });

      renderDepot();
    }

    function renderDepot() {
        const depotEl = document.getElementById('depotContainer');
        const countEl = document.getElementById('depotCount');
        depotEl.innerHTML = '';
        countEl.textContent = depotPhotos.length;

        if(depotPhotos.length === 0) {
            depotEl.innerHTML = '<div class="empty-msg">Dra bilder hit for å spare dem</div>';
            return;
        }

        depotPhotos.forEach(photo => {
            const div = document.createElement('div');
            div.className = 'depot-item';
            div.draggable = true;
            div.ondragstart = (e) => handleDragStart(e, photo.id, null, 'depot');
            attachTouchDrag(div, 'photo', handleDragStart, () => [photo.id, null, 'depot']);

            const img = document.createElement('img');
            img.src = photo.previewSrc;

            const btn = document.createElement('button');
            btn.className = 'remove-btn';
            btn.innerHTML = '×';
            btn.onclick = (e) => {
                e.stopPropagation();
                if(confirm("Slette bildet permanent?")) {
                    pushHistory();
                    depotPhotos = depotPhotos.filter(p => p.id !== photo.id);
                    deletePhotoFromDB(photo.id);
                    photos = photos.filter(p => p.id !== photo.id);
                    renderGrid(true);
                }
            };

            div.appendChild(img);
            div.appendChild(btn);
            depotEl.appendChild(div);
        });
    }

    function handleFileUpload(e) { handleFiles(Array.from(e.target.files)); }

    async function handleFiles(files) {
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      pushHistory();

      const btn = document.getElementById('uploadBtn');
      const originalText = btn.textContent;
      btn.textContent = "Laster...";
      btn.disabled = true;

      const processingPromises = imageFiles.map(async (file) => {
            const originalUrl = URL.createObjectURL(file);
            const thumbData = await createThumbnail(file);
            const photoObj = {
                id: Date.now() + Math.random(), originalFile: file, originalSrc: originalUrl,
                previewSrc: thumbData.src, name: file.name, width: thumbData.width,
                height: thumbData.height, aspectRatio: thumbData.width / thumbData.height,
                hue: thumbData.hue || 0,
                sat: thumbData.sat || 0,
                light: thumbData.light || 0.5
            };
            await savePhotoToDB(photoObj);
            return photoObj;
        });

      const newPhotos = await Promise.all(processingPromises);
      newPhotos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      photos.push(...newPhotos);

      if (pages.length === 0) pages.push([]);
      pages[currentPageIndex].push(...newPhotos);

      btn.textContent = originalText;
      btn.disabled = false;
      renderGrid(true);
    }

    function setOrientation(ori) {
      orientation = ori;
      document.getElementById('portraitBtn').className = ori === 'portrait' ? 'active' : '';
      document.getElementById('landscapeBtn').className = ori === 'landscape' ? 'active' : '';
      // Trigger flow on change
      autoFlow(false);
    }

    async function clearAll() {
      if (!confirm(`Slette alle ${photos.length} bilder og alle sider i dette designet? Det kan ikke angres.`)) return;
      photos.forEach(p => { URL.revokeObjectURL(p.originalSrc); URL.revokeObjectURL(p.previewSrc); });
      photos = []; pages = [[]]; depotPhotos = [];
      await clearDBForLayout();
      historyStack = []; redoStack = []; updateUndoBtn();
      currentPageIndex = 0;
      renderGrid(true);
    }

    function getPaperDimensions() {
      const paperSize = document.getElementById('paperSize').value;
      let size = PAPER_SIZES[paperSize];
      if (paperSize === 'CUSTOM') size = customDimensions;
      return orientation === 'landscape' ? { width: size.height, height: size.width } : { width: size.width, height: size.height };
    }

    // --- GRID CALCULATION ALGORITHM ---
    function calculateOptimalGrid(pagePhotos, width, height, gap) {
      if (!pagePhotos || pagePhotos.length === 0) return { cells: [], totalHeight: 0, fitScore: Infinity };
      function createLayout(targetRows) {
        const rows = [];
        const baseCount = Math.floor(pagePhotos.length / targetRows);
        const extras = pagePhotos.length % targetRows;
        let photoIdx = 0;
        for (let r = 0; r < targetRows; r++) {
          const count = baseCount + (r < extras ? 1 : 0);
          const rowPhotos = [];
          let aspectSum = 0;
          for (let i = 0; i < count; i++) {
            if (photoIdx < pagePhotos.length) { rowPhotos.push(pagePhotos[photoIdx]); aspectSum += pagePhotos[photoIdx].aspectRatio; photoIdx++; }
          }
          if (rowPhotos.length > 0) {
            const gaps = (rowPhotos.length - 1) * gap;
            const rowHeight = (width - gaps) / aspectSum;
            rows.push({ photos: rowPhotos, height: rowHeight, aspectSum });
          }
        }
        const totalGapHeight = (rows.length - 1) * gap;
        const naturalHeight = rows.reduce((sum, r) => sum + r.height, 0) + totalGapHeight;
        return { rows, naturalHeight, totalGapHeight };
      }

      let bestLayout = null; let bestScore = Infinity;
      for (let r = 1; r <= pagePhotos.length; r++) {
        const layout = createLayout(r);
        const contentHeight = layout.naturalHeight - layout.totalGapHeight;
        const requiredContentHeight = height - layout.totalGapHeight;
        if (requiredContentHeight <= 0) continue;
        const scale = requiredContentHeight / contentHeight;
        let score;
        if (scale >= 0.9 && scale <= 1.1) { score = Math.abs(1 - scale); }
        else { if (scale < 0.9) score = 100 + (0.9 - scale); else score = 100 + (scale - 1.1); }
        if (score < bestScore) { bestScore = score; bestLayout = { ...layout, optimalScale: scale }; }
      }
      if (!bestLayout) return { cells: [], totalHeight: 0, fitScore: Infinity };

      const rows = bestLayout.rows;
      let finalScale = bestLayout.optimalScale;
      if (finalScale < 0.9) finalScale = 0.9;
      if (finalScale > 1.1) finalScale = 1.1;

      let currentTotalHeight = rows.reduce((sum, r) => sum + (r.height * finalScale), 0) + bestLayout.totalGapHeight;
      let fitScale = 1;
      if (currentTotalHeight > height) { fitScale = height / currentTotalHeight; currentTotalHeight = height; }

      const cells = [];
      let yPos = (currentTotalHeight < height) ? (height - currentTotalHeight) / 2 : 0;
      const finalTotalWidth = width * fitScale;
      const xOffset = (width - finalTotalWidth) / 2;

      rows.forEach(row => {
        const finalRowHeight = row.height * finalScale * fitScale;
        const rowGapTotal = (row.photos.length - 1) * gap * fitScale;
        const availableRowWidth = finalTotalWidth - rowGapTotal;
        let xPos = xOffset;
        row.photos.forEach(photo => {
          const cellWidth = (photo.aspectRatio / row.aspectSum) * availableRowWidth;
          cells.push({ x: xPos, y: yPos, width: cellWidth, height: finalRowHeight, photo: photo });
          xPos += cellWidth + (gap * fitScale);
        });
        yPos += finalRowHeight + (gap * fitScale);
      });
      return { cells, totalHeight: currentTotalHeight, fitScore: bestScore };
    }

    function partitionPhotosIntoPages(allPhotos, target, tolerance, width, height, gap) {
      const resultPages = [];
      let currentIndex = 0;
      while (currentIndex < allPhotos.length) {
        let bestCount = target; let bestChunkScore = Infinity;
        const minCount = Math.max(1, target - tolerance);
        const maxCount = target + tolerance;
        const remaining = allPhotos.length - currentIndex;
        if (remaining <= maxCount) { resultPages.push(allPhotos.slice(currentIndex)); break; }
        for (let c = minCount; c <= maxCount; c++) {
          if (c > remaining) break;
          const chunk = allPhotos.slice(currentIndex, currentIndex + c);
          const result = calculateOptimalGrid(chunk, width, height, gap);
          const targetDeviation = Math.abs(target - c) * 0.05;
          const totalScore = result.fitScore + targetDeviation;
          if (totalScore < bestChunkScore) { bestChunkScore = totalScore; bestCount = c; }
        }
        resultPages.push(allPhotos.slice(currentIndex, currentIndex + bestCount));
        currentIndex += bestCount;
      }
      return resultPages;
    }

    function getProjectName() {
        let name = document.getElementById('projectName').value.trim();
        if(!name) name = `prosjekt-${currentLayoutId}`;
        return name.replace(/[^a-z0-9æøå]/gi, '-');
    }
    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image(); img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img); img.onerror = (e) => reject(e); img.src = src;
      });
    }
    async function createPageCanvas(pagePhotos, exportWidth, exportHeight, marginPx, gapPx, bgColor) {
      const canvas = document.createElement('canvas'); canvas.width = exportWidth; canvas.height = exportHeight;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = bgColor; ctx.fillRect(0, 0, exportWidth, exportHeight);
      const availableWidth = exportWidth - 2 * marginPx; const availableHeight = exportHeight - 2 * marginPx;
      const grid = calculateOptimalGrid(pagePhotos, availableWidth, availableHeight, gapPx);
      for (let i = 0; i < grid.cells.length; i++) {
        const cell = grid.cells[i]; const photo = cell.photo;
        const img = await loadImage(photo.originalSrc);
        const cellAspect = cell.width / cell.height; const photoAspect = photo.aspectRatio;
        let drawWidth, drawHeight, offsetX, offsetY;
        if (photoAspect > cellAspect) { drawHeight = cell.height; drawWidth = drawHeight * photoAspect; offsetX = (cell.width - drawWidth) / 2; offsetY = 0; }
        else { drawWidth = cell.width; drawHeight = drawWidth / photoAspect; offsetX = 0; offsetY = (cell.height - drawHeight) / 2; }
        const x = Math.round(marginPx + cell.x + offsetX); const y = Math.round(marginPx + cell.y + offsetY);
        ctx.save(); ctx.beginPath(); ctx.rect(Math.round(marginPx + cell.x), Math.round(marginPx + cell.y), Math.round(cell.width), Math.round(cell.height)); ctx.clip();
        ctx.drawImage(img, x, y, Math.round(drawWidth), Math.round(drawHeight)); ctx.restore();
      }
      return canvas;
    }

    function createPageBlob(pagePhotos, exportWidth, exportHeight, marginPx, gapPx, bgColor) {
      return createPageCanvas(pagePhotos, exportWidth, exportHeight, marginPx, gapPx, bgColor).then(canvas => new Promise((resolve, reject) => {
        canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Failed to create blob')); }, 'image/jpeg', 0.95);
      }));
    }

    async function exportGrid() {
      if (photos.length === 0) return;
      const paper = getPaperDimensions(); const dpi = parseInt(document.getElementById('dpi').value);
      const mmToPixels = dpi / 25.4; const exportWidth = Math.round(paper.width * mmToPixels); const exportHeight = Math.round(paper.height * mmToPixels);
      const margin = parseFloat(document.getElementById('margin').value); const gap = parseFloat(document.getElementById('gap').value);
      const marginPx = Math.round(margin * mmToPixels); const gapPx = Math.round(gap * mmToPixels);
      const pagesToExport = pages;
      const baseName = getProjectName(); const btn = document.getElementById('exportBtn');
      btn.disabled = true; btn.textContent = "Genererer...";
      try {
        for (let pageIndex = 0; pageIndex < pagesToExport.length; pageIndex++) {
          const pagePhotos = pagesToExport[pageIndex];
          const blob = await createPageBlob(pagePhotos, exportWidth, exportHeight, marginPx, gapPx, document.getElementById('bgColorText').value);
          const url = URL.createObjectURL(blob); const a = document.createElement('a');
          const fileName = pagesToExport.length > 1 ? `${baseName}-side${pageIndex + 1}-${dpi}dpi.jpg` : `${baseName}-${dpi}dpi.jpg`;
          a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) { alert('Feil ved eksport: ' + err.message); }
      finally { btn.disabled = false; btn.textContent = "Lagre som JPG"; }
    }

    async function downloadAllZip() {
      if (photos.length === 0) return;
      const paper = getPaperDimensions(); const dpi = parseInt(document.getElementById('dpi').value);
      const mmToPixels = dpi / 25.4; const exportWidth = Math.round(paper.width * mmToPixels); const exportHeight = Math.round(paper.height * mmToPixels);
      const margin = parseFloat(document.getElementById('margin').value); const gap = parseFloat(document.getElementById('gap').value);
      const marginPx = Math.round(margin * mmToPixels); const gapPx = Math.round(gap * mmToPixels);
      const pagesToExport = pages;
      const zip = new JSZip(); const baseName = getProjectName(); const btn = document.getElementById('downloadAllBtn');
      btn.disabled = true; btn.textContent = "Pakker zip...";
      try {
        for (let pageIndex = 0; pageIndex < pagesToExport.length; pageIndex++) {
          const pagePhotos = pagesToExport[pageIndex];
          const blob = await createPageBlob(pagePhotos, exportWidth, exportHeight, marginPx, gapPx, document.getElementById('bgColorText').value);
          const fileName = pagesToExport.length > 1 ? `${baseName}-side${pageIndex + 1}-${dpi}dpi.jpg` : `${baseName}-${dpi}dpi.jpg`;
          zip.file(fileName, blob); await new Promise(r => setTimeout(r, 100));
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob); const a = document.createElement('a');
        a.href = url; a.download = `${baseName}-${dpi}dpi.zip`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      } catch (err) { alert('Feil ved zip: ' + err.message); }
      finally { btn.disabled = false; btn.textContent = "Last ned zip"; }
    }

    async function exportPDF() {
      if (photos.length === 0) return;
      const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
      if (!jsPDFCtor) { alert('PDF-verktøyet kunne ikke lastes. Sjekk nettforbindelsen og prøv igjen.'); return; }

      const paper = getPaperDimensions(); const dpi = parseInt(document.getElementById('dpi').value);
      const mmToPixels = dpi / 25.4; const exportWidth = Math.round(paper.width * mmToPixels); const exportHeight = Math.round(paper.height * mmToPixels);
      const margin = parseFloat(document.getElementById('margin').value); const gap = parseFloat(document.getElementById('gap').value);
      const marginPx = Math.round(margin * mmToPixels); const gapPx = Math.round(gap * mmToPixels);
      const pagesToExport = pages;
      const baseName = getProjectName(); const btn = document.getElementById('exportPdfBtn');
      const orientation = paper.width > paper.height ? 'l' : 'p';

      btn.disabled = true; btn.textContent = "Genererer PDF...";
      try {
        const doc = new jsPDFCtor({ orientation, unit: 'mm', format: [paper.width, paper.height], compress: true });
        for (let pageIndex = 0; pageIndex < pagesToExport.length; pageIndex++) {
          const canvas = await createPageCanvas(pagesToExport[pageIndex], exportWidth, exportHeight, marginPx, gapPx, document.getElementById('bgColorText').value);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          if (pageIndex > 0) doc.addPage([paper.width, paper.height], orientation);
          doc.addImage(dataUrl, 'JPEG', 0, 0, paper.width, paper.height);
          await new Promise(r => setTimeout(r, 30));
        }
        doc.save(`${baseName}-${dpi}dpi.pdf`);
      } catch (err) { alert('Feil ved PDF-eksport: ' + err.message); }
      finally { btn.disabled = false; btn.textContent = "Lagre som PDF"; }
    }

    (async function startApp() {
        try {
            await initDB();
            await migrateLegacyLayouts();
            const layouts = await getAllLayouts();
            currentLayoutId = layouts[0].id;
            await refreshLayoutSelect();
            const loadedPhotos = await loadPhotosFromDB();
            const savedSettings = await loadSettings();
            applyLoadedState(loadedPhotos, savedSettings);
        } catch (e) {
            console.error("Database init failed", e);
        }
    })();

    window.addEventListener('resize', () => debouncedRender());
