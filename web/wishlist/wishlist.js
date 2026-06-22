document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('wishlist-grid');

    function getItems() {
        return Array.isArray(wishlistData) ? wishlistData : [];
    }

    function compactList(values) {
        return (values || []).filter(Boolean).join(' · ');
    }

    function createCover(item) {
        const cover = document.createElement('div');
        cover.className = 'wishlist-cover';

        if (item.image) {
            const image = document.createElement('img');
            image.src = item.image;
            image.alt = item.title;
            image.loading = 'lazy';
            cover.appendChild(image);
            return cover;
        }

        const title = document.createElement('span');
        title.textContent = item.title;
        cover.appendChild(title);
        return cover;
    }

    function createWishlistCard(item) {
        const card = document.createElement('article');
        card.className = 'wishlist-card';

        const title = document.createElement('h2');
        title.className = 'wishlist-title';
        title.textContent = item.title;

        const artist = document.createElement('p');
        artist.className = 'wishlist-artist';
        artist.textContent = compactList(item.artists) || compactList(item.composers) || 'Unknown Artist';

        const meta = document.createElement('p');
        meta.className = 'wishlist-meta-line';
        meta.textContent = [compactList(item.genres), item.year].filter(Boolean).join(' · ');

        card.append(createCover(item), title, artist);
        if (meta.textContent) {
            card.appendChild(meta);
        }

        return card;
    }

    function render() {
        const items = getItems();
        grid.innerHTML = '';
        items.forEach((item) => grid.appendChild(createWishlistCard(item)));
    }

    render();
});
