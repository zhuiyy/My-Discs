document.addEventListener('DOMContentLoaded', () => {
    const collectionGallery = document.getElementById('collection-gallery');
    const concertGallery = document.getElementById('concert-gallery');
    const typeFilters = document.getElementById('type-filters');
    const genreFilter = document.getElementById('genre-filter');
    const searchInput = document.getElementById('collection-search');
    const clearSearch = document.getElementById('clear-search');
    const resultSummary = document.getElementById('result-summary');
    const emptyState = document.getElementById('empty-state');
    const archiveStats = document.getElementById('archive-stats');
    const concertCount = document.getElementById('concert-count');
    const modal = document.getElementById('modal');
    const modalBackdrop = modal.querySelector('.modal-backdrop');
    const modalContent = modal.querySelector('.modal-content');
    const modalToolbar = modal.querySelector('.modal-toolbar');
    const modalInfo = modal.querySelector('.modal-info');
    const modalMedia = document.getElementById('modal-media');
    const modalCaseSpine = document.getElementById('modal-case-spine');
    const modalArtwork = document.getElementById('modal-artwork');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const modalMeta = document.getElementById('modal-meta');
    const modalDescription = document.getElementById('modal-description');
    const modalCounter = document.getElementById('modal-counter');
    const closeButton = modal.querySelector('.close-button');
    const modalPrev = document.getElementById('modal-prev');
    const modalNext = document.getElementById('modal-next');

    const hasGSAP = typeof gsap !== 'undefined';
    const hasFlip = hasGSAP && typeof Flip !== 'undefined';
    const hasScrollTrigger = hasGSAP && typeof ScrollTrigger !== 'undefined';
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (hasGSAP) {
        const plugins = [];
        if (hasFlip) {
            plugins.push(Flip);
        }
        if (hasScrollTrigger) {
            plugins.push(ScrollTrigger);
        }
        if (plugins.length) {
            gsap.registerPlugin(...plugins);
        }
        gsap.config({ autoSleep: 90, force3D: 'auto', nullTargetWarn: false });
        gsap.defaults({ duration: 0.5, ease: 'power3.out' });
        if (hasScrollTrigger) {
            ScrollTrigger.config({
                limitCallbacks: true,
                ignoreMobileResize: true
            });
        }
    }

    let collectionRecords = [];
    let concertRecords = [];
    let visibleCollectionRecords = [];
    let activeModalList = [];
    let activeModalIndex = -1;
    let lastFocusedBeforeModal = null;
    let activeSourceElement = null;
    let modalIsAnimating = false;
    let refreshTimer = null;
    let searchTimer = null;
    let searchIsComposing = false;
    let activeFilterAnimation = null;
    let modalCleanupTimer = null;
    let borrowedImage = null;
    let borrowedImageHome = null;

    const searchDebounceMs = 220;

    const collectionState = {
        type: 'all',
        genre: 'all',
        query: ''
    };

    function prefersReducedMotion() {
        return reduceMotionQuery.matches;
    }

    function renderMarkdownToSafeHtml(markdown) {
        if (!markdown) {
            return '<p>No description available.</p>';
        }
        if (typeof marked === 'undefined') {
            const paragraph = document.createElement('p');
            paragraph.textContent = markdown;
            return paragraph.outerHTML;
        }
        const raw = marked.parse(markdown);
        return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : raw;
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

    function splitDate(date) {
        const parts = String(date || '').split('-');
        if (parts.length !== 3) {
            return { year: '', day: date || '' };
        }
        return {
            year: parts[0],
            day: `${parts[1]}.${parts[2]}`
        };
    }

    function mediaLabel(type) {
        if (type === 'vinyl') {
            return 'Vinyl';
        }
        if (type === 'concert') {
            return 'Concert';
        }
        return 'CD';
    }

    function searchText(item) {
        return [
            item.title,
            item.source,
            item.venue,
            item.hall,
            ...(item.tracks || []),
            ...(item.artists || []),
            ...(item.composers || []),
            ...(item.performers || []),
            ...genreTokens(item)
        ].filter(Boolean).join(' ').toLowerCase();
    }

    function shuffle(array) {
        let currentIndex = array.length;
        while (currentIndex !== 0) {
            const randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    function addKeyboardActivation(element, callback) {
        element.addEventListener('click', callback);
        element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                callback();
            }
        });
    }

    function createMetaPill(text) {
        const pill = document.createElement('span');
        pill.className = 'meta-pill';
        pill.textContent = text;
        return pill;
    }

    function createCollectionCard(item, index) {
        const card = document.createElement('article');
        card.className = `collection-card ${item.type}-item`;
        card.dataset.uid = item.uid;
        card.dataset.type = item.type;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', item.title);

        const cover = document.createElement('div');
        cover.className = 'cover-frame';

        if (item.type === 'cd') {
            cover.classList.add('cd-case');
            const spine = document.createElement('span');
            spine.className = 'case-spine';
            spine.setAttribute('aria-hidden', 'true');
            cover.appendChild(spine);
        }

        const artwork = document.createElement('div');
        artwork.className = 'cover-artwork';

        const image = document.createElement('img');
        image.src = item.image;
        image.alt = item.title;
        image.loading = index < 10 ? 'eager' : 'lazy';
        image.decoding = 'async';
        artwork.appendChild(image);
        cover.appendChild(artwork);

        const info = document.createElement('div');
        info.className = 'item-info';

        const titleRow = document.createElement('div');
        titleRow.className = 'item-title-row';

        const title = document.createElement('h3');
        title.className = 'item-title';
        title.textContent = item.title;

        const format = document.createElement('span');
        format.className = 'format-mark';
        format.textContent = mediaLabel(item.type);

        const detail = document.createElement('p');
        detail.className = 'item-detail';
        detail.textContent = genreTokens(item).slice(0, 2).map(titleCase).join(' / ') || 'Unclassified';

        titleRow.append(title, format);
        info.append(titleRow, detail);
        card.append(cover, info);

        addKeyboardActivation(card, () => openModal(item, card));
        return card;
    }

    function createConcertCard(item, index) {
        const card = document.createElement('article');
        card.className = 'concert-entry';
        card.dataset.uid = item.uid;
        card.dataset.type = item.type;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', item.title);

        const date = splitDate(item.date);
        const dateBlock = document.createElement('time');
        dateBlock.className = 'concert-date';
        dateBlock.dateTime = item.date || '';
        dateBlock.innerHTML = `<span>${date.year}</span><strong>${date.day}</strong>`;

        const poster = document.createElement('div');
        poster.className = 'concert-poster';
        const image = document.createElement('img');
        image.src = item.image;
        image.alt = item.title;
        image.loading = index < 3 ? 'eager' : 'lazy';
        image.decoding = 'async';
        poster.appendChild(image);

        const copy = document.createElement('div');
        copy.className = 'concert-copy';
        const number = document.createElement('p');
        number.className = 'concert-number';
        number.textContent = String(index + 1).padStart(2, '0');
        const title = document.createElement('h3');
        title.textContent = item.title;
        const venue = document.createElement('p');
        venue.className = 'concert-venue';
        venue.textContent = [item.venue, item.hall].filter(Boolean).join(' / ');
        const action = document.createElement('span');
        action.className = 'concert-action';
        action.innerHTML = 'Programme <span aria-hidden="true">&rarr;</span>';
        copy.append(number, title, venue, action);

        card.append(dateBlock, poster, copy);
        addKeyboardActivation(card, () => openModal(item, card));
        return card;
    }

    function updateArchiveStats(items) {
        const counts = {
            cd: items.filter((item) => item.type === 'cd').length,
            vinyl: items.filter((item) => item.type === 'vinyl').length,
            concert: items.filter((item) => item.type === 'concert').length
        };
        archiveStats.innerHTML = '';
        [
            ['CD', counts.cd],
            ['Vinyl', counts.vinyl],
            ['Live', counts.concert]
        ].forEach(([label, value]) => {
            const stat = document.createElement('p');
            stat.className = 'archive-stat';
            stat.innerHTML = `<span>${label}</span><strong>${String(value).padStart(2, '0')}</strong>`;
            archiveStats.appendChild(stat);
        });
    }

    function renderTypeFilters() {
        const counts = {
            all: collectionRecords.length,
            cd: collectionRecords.filter((item) => item.type === 'cd').length,
            vinyl: collectionRecords.filter((item) => item.type === 'vinyl').length
        };
        typeFilters.innerHTML = '';
        [
            ['all', 'All'],
            ['cd', 'CD'],
            ['vinyl', 'Vinyl']
        ].forEach(([value, label]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'segment';
            button.dataset.value = value;
            button.setAttribute('aria-pressed', value === collectionState.type);
            button.innerHTML = `<span>${label}</span><strong>${counts[value]}</strong>`;
            button.addEventListener('click', () => {
                collectionState.type = value;
                applyCollectionFilters();
            });
            typeFilters.appendChild(button);
        });
    }

    function renderGenreFilters() {
        const genres = Array.from(
            new Set(collectionRecords.flatMap(genreTokens).map(titleCase))
        ).sort((a, b) => a.localeCompare(b));

        genreFilter.innerHTML = '';
        ['All', ...genres].forEach((label) => {
            const value = label === 'All' ? 'all' : label.toLowerCase();
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            genreFilter.appendChild(option);
        });
        genreFilter.value = collectionState.genre;
    }

    function updateControlStates() {
        typeFilters.querySelectorAll('.segment').forEach((button) => {
            button.setAttribute('aria-pressed', button.dataset.value === collectionState.type);
        });
        genreFilter.value = collectionState.genre;
    }

    function collectionMatches(item) {
        const typeMatches = collectionState.type === 'all' || item.type === collectionState.type;
        const genres = genreTokens(item).map((genre) => titleCase(genre).toLowerCase());
        const genreMatches = collectionState.genre === 'all' || genres.includes(collectionState.genre);
        const queryMatches = !collectionState.query || item.searchText.includes(collectionState.query);
        return typeMatches && genreMatches && queryMatches;
    }

    function applyCollectionFilters(animate = true) {
        const allCardElements = collectionRecords.map((item) => item.element);
        if (hasGSAP) {
            if (activeFilterAnimation) {
                activeFilterAnimation.kill();
                activeFilterAnimation = null;
            }
            gsap.killTweensOf(allCardElements);
        }
        const flipState = hasFlip && animate && !prefersReducedMotion()
            ? Flip.getState(allCardElements)
            : null;

        visibleCollectionRecords = collectionRecords.filter(collectionMatches);
        const visibleIds = new Set(visibleCollectionRecords.map((item) => item.uid));

        collectionRecords.forEach((item) => {
            const isVisible = visibleIds.has(item.uid);
            item.element.classList.toggle('is-filtered-out', !isVisible);
            item.element.setAttribute('aria-hidden', String(!isVisible));
            item.element.tabIndex = isVisible ? 0 : -1;
        });

        visibleCollectionRecords.forEach((item) => {
            collectionGallery.appendChild(item.element);
        });

        updateControlStates();
        clearSearch.hidden = !collectionState.query;
        emptyState.hidden = visibleCollectionRecords.length !== 0;
        resultSummary.textContent = `${String(visibleCollectionRecords.length).padStart(2, '0')} / ${String(collectionRecords.length).padStart(2, '0')} objects`;

        if (flipState) {
            activeFilterAnimation = Flip.from(flipState, {
                absoluteOnLeave: true,
                simple: true,
                scale: false,
                duration: 0.54,
                ease: 'power2.inOut',
                stagger: 0.004,
                onEnter: (elements) => {
                    gsap.fromTo(elements, {
                        autoAlpha: 0,
                        y: 12
                    }, {
                        autoAlpha: 1,
                        y: 0,
                        duration: 0.32,
                        stagger: 0.012,
                        clearProps: 'opacity,visibility,transform'
                    });
                },
                onLeave: (elements) => {
                    gsap.to(elements, {
                        autoAlpha: 0,
                        duration: 0.18,
                        stagger: 0.01
                    });
                },
                onComplete: () => {
                    activeFilterAnimation = null;
                    refreshScrollTriggers();
                },
                onInterrupt: () => {
                    activeFilterAnimation = null;
                }
            });
        } else if (hasGSAP) {
            gsap.set(visibleCollectionRecords.map((item) => item.element), {
                clearProps: 'opacity,visibility,transform'
            });
            refreshScrollTriggers();
        } else {
            refreshScrollTriggers();
        }
    }

    function commitSearch(animate = true) {
        window.clearTimeout(searchTimer);
        searchTimer = null;

        const nextQuery = searchInput.value.trim().toLowerCase();
        clearSearch.hidden = !nextQuery;
        if (nextQuery === collectionState.query) {
            return;
        }

        collectionState.query = nextQuery;
        applyCollectionFilters(animate);
    }

    function scheduleSearch() {
        window.clearTimeout(searchTimer);
        clearSearch.hidden = !searchInput.value.trim();
        searchTimer = window.setTimeout(() => commitSearch(), searchDebounceMs);
    }

    function renderCollection() {
        collectionGallery.innerHTML = '';
        collectionRecords.forEach((item, index) => {
            item.element = createCollectionCard(item, index);
            collectionGallery.appendChild(item.element);
        });
        renderTypeFilters();
        renderGenreFilters();
        applyCollectionFilters(false);
    }

    function renderConcerts() {
        const track = concertGallery.querySelector('.timeline-track');
        concertGallery.innerHTML = '';
        if (track) {
            concertGallery.appendChild(track);
        }
        concertRecords.forEach((item, index) => {
            item.element = createConcertCard(item, index);
            concertGallery.appendChild(item.element);
        });
        concertCount.textContent = `${String(concertRecords.length).padStart(2, '0')} performances`;
    }

    function animateIntro() {
        if (!hasGSAP || prefersReducedMotion()) {
            return;
        }

        const firstCards = visibleCollectionRecords.slice(0, 10).map((item) => item.element);
        const timeline = gsap.timeline({
            defaults: { duration: 0.65, ease: 'power3.out' }
        });

        timeline
            .from('.site-label, h1', { autoAlpha: 0, y: 18, stagger: 0.08 })
            .from('.archive-stat', { autoAlpha: 0, y: 14, stagger: 0.055 }, '<0.16')
            .from('.collection-heading > *', { autoAlpha: 0, y: 16, stagger: 0.06 }, '-=0.35')
            .from('.collection-toolbar', { autoAlpha: 0, y: 12 }, '-=0.38')
            .from(firstCards, {
                autoAlpha: 0,
                y: 26,
                stagger: { amount: 0.4, from: 'start' },
                clearProps: 'opacity,visibility,transform'
            }, '-=0.42');
    }

    function initScrollAnimations() {
        if (!hasGSAP || !hasScrollTrigger || prefersReducedMotion()) {
            return;
        }

        concertRecords.forEach((item, index) => {
            const entry = item.element;
            const date = entry.querySelector('.concert-date');
            const poster = entry.querySelector('.concert-poster');
            const copy = entry.querySelector('.concert-copy');
            const timeline = gsap.timeline({
                scrollTrigger: {
                    trigger: entry,
                    start: 'top 82%',
                    once: true
                },
                defaults: { duration: 0.72, ease: 'power3.out' }
            });
            timeline
                .from(date, { autoAlpha: 0, x: -18 })
                .from(poster, { autoAlpha: 0, y: 34 }, '<0.04')
                .from(copy, { autoAlpha: 0, x: 24 }, '<0.08');

            ScrollTrigger.create({
                trigger: entry,
                start: 'top 55%',
                end: 'bottom 45%',
                toggleClass: { targets: entry, className: 'is-active' },
                refreshPriority: index
            });
        });

        gsap.fromTo('.timeline-progress', {
            scaleY: 0
        }, {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: concertGallery,
                start: 'top 68%',
                end: 'bottom 72%',
                scrub: 0.7
            }
        });
    }

    function refreshScrollTriggers() {
        if (!hasScrollTrigger) {
            return;
        }
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 140);
    }

    function isModalOpen() {
        return !modal.hasAttribute('hidden');
    }

    function restoreBorrowedImage() {
        if (!borrowedImage || !borrowedImageHome) {
            return;
        }

        const { parent, nextSibling } = borrowedImageHome;
        if (nextSibling && nextSibling.parentNode === parent) {
            parent.insertBefore(borrowedImage, nextSibling);
        } else {
            parent.appendChild(borrowedImage);
        }
        borrowedImage = null;
        borrowedImageHome = null;
        modalImage.hidden = false;
    }

    function setModalImage(item, sourceElement) {
        restoreBorrowedImage();
        const sourceImage = sourceElement?.querySelector('.cover-frame img, .concert-poster img');

        if (sourceImage) {
            borrowedImage = sourceImage;
            borrowedImageHome = {
                parent: sourceImage.parentNode,
                nextSibling: sourceImage.nextSibling
            };
            modalImage.hidden = true;
            modalArtwork.appendChild(sourceImage);
            return;
        }

        modalImage.hidden = false;
        modalImage.src = item.image;
        modalImage.alt = item.title;
    }

    function setModalContent(item, sourceElement = null) {
        modalMedia.className = `modal-media ${item.type}-media`;
        modalMedia.classList.toggle('cd-case', item.type === 'cd');
        modalCaseSpine.hidden = item.type !== 'cd';
        setModalImage(item, sourceElement);
        modalTitle.textContent = item.title;
        modalMeta.innerHTML = '';

        const metaItems = item.type === 'concert'
            ? [formatDate(item.date), item.venue, item.hall].filter(Boolean)
            : [
                mediaLabel(item.type),
                ...genreTokens(item).slice(0, 3).map(titleCase),
                item.count ? `${item.count} Disc${item.count === '1' ? '' : 's'}` : ''
            ].filter(Boolean);

        metaItems.forEach((text) => modalMeta.appendChild(createMetaPill(text)));
        modalDescription.innerHTML = renderMarkdownToSafeHtml(item.description);
        modalCounter.textContent = `${String(activeModalIndex + 1).padStart(2, '0')} / ${String(activeModalList.length).padStart(2, '0')}`;
        updateModalNav();
    }

    function updateModalNav() {
        const canNavigate = activeModalList.length > 1;
        modalPrev.hidden = !canNavigate;
        modalNext.hidden = !canNavigate;
    }

    function sourceMediaRect(sourceElement) {
        if (!sourceElement) {
            return null;
        }
        const media = sourceElement.querySelector('.cover-frame, .concert-poster');
        return media ? media.getBoundingClientRect() : sourceElement.getBoundingClientRect();
    }

    function setPageAnimationsEnabled(enabled) {
        if (!hasScrollTrigger) {
            return;
        }
        ScrollTrigger.getAll().forEach((trigger) => {
            if (enabled) {
                trigger.enable(false, false);
            } else {
                trigger.disable(false, false);
            }
        });
    }

    function lockPageScroll() {
        const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
        document.body.style.setProperty('--scrollbar-compensation', `${scrollbarWidth}px`);
        document.body.classList.add('modal-open');
        setPageAnimationsEnabled(false);
    }

    function unlockPageScroll() {
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('--scrollbar-compensation');
        setPageAnimationsEnabled(true);
    }

    function openModal(item, sourceElement) {
        if (modalIsAnimating) {
            return;
        }

        lastFocusedBeforeModal = document.activeElement;
        activeSourceElement = sourceElement;
        activeModalList = item.type === 'concert' ? concertRecords : visibleCollectionRecords;
        activeModalIndex = Math.max(0, activeModalList.findIndex((record) => record.uid === item.uid));
        setModalContent(activeModalList[activeModalIndex] || item, sourceElement);

        modal.removeAttribute('hidden');
        modal.setAttribute('aria-hidden', 'false');
        lockPageScroll();

        if (!hasGSAP || prefersReducedMotion()) {
            closeButton.focus();
            return;
        }

        modalIsAnimating = true;
        const sourceRect = sourceMediaRect(sourceElement);
        const destinationRect = modalMedia.getBoundingClientRect();
        const canTransformMedia = sourceRect && destinationRect.width && destinationRect.height;
        const mediaStart = canTransformMedia ? {
            x: sourceRect.left + sourceRect.width / 2 - (destinationRect.left + destinationRect.width / 2),
            y: sourceRect.top + sourceRect.height / 2 - (destinationRect.top + destinationRect.height / 2),
            scale: sourceRect.width / destinationRect.width
        } : {
            y: 28,
            scale: 0.96
        };

        gsap.killTweensOf([
            modal,
            modalBackdrop,
            modalContent,
            modalMedia,
            modalInfo,
            modalToolbar
        ]);
        gsap.set(modal, { autoAlpha: 1 });
        gsap.set(modalBackdrop, { autoAlpha: 0 });
        gsap.set(modalContent, { autoAlpha: 1 });
        gsap.set([modalInfo, modalToolbar], { autoAlpha: 0 });
        gsap.set(modalMedia, {
            ...mediaStart,
            autoAlpha: 1,
            transformOrigin: 'center center',
            willChange: 'transform'
        });

        gsap.timeline({
            onComplete: () => {
                modalIsAnimating = false;
                closeButton.focus();
            }
        })
            .to(modalBackdrop, {
                autoAlpha: 1,
                duration: 0.38,
                ease: 'sine.inOut'
            })
            .to(modalMedia, {
                x: 0,
                y: 0,
                scale: 1,
                duration: 0.56,
                ease: 'power3.inOut',
                clearProps: 'transform',
                onComplete: () => gsap.set(modalMedia, { clearProps: 'willChange' })
            })
            .to([modalInfo, modalToolbar], {
                autoAlpha: 1,
                duration: 0.22,
                ease: 'power1.out',
                clearProps: 'opacity,visibility'
            }, '+=0.02');
    }

    function finishClose() {
        modal.setAttribute('hidden', '');
        modal.setAttribute('aria-hidden', 'true');
        restoreBorrowedImage();
        unlockPageScroll();
        if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
            lastFocusedBeforeModal.focus();
        }
        lastFocusedBeforeModal = null;
        activeSourceElement = null;
        modalIsAnimating = false;

        window.clearTimeout(modalCleanupTimer);
        modalCleanupTimer = window.setTimeout(() => {
            if (isModalOpen()) {
                return;
            }
            modalImage.src = '';
            modalImage.alt = '';
            modalMeta.innerHTML = '';
            modalDescription.innerHTML = '';
            if (hasGSAP) {
                gsap.set([modalBackdrop, modalMedia, modalInfo, modalToolbar], {
                    clearProps: 'opacity,visibility,transform,willChange'
                });
            }
        }, 120);
    }

    function closeModal() {
        if (modalIsAnimating || !isModalOpen()) {
            return;
        }

        if (!hasGSAP || prefersReducedMotion()) {
            finishClose();
            return;
        }

        modalIsAnimating = true;
        const destinationRect = modalMedia.getBoundingClientRect();
        const sourceRect = sourceMediaRect(activeSourceElement);
        const sourceIsOnscreen = sourceRect
            && sourceRect.right > 0
            && sourceRect.left < window.innerWidth
            && sourceRect.bottom > 0
            && sourceRect.top < window.innerHeight;
        const canReturnMedia = sourceRect
            && sourceIsOnscreen
            && destinationRect.width
            && activeSourceElement
            && document.body.contains(activeSourceElement)
            && !activeSourceElement.classList.contains('is-filtered-out');

        const mediaEnd = canReturnMedia ? {
            x: sourceRect.left + sourceRect.width / 2 - (destinationRect.left + destinationRect.width / 2),
            y: sourceRect.top + sourceRect.height / 2 - (destinationRect.top + destinationRect.height / 2),
            scale: sourceRect.width / destinationRect.width
        } : null;

        gsap.set(modalMedia, { willChange: 'transform' });
        const closeTimeline = gsap.timeline({
            defaults: { ease: 'power3.inOut' },
            onComplete: finishClose
        });

        closeTimeline.to([modalToolbar, modalInfo], {
            autoAlpha: 0,
            duration: 0.16,
            ease: 'power1.out'
        });

        if (canReturnMedia) {
            closeTimeline.to(modalMedia, {
                ...mediaEnd,
                duration: 0.5,
                ease: 'power3.inOut',
                onComplete: () => {
                    gsap.set(modalMedia, { autoAlpha: 0 });
                    restoreBorrowedImage();
                }
            })
                .to(modalBackdrop, {
                    autoAlpha: 0,
                    duration: 0.42,
                    ease: 'sine.inOut'
                });
        } else {
            closeTimeline
                .to(modalMedia, {
                    autoAlpha: 0,
                    y: 18,
                    scale: 0.985,
                    duration: 0.3
                })
                .to(modalBackdrop, {
                    autoAlpha: 0,
                    duration: 0.42,
                    ease: 'sine.inOut'
                });
        }
    }

    function navigateModal(direction) {
        if (activeModalList.length < 2 || modalIsAnimating) {
            return;
        }

        activeModalIndex = (activeModalIndex + direction + activeModalList.length) % activeModalList.length;
        const nextItem = activeModalList[activeModalIndex];
        activeSourceElement = nextItem.element || null;

        if (!hasGSAP || prefersReducedMotion()) {
            setModalContent(nextItem, activeSourceElement);
            return;
        }

        modalIsAnimating = true;
        const outgoing = [modalMedia, modalTitle, modalMeta, modalDescription];
        const exitX = direction > 0 ? -24 : 24;
        const enterX = direction > 0 ? 28 : -28;

        gsap.timeline({
            defaults: { ease: 'power2.inOut' },
            onComplete: () => {
                modalIsAnimating = false;
            }
        })
            .to(outgoing, {
                autoAlpha: 0,
                x: exitX,
                duration: 0.2,
                stagger: 0.02,
                onComplete: () => {
                    setModalContent(nextItem, activeSourceElement);
                    gsap.set(outgoing, { x: enterX });
                }
            })
            .to(outgoing, {
                autoAlpha: 1,
                x: 0,
                duration: 0.34,
                stagger: 0.025,
                ease: 'power3.out',
                clearProps: 'opacity,visibility,transform'
            });
    }

    closeButton.addEventListener('click', closeModal);
    modalPrev.addEventListener('click', () => navigateModal(-1));
    modalNext.addEventListener('click', () => navigateModal(1));

    searchInput.addEventListener('compositionstart', () => {
        searchIsComposing = true;
        window.clearTimeout(searchTimer);
    });

    searchInput.addEventListener('compositionend', () => {
        searchIsComposing = false;
        scheduleSearch();
    });

    searchInput.addEventListener('input', () => {
        if (!searchIsComposing) {
            scheduleSearch();
        }
    });

    clearSearch.addEventListener('click', () => {
        window.clearTimeout(searchTimer);
        searchInput.value = '';
        commitSearch();
        searchInput.focus();
    });

    genreFilter.addEventListener('change', () => {
        collectionState.genre = genreFilter.value;
        applyCollectionFilters();
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    modal.addEventListener('keydown', (event) => {
        if (!isModalOpen()) {
            return;
        }
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            navigateModal(-1);
            return;
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            navigateModal(1);
            return;
        }
        if (event.key !== 'Tab') {
            return;
        }

        const focusableSelector =
            'button:not([disabled]):not([hidden]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusables = Array.from(modal.querySelectorAll(focusableSelector)).filter(
            (element) => element.offsetWidth > 0 || element.offsetHeight > 0
        );
        if (!focusables.length) {
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

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isModalOpen()) {
            closeModal();
        }
    });

    function init() {
        if (typeof siteData === 'undefined') {
            console.error('Data not loaded');
            return;
        }

        const allItems = siteData.map((item, index) => ({
            ...item,
            uid: `${item.type}-${index}`,
            searchText: searchText(item)
        }));
        collectionRecords = shuffle(
            allItems.filter((item) => item.type === 'cd' || item.type === 'vinyl')
        );
        concertRecords = allItems.filter((item) => item.type === 'concert');

        updateArchiveStats(allItems);
        renderCollection();
        renderConcerts();
        animateIntro();
        initScrollAnimations();
        refreshScrollTriggers();
    }

    init();
});
