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
});
