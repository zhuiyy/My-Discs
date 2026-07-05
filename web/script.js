document.addEventListener('DOMContentLoaded', () => {
    const cdGallery = document.getElementById('cd-gallery');
    const vinylGallery = document.getElementById('vinyl-gallery');
    const concertGallery = document.getElementById('concert-gallery');
    const cdFilters = document.getElementById('cd-filters');
    const vinylFilters = document.getElementById('vinyl-filters');
    const modal = document.getElementById('modal');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const modalMeta = document.getElementById('modal-meta');
    const modalDescription = document.getElementById('modal-description');
    const closeButton = document.querySelector('.close-button');

    let lastFocusedBeforeModal = null;
    const collectionState = {
        cd: { activeGenre: 'all', filters: cdFilters, items: [] },
        vinyl: { activeGenre: 'all', filters: vinylFilters, items: [] }
    };

    function renderMarkdownToSafeHtml(markdown) {
        const raw = marked.parse(markdown);
        return typeof DOMPurify !== 'undefined'
            ? DOMPurify.sanitize(raw)
            : raw;
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
                eyebrow: formatDate(item.date),
                detail: [item.venue, item.hall].filter(Boolean).join(' · ')
            };
        }
        return {
            eyebrow: genreTokens(item).slice(0, 2).map(titleCase).join(' · '),
            detail: ''
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
        el.className = `gallery-item ${item.type}-item is-entering`;
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
        eyebrow.textContent = meta.eyebrow || (item.type === 'concert' ? 'Concert' : item.type === 'vinyl' ? 'Vinyl' : 'Album');

        const title = document.createElement('h3');
        title.className = 'item-title';
        title.textContent = item.title;

        const detail = document.createElement('p');
        detail.className = 'item-detail';
        detail.textContent = meta.detail || '';

        info.appendChild(eyebrow);
        info.appendChild(title);
        if (detail.textContent) {
            info.appendChild(detail);
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

    function renderFilters(collectionType, items) {
        const state = collectionState[collectionType];
        if (!state || !state.filters) {
            return;
        }
        state.filters.innerHTML = '';
        const genres = Array.from(new Set(items.flatMap(genreTokens).map(titleCase))).sort((a, b) => a.localeCompare(b));

        function addGroup(title, labels, activeValue, onSelect) {
            const group = document.createElement('div');
            group.className = 'filter-group';

            const groupLabel = document.createElement('span');
            groupLabel.className = 'filter-label';
            groupLabel.textContent = title;
            group.appendChild(groupLabel);

            labels.forEach((label) => {
                const value = label === '全部' ? 'all' : label.toLowerCase();
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'filter-chip';
                button.textContent = label;
                button.dataset.value = value;
                button.setAttribute('aria-pressed', value === activeValue);
                button.addEventListener('click', () => {
                    onSelect(value);
                    updateCollectionFilter(collectionType);
                });
                group.appendChild(button);
            });

            state.filters.appendChild(group);
        }

        addGroup('类型', ['全部', ...genres], state.activeGenre, (value) => {
            state.activeGenre = value;
        });
    }

    function updateFilterButtonStates(state) {
        if (!state || !state.filters) {
            return;
        }
        state.filters.querySelectorAll('.filter-group').forEach((group) => {
            group.querySelectorAll('.filter-chip').forEach((button) => {
                button.setAttribute('aria-pressed', button.dataset.value === state.activeGenre);
            });
        });
    }

    function restartEnterAnimation(element, index) {
        element.classList.remove('is-entering');
        element.style.animationDelay = `${index * 0.05}s`;
        void element.offsetWidth;
        element.classList.add('is-entering');
    }

    function updateCollectionFilter(collectionType) {
        const state = collectionState[collectionType];
        if (!state) {
            return;
        }
        let visibleIndex = 0;
        state.items.forEach(({ element, item }) => {
            const genres = genreTokens(item).map((genre) => titleCase(genre).toLowerCase());
            const matchesGenre = state.activeGenre === 'all' || genres.includes(state.activeGenre);
            if (matchesGenre) {
                element.hidden = false;
                restartEnterAnimation(element, visibleIndex);
                visibleIndex += 1;
            } else {
                element.hidden = true;
                element.classList.remove('is-entering');
            }
        });
        updateFilterButtonStates(state);
    }

    function renderCollection(collectionType, items, gallery) {
        const state = collectionState[collectionType];
        if (!gallery || !state) {
            return;
        }
        state.items = [];
        gallery.innerHTML = '';
        renderFilters(collectionType, items);
        shuffle([...items]).forEach((item, index) => {
            const element = createGalleryItem(item, index);
            gallery.appendChild(element);
            state.items.push({ item, element });
        });
        updateCollectionFilter(collectionType);
    }

    // Render Galleries
    function renderGalleries() {
        if (typeof siteData === 'undefined') {
            console.error('Data not loaded');
            return;
        }

        // Separate data
        const cds = siteData.filter(item => item.type === 'cd');
        const vinyls = siteData.filter(item => item.type === 'vinyl');
        const concerts = siteData.filter(item => item.type === 'concert');

        // Concerts are already sorted by date in data.js
        const sortedConcerts = [...concerts];

        renderCollection('cd', cds, cdGallery);
        renderCollection('vinyl', vinyls, vinylGallery);

        // Render Concerts
        sortedConcerts.forEach((item, index) => {
            const element = createGalleryItem(item, index);
            element.style.gridRow = String(index + 1);
            concertGallery.appendChild(element);
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

        const metaItems = item.type === 'cd' || item.type === 'vinyl'
            ? genreTokens(item).slice(0, 3).map(titleCase)
            : [];

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
});
