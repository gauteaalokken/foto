/*
  Logikken for instagram-verktøyet. Markup ligger i src/pages/fotoverktoy/instagram.astro,
  utseendet i src/styles/verktoy.css.

  Fila lastes med en vanlig <script>-tagg og kjører derfor i globalt navnerom —
  det er med vilje: knappene i markupen kaller funksjonene her direkte via
  onclick, slik verktøyet alltid har gjort.
*/

    const FORMATS = {
      square: { width: 1, height: 1 },
      portrait: { width: 4, height: 5 },
      landscape: { width: 16, height: 9 },
      wide: { width: 3, height: 2 },
      story: { width: 9, height: 16 }
    };

    let photos = [];
    let currentFormat = 'portrait';
    let instagramFeed = [];
    let panoramaImages = new Set();

    document.getElementById('fileInput').addEventListener('change', handleFileUpload);

    function initApp() {
        loadStandardFeed();
        updateUI();
    }

    function updateMargin() {
      const value = document.getElementById('frameMargin').value;
      document.getElementById('frameMarginValue').textContent = value;
      document.getElementById('frameMarginInput').value = value;
      renderFeed();
      renderPreview();
    }

    function updateMarginFromInput() {
      const value = document.getElementById('frameMarginInput').value;
      document.getElementById('frameMarginValue').textContent = value;
      document.getElementById('frameMargin').value = value;
      renderFeed();
      renderPreview();
    }

    function setFormat(format) {
      currentFormat = format;
      document.querySelectorAll('.button-group button').forEach(btn => btn.classList.remove('active'));
      let clickedButton = event.target;
      while (clickedButton && clickedButton.tagName !== 'BUTTON') {
          clickedButton = clickedButton.parentNode;
      }
      if (clickedButton) {
          clickedButton.classList.add('active');
      }

      renderFeed();
      renderPreview();
    }

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (photos.length > 0) {
          renderFeed();
          renderPreview();
        }
      }, 250);
    });

    function handleFileUpload(e) {
      handleFiles(Array.from(e.target.files));
    }

    function handleFiles(files) {
      const loadPromises = files.filter(f => f.type.startsWith('image/')).map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const aspectRatio = img.width / img.height;
              resolve({
                id: Date.now() + Math.random(),
                src: e.target.result,
                name: file.name,
                width: img.width,
                height: img.height,
                aspectRatio: aspectRatio,
                isLandscape: aspectRatio > 1
              });
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(loadPromises).then(newPhotos => {
        newPhotos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        photos.push(...newPhotos);
        updateUI();
      });
    }

    function updatePanoramaMode() {
      const input = document.getElementById('panoramaImages').value;
      const originalPhotoCount = photos.filter(p => !p.isSplitLeft && !p.isSplitRight).length;

      const newPanoramaSet = new Set();

      if (input.trim()) {
        const numbers = input.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0 && n <= originalPhotoCount);
        numbers.forEach(n => newPanoramaSet.add(n));
      }

      const currentIndicesToSplit = [];
      const currentIndicesToUnsplit = [];

      let currentIndex = 0;
      let originalIndexCounter = 0;

      while (currentIndex < photos.length) {
          const photo = photos[currentIndex];
          const isCurrentlySplit = photo.isSplitLeft || photo.isSplitRight;

          if (!isCurrentlySplit) {
              originalIndexCounter++;
              if (newPanoramaSet.has(originalIndexCounter)) {
                  currentIndicesToSplit.push(currentIndex);
              }
              currentIndex++;
          } else if (photo.isSplitLeft) {
              originalIndexCounter++;
              if (!newPanoramaSet.has(originalIndexCounter)) {
                  currentIndicesToUnsplit.push(currentIndex);
              }
              currentIndex += 2;
          }
      }

      currentIndicesToUnsplit.sort((a, b) => b - a).forEach(index => {
          unsplitPhoto(index);
      });

      const currentPhotosAfterUnsplit = [...photos];

      const splitIndicesAfterUnsplit = [];
      let currentIdx = 0;
      let origIdxCounter = 0;

      while (currentIdx < currentPhotosAfterUnsplit.length) {
          const photo = currentPhotosAfterUnsplit[currentIdx];
          if (!photo.isSplitLeft && !photo.isSplitRight) {
              origIdxCounter++;
              if (newPanoramaSet.has(origIdxCounter) && !panoramaImages.has(origIdxCounter)) {
                   splitIndicesAfterUnsplit.push(currentIdx);
              }
              currentIdx++;
          } else {
              origIdxCounter++;
              currentIdx += 2;
          }
      }

      splitIndicesAfterUnsplit.sort((a, b) => b - a).forEach(index => {
          splitPhoto(index);
      });

      panoramaImages = newPanoramaSet;

      renderFeed();
      renderPreview();
    }

    function splitPhoto(index) {
        if (index < 0 || index >= photos.length || photos[index].isSplitLeft || photos[index].isSplitRight) return;

        const photo = photos[index];

        const leftHalf = {
            ...photo,
            id: Date.now() + Math.random(),
            name: photo.name + '_left',
            isSplitLeft: true,
            originalIndex: index,
            splitAspect: photo.aspectRatio / 2,
            splitRatio: `1:${Math.round(1 / (photo.aspectRatio / 2))}`
        };

        const rightHalf = {
            ...photo,
            id: Date.now() + Math.random() + 1,
            name: photo.name + '_right',
            isSplitRight: true,
            originalIndex: index,
            splitAspect: photo.aspectRatio / 2,
            splitRatio: `1:${Math.round(1 / (photo.aspectRatio / 2))}`
        };

        photos.splice(index, 1, leftHalf, rightHalf);
    }

    function unsplitPhoto(index) {
        if (index < 0 || index >= photos.length) return;

        const photo = photos[index];
        let leftIndex = -1, rightIndex = -1;

        if (photo.isSplitLeft && photos[index + 1] && photos[index + 1].isSplitRight) {
            leftIndex = index;
            rightIndex = index + 1;
        } else if (photo.isSplitRight && photos[index - 1] && photos[index - 1].isSplitLeft) {
            leftIndex = index - 1;
            rightIndex = index;
        } else {
            return;
        }

        const leftPhoto = photos[leftIndex];

        const originalPhoto = {
            id: Date.now() + Math.random(),
            src: leftPhoto.src,
            name: leftPhoto.name.replace('_left', ''),
            width: leftPhoto.width,
            height: leftPhoto.height,
            aspectRatio: leftPhoto.aspectRatio,
            isLandscape: leftPhoto.isLandscape
        };

        photos.splice(leftIndex, 2, originalPhoto);
    }

    function clearAll() {
      // Verktøyet lagrer ingenting, så et feiltrykk her kan ikke angres og
      // kan heller ikke hentes tilbake ved omlasting.
      if (!confirm('Fjerne alle ' + photos.length + ' bildene? Det kan ikke angres.')) return;

      photos = [];
      instagramFeed = [];
      document.getElementById('panoramaImages').value = '';
      panoramaImages = new Set();
      updateUI();
    }

    function loadStandardFeed() {
      instagramFeed = Array.from({length: 8}, (_, i) => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        const hue = (i * 45) % 360;
        ctx.fillStyle = `hsl(${hue}, 60%, 75%)`;
        ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = `hsl(${hue}, 60%, 65%)`;
        ctx.fillRect(150, 150, 100, 100);

        const imgUrl = canvas.toDataURL('image/png');

        return { id: i, imageUrl: imgUrl, format: 'square' };
      });

      document.getElementById('frameUsername').textContent = 'din_profil';
    }

    function loadInstagramFeed() {
      const username = document.getElementById('usernameInput').value.trim();
      if (!username) {
        alert('Vennligst skriv inn et brukernavn');
        return;
      }

      document.getElementById('frameUsername').textContent = username;

      const btn = document.getElementById('loadFeedBtn');
      const previewSection = document.getElementById('previewSection');
      const previewGrid = document.getElementById('previewGrid');

      btn.disabled = true;
      btn.textContent = 'Laster...';
      previewGrid.innerHTML = '<div class="loading">Laster inn Instagram-feed...</div>';
      previewSection.style.display = 'block';

      setTimeout(() => {
        loadStandardFeed();
        renderPreview();
        btn.disabled = false;
        btn.textContent = 'Last inn';
      }, 800);
    }

    function updateUI() {
      document.getElementById('photoCount').textContent = photos.length;
      document.getElementById('exportInstagramBtn').disabled = photos.length === 0;
      document.getElementById('clearBtn').style.display = photos.length > 0 ? 'block' : 'none';

      // Uten bilder skjules forhåndsvisningen. Før sto hovedflaten da helt
      // tom og grå, uten et ord om hva man skulle gjøre — nå bytter den
      // plass med en kort forklaring.
      const harBilder = photos.length > 0;
      document.getElementById('instagramPreview').classList.toggle('hidden', !harBilder);
      document.getElementById('instagramEmpty').classList.toggle('hidden', harBilder);

      renderFeed();
      renderPreview();
    }

    function getPostDimensions() {
      const baseSize = 1080;
      const format = FORMATS[currentFormat];

      let width, height;

      if (currentFormat === 'story') {
          width = 1080;
          height = 1920;
      } else if (format.width > format.height) {
        width = baseSize;
        height = Math.round(baseSize * format.height / format.width);
      } else if (format.width < format.height) {
        height = baseSize;
        width = Math.round(baseSize * format.width / format.height);
      } else {
        width = baseSize;
        height = baseSize;
      }

      return { width, height };
    }

    function getPhotoDisplayDimensions(photo) {
      const format = FORMATS[currentFormat];

      let displayWidth, displayHeight;

      const viewportWidth = window.innerWidth;
      const isMobile = viewportWidth <= 900;

      if (currentFormat === 'story') {
          displayWidth = isMobile ? Math.min(320, viewportWidth - 40) : 320;
          displayHeight = Math.round(displayWidth * 16 / 9);
      } else {
          if (isMobile) {
            displayWidth = Math.min(400, viewportWidth - 40);
          } else {
            displayWidth = 480;
          }
          displayHeight = Math.round(displayWidth * format.height / format.width);
      }

      return { width: displayWidth, height: displayHeight };
    }

    function renderFeed() {
      const imagesContainer = document.getElementById('imagesContainer');
      const frameContent = document.getElementById('frameContent');
      imagesContainer.innerHTML = '';

      if (photos.length === 0) return;

      const photosToRender = photos;

      const marginMm = parseFloat(document.getElementById('frameMargin').value);
      const marginPx = (marginMm / 25.4) * 96;

      const baseDims = getPhotoDisplayDimensions(photosToRender[0]);

      let maxDisplayWidth = baseDims.width;
      let maxDisplayHeight = baseDims.height;

      photosToRender.forEach(p => {
          const dims = getPhotoDisplayDimensions(p);
          if (dims.width > maxDisplayWidth) maxDisplayWidth = dims.width;
          if (dims.height > maxDisplayHeight) maxDisplayHeight = dims.height;
      });

      frameContent.style.width = maxDisplayWidth + 'px';
      frameContent.style.height = maxDisplayHeight + 'px';

      const frameWidth = maxDisplayWidth;
      const displayWidth = frameWidth;
      const displayHeight = maxDisplayHeight;

      const oldIndicator = frameContent.querySelector('.carousel-indicators');
      if (oldIndicator) oldIndicator.remove();

      const oldArrows = frameContent.querySelectorAll('[data-arrow]');
      oldArrows.forEach(arrow => arrow.remove());

      let currentImageIndex = 0;

      if (photosToRender.length > 1) {
        const indicator = document.createElement('div');
        indicator.className = 'carousel-indicators';
        indicator.textContent = `1/${photosToRender.length}`;
        frameContent.appendChild(indicator);

        let isDragging = false;
        let startDragX = 0;
        let startScrollLeft = 0;

        const dragStart = (e) => {
          isDragging = true;
          startDragX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
          startScrollLeft = currentImageIndex * displayWidth;
          frameContent.style.cursor = 'grabbing';
          imagesContainer.style.transition = 'none';
        };

        const dragMove = (e) => {
          if (!isDragging) return;
          e.preventDefault();
          const currentX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
          const diff = startDragX - currentX;
          const newTranslate = startScrollLeft + diff;
          imagesContainer.style.transform = `translateX(-${newTranslate}px)`;
        };

        const dragEnd = (e) => {
          if (!isDragging) return;
          isDragging = false;
          frameContent.style.cursor = 'grab';

          const currentX = e.type.includes('mouse') ? e.pageX : e.changedTouches[0].clientX;
          const diff = startDragX - currentX;

          if (Math.abs(diff) > 50) {
            if (diff > 0 && currentImageIndex < photosToRender.length - 1) {
              currentImageIndex++;
            } else if (diff < 0 && currentImageIndex > 0) {
              currentImageIndex--;
            }
          }

          imagesContainer.style.transition = 'transform 0.3s ease';
          imagesContainer.style.transform = `translateX(-${currentImageIndex * displayWidth}px)`;
          indicator.textContent = `${currentImageIndex + 1}/${photosToRender.length}`;
          updateArrows();
        };

        frameContent.addEventListener('mousedown', dragStart);
        frameContent.addEventListener('mousemove', dragMove);
        frameContent.addEventListener('mouseup', dragEnd);
        frameContent.addEventListener('mouseleave', dragEnd);

        frameContent.addEventListener('touchstart', dragStart);
        frameContent.addEventListener('touchmove', dragMove);
        frameContent.addEventListener('touchend', dragEnd);

        const leftArrow = document.createElement('div');
        leftArrow.setAttribute('data-arrow', 'left');
        leftArrow.style.cssText = 'position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; color: white; font-size: 20px; user-select: none;';
        leftArrow.innerHTML = '‹';

        const rightArrow = document.createElement('div');
        rightArrow.setAttribute('data-arrow', 'right');
        rightArrow.style.cssText = 'position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; color: white; font-size: 20px; user-select: none;';
        rightArrow.innerHTML = '›';

        const navigate = (direction) => {
          if (direction === 'left' && currentImageIndex > 0) {
            currentImageIndex--;
          } else if (direction === 'right' && currentImageIndex < photosToRender.length - 1) {
            currentImageIndex++;
          }
          imagesContainer.style.transition = 'transform 0.3s ease';
          imagesContainer.style.transform = `translateX(-${currentImageIndex * displayWidth}px)`;
          indicator.textContent = `${currentImageIndex + 1}/${photosToRender.length}`;
          updateArrows();
        };

        leftArrow.onclick = (e) => { e.stopPropagation(); navigate('left'); };
        rightArrow.onclick = (e) => { e.stopPropagation(); navigate('right'); };

        const updateArrows = () => {
          leftArrow.style.display = currentImageIndex > 0 ? 'flex' : 'none';
          rightArrow.style.display = currentImageIndex < photosToRender.length - 1 ? 'flex' : 'none';
        };

        frameContent.appendChild(leftArrow);
        frameContent.appendChild(rightArrow);
        updateArrows();
      }

      photosToRender.forEach((photo) => {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'post-image';

        imageDiv.style.width = displayWidth + 'px';
        imageDiv.style.height = displayHeight + 'px';

        let paddingLeft = marginPx;
        let paddingRight = marginPx;
        let paddingTop = marginPx;
        let paddingBottom = marginPx;

        if (photo.isSplitLeft) {
            paddingRight = 0;
        } else if (photo.isSplitRight) {
            paddingLeft = 0;
        }

        imageDiv.style.padding = `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`;

        const availableWidth = displayWidth - (paddingLeft + paddingRight);
        const availableHeight = displayHeight - (paddingTop + paddingBottom);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.onload = () => {
          canvas.width = availableWidth;
          canvas.height = availableHeight;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          if (photo.isSplitLeft || photo.isSplitRight) {
            const sourceX = photo.isSplitLeft ? 0 : img.width / 2;
            const sourceWidth = img.width / 2;
            const sourceHeight = img.height;

            const scale = Math.max(availableWidth / sourceWidth, availableHeight / sourceHeight);
            const scaledWidth = sourceWidth * scale;
            const scaledHeight = sourceHeight * scale;
            const offsetX = (availableWidth - scaledWidth) / 2;
            const offsetY = (availableHeight - scaledHeight) / 2;

            ctx.drawImage(img, sourceX, 0, sourceWidth, sourceHeight, offsetX, offsetY, scaledWidth, scaledHeight);
          } else if (photo.isLandscape && currentFormat !== 'story') {
            const scale = Math.min(availableWidth / img.width, availableHeight / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const offsetX = (availableWidth - scaledWidth) / 2;
            const offsetY = (availableHeight - scaledHeight) / 2;
            ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, scaledWidth, scaledHeight);
          } else {
            const scale = Math.max(availableWidth / img.width, availableHeight / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const offsetX = (availableWidth - scaledWidth) / 2;
            const offsetY = (availableHeight - scaledHeight) / 2;
            ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, scaledWidth, scaledHeight);
          }

          const displayImg = document.createElement('img');
          displayImg.src = canvas.toDataURL('image/jpeg', 0.95);
          displayImg.alt = photo.name;
          displayImg.style.width = '100%';
          displayImg.style.height = '100%';
          displayImg.style.objectFit = 'contain';
          imageDiv.appendChild(displayImg);
        };
        img.src = photo.src;

        imagesContainer.appendChild(imageDiv);
      });

      imagesContainer.style.transform = `translateX(0px)`;
    }

    function renderPreview() {
      const previewGrid = document.getElementById('previewGrid');
      previewGrid.innerHTML = '';

      const totalSlots = 9;

      const format = FORMATS[currentFormat];
      const formatW = format.width;
      const formatH = format.height;

      const marginMm = parseFloat(document.getElementById('frameMargin').value);
      const marginPxMain = (marginMm / 25.4) * 96;

      const mainImageDiv = document.querySelector('#imagesContainer .post-image');
      const mainW = mainImageDiv ? mainImageDiv.clientWidth : 600;
      const mainH = mainImageDiv ? mainImageDiv.clientHeight : 600;

      for (let i = 0; i < totalSlots; i++) {
        const cell = document.createElement('div');
        cell.className = 'preview-post';

        if (i === 0 && photos.length > 0) {
          cell.style.aspectRatio = `${formatW} / ${formatH}`;

          const wrapper = document.createElement('div');
          wrapper.style.width = '100%';
          wrapper.style.height = '100%';
          wrapper.style.boxSizing = 'border-box';

          requestAnimationFrame(() => {
            const cellWidth = cell.clientWidth;
            const marginPxCell = marginPxMain * (cellWidth / mainW);

            wrapper.style.padding = `${marginPxCell}px`;

            const img = document.createElement('img');
            img.src = photos[0].src;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            wrapper.appendChild(img);
            cell.appendChild(wrapper);
          });

          cell.classList.add('new-post');

        } else {
          cell.style.aspectRatio = '4 / 5';
          cell.classList.add('placeholder');
        }

        previewGrid.appendChild(cell);
      }
    }

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }

    async function createPostBlob(photo, width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      const baseDimsNoMargin = getPostDimensions();

      const img = await loadImage(photo.src);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      const targetAspect = baseDimsNoMargin.width / baseDimsNoMargin.height;

      let sourceX, sourceY, sourceWidth, sourceHeight;
      let drawW, drawH, drawX, drawY;

      const marginMm = parseFloat(document.getElementById('frameMargin').value);
      const marginPx = marginMm > 0 ? (marginMm / 25.4) * 1080 : 0;

      drawX = photo.isSplitRight ? 0 : marginPx;
      drawY = marginPx;
      drawW = baseDimsNoMargin.width;
      drawH = baseDimsNoMargin.height;

      if (photo.isSplitLeft || photo.isSplitRight) {
        sourceX = photo.isSplitLeft ? 0 : img.width / 2;
        sourceY = 0;
        sourceWidth = img.width / 2;
        sourceHeight = img.height;

        const sourceAspect = sourceWidth / sourceHeight;
        if (sourceAspect > targetAspect) {
          const cropWidth = sourceHeight * targetAspect;
          sourceX += (sourceWidth - cropWidth) / 2;
          sourceWidth = cropWidth;
        } else {
          const cropHeight = sourceWidth / targetAspect;
          sourceY = (sourceHeight - cropHeight) / 2;
          sourceHeight = cropHeight;
        }
      } else if (photo.isLandscape && currentFormat !== 'story') {
        sourceX = 0;
        sourceY = 0;
        sourceWidth = img.width;
        sourceHeight = img.height;

        const photoAspect = img.width / img.height;
        if (photoAspect > targetAspect) {
          drawW = baseDimsNoMargin.width;
          drawH = baseDimsNoMargin.width / photoAspect;
          drawY = marginPx + (baseDimsNoMargin.height - drawH) / 2;
        } else {
          drawH = baseDimsNoMargin.height;
          drawW = baseDimsNoMargin.height * photoAspect;
          drawX = marginPx + (baseDimsNoMargin.width - drawW) / 2;
        }
      } else {
        const photoAspect = img.width / img.height;

        if (photoAspect > targetAspect) {
          sourceHeight = img.height;
          sourceWidth = sourceHeight * targetAspect;
          sourceX = (img.width - sourceWidth) / 2;
          sourceY = 0;
        } else {
          sourceWidth = img.width;
          sourceHeight = sourceWidth / targetAspect;
          sourceX = 0;
          sourceY = (img.height - sourceHeight) / 2;
        }
      }

      ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawW, drawH);

      return new Promise((resolve) => {
        const quality = 1.0; // Maximum quality
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
      });
    }

    async function exportInstagramPosts() {
      if (photos.length === 0) return;

      const btn = document.getElementById('exportInstagramBtn');
      btn.disabled = true;
      btn.textContent = 'Eksporterer...';

      const zip = new JSZip();

      let totalFileCount = 0;

      try {
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];

          const baseDimsNoMargin = getPostDimensions();
          let exportWidth = baseDimsNoMargin.width;
          let exportHeight = baseDimsNoMargin.height;
          const marginMm = parseFloat(document.getElementById('frameMargin').value);

          if (marginMm > 0) {
              const marginPx = (marginMm / 25.4) * 1080;
              if (photo.isSplitLeft || photo.isSplitRight) {
                  exportWidth = baseDimsNoMargin.width + marginPx;
              } else {
                  exportWidth = baseDimsNoMargin.width + 2 * marginPx;
              }
              exportHeight = baseDimsNoMargin.height + 2 * marginPx;
          }

          const blob = await createPostBlob(photo, exportWidth, exportHeight);

          let filename;
          const fileIndex = String(i + 1).padStart(2, '0');

          filename = `instagram-${currentFormat}-${fileIndex}`;

          if (photo.isSplitLeft) {
              filename += `-left.jpg`;
          } else if (photo.isSplitRight) {
              filename += `-right.jpg`;
          } else {
              filename += `.jpg`;
          }

          zip.file(filename, blob);
          totalFileCount++;
          await new Promise(r => setTimeout(r, 100));
        }

        if (totalFileCount > 0) {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `instagram-export-${currentFormat}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }

      } catch (err) {
        alert('Feil ved eksport: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Eksporter Innlegg (ZIP)';
      }
    }

    document.addEventListener('DOMContentLoaded', initApp);
