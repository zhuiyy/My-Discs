document.addEventListener('DOMContentLoaded', () => {
    const cdGallery = document.getElementById('cd-gallery');
    const concertGallery = document.getElementById('concert-gallery');
    const cdFilters = document.getElementById('cd-filters');
    const modal = document.getElementById('modal');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const modalMeta = document.getElementById('modal-meta');
    const modalDescription = document.getElementById('modal-description');
    const closeButton = document.querySelector('.close-button');

    let lastFocusedBeforeModal = null;
    let activeGenre = 'all';
    let cdItems = [];

    function encodeMusicSrc(path) {
        return encodeURI(path);
    }

    function renderMarkdownToSafeHtml(markdown) {
        const raw = marked.parse(markdown);
        return typeof DOMPurify !== 'undefined'
            ? DOMPurify.sanitize(raw)
            : raw;
    }

    function compactList(values, limit = 2) {
        if (!Array.isArray(values)) {
            return values ? [String(values)] : [];
        }
        return values.filter(Boolean).map(String).slice(0, limit);
    }

    function genreTokens(item) {
        return (item.genres || [])
            .flatMap((genre) => String(genre).split(/[(),/]+/))
            .map((genre) => genre.trim())
            .filter(Boolean);
    }

    function titleCase(value) {
        return value
            .split(/\s+/)
            .map((word) => word ? word[0].toUpperCase() + word.slice(1) : word)
            .join(' ');
    }

    function formatDate(date) {
        if (!date) {
            return '';
        }
        const parts = String(date).split('-');
        if (parts.length !== 3) {
            return date;
        }
        return `${parts[1]}.${parts[2]}.${parts[0]}`;
    }

    function getCardMeta(item) {
        if (item.type === 'concert') {
            return {
                eyebrow: formatDate(item.date || item.subtitle),
                detail: [item.venue, item.hall].filter(Boolean).join(' · '),
                tags: compactList(item.performers, 2)
            };
        }
        const performers = compactList(item.artists && item.artists.length ? item.artists : item.vocalists, 2);
        return {
            eyebrow: genreTokens(item).slice(0, 2).map(titleCase).join(' · '),
            detail: performers.join(' · ') || item.source || '',
            tags: compactList(item.composers, 2)
        };
    }

    function createMetaPill(text) {
        const pill = document.createElement('span');
        pill.className = 'meta-pill';
        pill.textContent = text;
        return pill;
    }

    // Shuffle function (Fisher-Yates)
    function shuffle(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex != 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    // Create Gallery Item Element
    function createGalleryItem(item, index) {
        const el = document.createElement('div');
        el.className = `gallery-item ${item.type}-item`;
        el.style.animationDelay = `${index * 0.05}s`; // Staggered animation
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', item.title);
        if (item.date) {
            el.dataset.date = formatDate(item.date);
        }

        const media = document.createElement('div');
        media.className = 'item-media';

        const img = document.createElement('img');
        img.src = item.image;
        img.alt = item.title;
        img.loading = 'lazy';

        media.appendChild(img);
        el.appendChild(media);

        const meta = getCardMeta(item);
        const info = document.createElement('div');
        info.className = 'item-info';

        const eyebrow = document.createElement('div');
        eyebrow.className = 'item-eyebrow';
        eyebrow.textContent = meta.eyebrow || (item.type === 'cd' ? 'Album' : 'Concert');

        const title = document.createElement('h3');
        title.className = 'item-title';
        title.textContent = item.title;

        const detail = document.createElement('p');
        detail.className = 'item-detail';
        detail.textContent = meta.detail || item.source || '';

        const tags = document.createElement('div');
        tags.className = 'item-tags';
        meta.tags.forEach((tag) => tags.appendChild(createMetaPill(tag)));

        info.appendChild(eyebrow);
        info.appendChild(title);
        if (detail.textContent) {
            info.appendChild(detail);
        }
        if (meta.tags.length) {
            info.appendChild(tags);
        }
        el.appendChild(info);

        const activate = () => openModal(item);
        el.addEventListener('click', activate);
        el.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate();
            }
        });
        return el;
    }

    function renderFilters(cds) {
        if (!cdFilters) {
            return;
        }
        cdFilters.innerHTML = '';
        const genres = Array.from(new Set(cds.flatMap(genreTokens).map(titleCase))).sort((a, b) => a.localeCompare(b));
        const labels = ['All', ...genres];

        labels.forEach((label) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'filter-chip';
            button.textContent = label;
            button.setAttribute('aria-pressed', label.toLowerCase() === activeGenre);
            button.addEventListener('click', () => {
                activeGenre = label.toLowerCase();
                updateCdFilter();
            });
            cdFilters.appendChild(button);
        });
    }

    function updateCdFilter() {
        cdItems.forEach(({ element, item }) => {
            const matches = activeGenre === 'all' || genreTokens(item).map((genre) => titleCase(genre).toLowerCase()).includes(activeGenre);
            element.hidden = !matches;
        });
        cdFilters.querySelectorAll('.filter-chip').forEach((button) => {
            button.setAttribute('aria-pressed', button.textContent.toLowerCase() === activeGenre);
        });
    }

    // Render Galleries
    function renderGalleries() {
        if (typeof siteData === 'undefined') {
            console.error('Data not loaded');
            return;
        }

        // Separate data
        const cds = siteData.filter(item => item.type === 'cd');
        const concerts = siteData.filter(item => item.type === 'concert');

        // Shuffle CDs only
        const shuffledCDs = shuffle([...cds]);
        // Concerts are already sorted by date in data.js
        const sortedConcerts = [...concerts];

        renderFilters(cds);

        // Render CDs
        shuffledCDs.forEach((item, index) => {
            const element = createGalleryItem(item, index);
            cdGallery.appendChild(element);
            cdItems.push({ item, element });
        });
        updateCdFilter();

        // Render Concerts
        sortedConcerts.forEach((item, index) => {
            concertGallery.appendChild(createGalleryItem(item, index));
        });
    }

    // Modal Logic
    function isModalOpen() {
        return !modal.hasAttribute('hidden');
    }

    function openModal(item) {
        lastFocusedBeforeModal = document.activeElement;
        modal.removeAttribute('hidden');
        modal.setAttribute('aria-hidden', 'false');

        modalImage.src = item.image;
        modalImage.alt = item.title;
        modalTitle.textContent = item.title;
        modalMeta.innerHTML = '';

        const metaItems = item.type === 'concert'
            ? [
                item.date && formatDate(item.date),
                [item.venue, item.hall].filter(Boolean).join(' · '),
                ...(item.performers || []).slice(0, 3)
            ]
            : [
                ...genreTokens(item).slice(0, 3).map(titleCase),
                item.source,
                ...((item.artists && item.artists.length ? item.artists : item.vocalists) || []).slice(0, 2)
            ];

        metaItems.filter(Boolean).forEach((text) => {
            modalMeta.appendChild(createMetaPill(text));
        });

        if (item.description) {
            modalDescription.innerHTML = renderMarkdownToSafeHtml(item.description);
        } else {
            modalDescription.innerHTML = '<p>No description available.</p>';
        }

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        closeButton.focus();
    }

    function closeModal() {
        modal.style.display = 'none';
        modal.setAttribute('hidden', '');
        document.body.style.overflow = 'auto';
        modalImage.src = '';
        modalImage.alt = '';
        modal.setAttribute('aria-hidden', 'true');
        modalMeta.innerHTML = '';
        modalDescription.innerHTML = '';
        if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
            lastFocusedBeforeModal.focus();
        }
        lastFocusedBeforeModal = null;
    }

    closeButton.addEventListener('click', closeModal);

    modal.addEventListener('keydown', (event) => {
        if (event.key !== 'Tab' || !isModalOpen()) {
            return;
        }
        const focusableSelector =
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusables = Array.from(modal.querySelectorAll(focusableSelector)).filter(
            (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === closeButton
        );
        if (focusables.length === 0) {
            return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isModalOpen()) {
            closeModal();
        }
    });

    // Initialize
    renderGalleries();
    initMusicPlayer();

    // Music Player Logic
    function initMusicPlayer() {
        if (typeof musicData === 'undefined' || musicData.length === 0) {
            console.log('No music data found');
            document.getElementById('music-player-container').style.display = 'none';
            return;
        }

        const audioPlayer = document.getElementById('audio-player');
        const playPauseBtn = document.getElementById('play-pause-btn');
        const musicTitle = document.getElementById('music-title');
        const gramophone = document.querySelector('.flat-gramophone'); // Updated selector

        // Pick random track
        const randomTrack = musicData[Math.floor(Math.random() * musicData.length)];

        // Setup Audio
        // Encode the path to handle spaces and special characters
        audioPlayer.src = encodeMusicSrc(randomTrack.path);
        audioPlayer.preload = 'auto';
        musicTitle.textContent = randomTrack.title;
        musicTitle.title = randomTrack.title;

        // Error handling
        audioPlayer.addEventListener('error', (e) => {
            console.error("Audio error:", audioPlayer.error);
            musicTitle.textContent = "Error loading track";
        });

        // Play/Pause Toggle
        const togglePlay = (e) => {
            // We only use click event now to avoid conflicts
            // Touch devices will fire click after a short delay, which is fine

            if (audioPlayer.paused) {
                const playPromise = audioPlayer.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        playPauseBtn.textContent = '⏸';
                        gramophone.classList.add('playing');
                        document.body.classList.add('music-playing');
                    }).catch(error => {
                        console.error("Playback failed:", error);
                        // If autoplay was prevented, we might need user interaction again
                        // But this IS a user interaction handler, so it should work.
                    });
                }
            } else {
                audioPlayer.pause();
                playPauseBtn.textContent = '▶';
                gramophone.classList.remove('playing');
                document.body.classList.remove('music-playing');
            }
        };

        playPauseBtn.addEventListener('click', togglePlay);
        // Removed touchstart to prevent double-firing or prevention issues

        // Auto-play next (random) when ended
        audioPlayer.addEventListener('ended', () => {
            const nextTrack = musicData[Math.floor(Math.random() * musicData.length)];
            audioPlayer.src = encodeMusicSrc(nextTrack.path);
            musicTitle.textContent = nextTrack.title;
            musicTitle.title = nextTrack.title;
            audioPlayer.play().then(() => {
                playPauseBtn.textContent = '⏸';
                gramophone.classList.add('playing');
            });
        });
    }
});
