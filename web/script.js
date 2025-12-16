document.addEventListener('DOMContentLoaded', () => {
    const cdGallery = document.getElementById('cd-gallery');
    const concertGallery = document.getElementById('concert-gallery');
    const modal = document.getElementById('modal');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const modalDescription = document.getElementById('modal-description');
    const closeButton = document.querySelector('.close-button');

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

        const img = document.createElement('img');
        img.src = item.image;
        img.alt = item.title;
        img.loading = 'lazy';

        el.appendChild(img);
        el.addEventListener('click', () => openModal(item));
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
    function openModal(item) {
        modalImage.src = item.image;
        modalTitle.textContent = item.title;
        
        if (item.description) {
            modalDescription.innerHTML = marked.parse(item.description);
        } else {
            modalDescription.innerHTML = '<p>No description available.</p>';
        }

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        modalImage.src = '';
    }

    closeButton.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
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
        const gramophone = document.querySelector('.gramophone');

        // Pick random track
        const randomTrack = musicData[Math.floor(Math.random() * musicData.length)];
        
        // Setup Audio
        audioPlayer.src = randomTrack.path;
        audioPlayer.preload = 'auto'; // Help with iOS playback
        musicTitle.textContent = randomTrack.title;
        musicTitle.title = randomTrack.title; // Tooltip for long titles

        // Play/Pause Toggle
        const togglePlay = (e) => {
            // Prevent double firing if both touch and click are handled
            if (e.type === 'touchstart') {
                e.preventDefault(); // Prevent mouse emulation
            }

            if (audioPlayer.paused) {
                const playPromise = audioPlayer.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        playPauseBtn.textContent = '⏸';
                        gramophone.classList.add('playing');
                        document.body.classList.add('music-playing'); // Add ripple effect
                    }).catch(error => {
                        console.error("Playback failed:", error);
                        // UI feedback for failure?
                    });
                }
            } else {
                audioPlayer.pause();
                playPauseBtn.textContent = '▶';
                gramophone.classList.remove('playing');
                document.body.classList.remove('music-playing'); // Remove ripple effect
            }
        };

        playPauseBtn.addEventListener('click', togglePlay);
        playPauseBtn.addEventListener('touchstart', togglePlay, { passive: false });

        // Auto-play next (random) when ended
        audioPlayer.addEventListener('ended', () => {
            const nextTrack = musicData[Math.floor(Math.random() * musicData.length)];
            audioPlayer.src = nextTrack.path;
            musicTitle.textContent = nextTrack.title;
            musicTitle.title = nextTrack.title;
            audioPlayer.play().then(() => {
                playPauseBtn.textContent = '⏸';
                gramophone.classList.add('playing');
            });
        });
    }
});
