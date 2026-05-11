document.addEventListener('DOMContentLoaded', () => {
    const cdGallery = document.getElementById('cd-gallery');
    const concertGallery = document.getElementById('concert-gallery');
    const modal = document.getElementById('modal');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const modalDescription = document.getElementById('modal-description');
    const closeButton = document.querySelector('.close-button');

    let lastFocusedBeforeModal = null;

    function encodeMusicSrc(path) {
        return encodeURI(path);
    }

    function renderMarkdownToSafeHtml(markdown) {
        const raw = marked.parse(markdown);
        return typeof DOMPurify !== 'undefined'
            ? DOMPurify.sanitize(raw)
            : raw;
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
        el.className = 'gallery-item';
        el.style.animationDelay = `${index * 0.05}s`; // Staggered animation
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', item.title);

        const img = document.createElement('img');
        img.src = item.image;
        img.alt = item.title;
        img.loading = 'lazy';

        el.appendChild(img);
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

        // Render CDs
        shuffledCDs.forEach((item, index) => {
            cdGallery.appendChild(createGalleryItem(item, index));
        });

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
