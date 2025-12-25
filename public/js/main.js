document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.querySelector('.nav-links');
    const navIcons = document.querySelector('.nav-icons');

    // Sticky Navbar
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile Menu Toggle
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            navIcons.classList.toggle('active');
            hamburger.classList.toggle('active');

            // Animate hamburger lines
            const spans = hamburger.querySelectorAll('span');
            if (hamburger.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    }

    let products = [];

    // Fetch Products from API
    // Use absolute URL for Live Server compatibility
    const API_BASE = 'http://localhost:3000';

    const fetchProducts = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/products`);
            products = await response.json();

            // Initial Render based on page context
            if (window.currentCategory) {
                renderProducts(window.currentCategory, 'category-grid', 'type');
            } else {
                renderProducts('new-drops', 'new-drops-grid');
                renderProducts('best-sellers', 'best-sellers-grid');
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    // Render Products
    const renderProducts = (filterValue, containerId, filterType = 'category') => {
        const container = document.getElementById(containerId);
        if (!container) return;

        let filteredProducts;
        if (filterType === 'all') {
            filteredProducts = products;
        } else {
            filteredProducts = products.filter(p => p[filterType] === filterValue);
        }

        if (filteredProducts.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted);">No products found in this category.</p>';
            return;
        }

        container.innerHTML = filteredProducts.map(product => {
            // Calculate Discount
            // Handle Price: If string (old data), parse it. If number (new data), use directly.
            let originalPrice;
            if (typeof product.price === 'string') {
                originalPrice = parseFloat(product.price.replace(/[^0-9.]/g, ''));
            } else {
                originalPrice = parseFloat(product.price);
            }

            const discount = product.discount || 0;
            const finalPrice = discount > 0 ? (originalPrice * (1 - discount / 100)).toFixed(2) : originalPrice.toFixed(2);

            return `
            <div class="product-card fade-in-up">
                <div class="product-image-container">
                    ${discount > 0 ? `<div style="position:absolute; top:10px; left:10px; background:var(--color-gold); color:#000; padding:2px 8px; font-weight:bold; font-size:0.8rem;">-${discount}%</div>` : ''}
                    <img src="${product.image}" alt="${product.name}" class="product-img">
                </div>
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p>
                        ${discount > 0 ? `<span style="text-decoration: line-through; opacity: 0.5;">₹${originalPrice.toFixed(2)}</span> ` : ''}
                        ₹${finalPrice}
                    </p>
                    <button class="btn btn-primary" style="width:100%; margin-top:10px; padding: 8px;" onclick='buyNow(${JSON.stringify(product)})'>Buy Now</button>
                </div>
            </div>
            `;
        }).join('');
    };

    // Buy Now Handler
    window.buyNow = (product) => {
        localStorage.setItem('checkoutItem', JSON.stringify(product));
        window.location.href = 'checkout.html';
    };

    // Initialize
    fetchProducts();

    // Search Functionality
    const searchOverlay = document.getElementById('search-overlay');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const recentSearchesContainer = document.getElementById('recent-searches');
    const closeSearch = document.getElementById('close-search');
    const searchIcon = document.querySelector('a[aria-label="Search"]');

    // Helper: Render Recent Searches
    const renderRecentSearches = () => {
        const history = JSON.parse(localStorage.getItem('searchHistory')) || [];
        if (history.length === 0) {
            recentSearchesContainer.innerHTML = '';
            return;
        }

        recentSearchesContainer.innerHTML = `
            <p style="width: 100%; text-align: center; color: #888; font-size: 0.8rem; margin-bottom: 5px;">RECENT SEARCHES</p>
            ${history.map(term => `<span class="search-tag" onclick="runSearch('${term}')">${term}</span>`).join('')}
        `;
    };

    // Helper: Add to History
    const addToHistory = (query) => {
        let history = JSON.parse(localStorage.getItem('searchHistory')) || [];
        // Remove duplicate if exists
        history = history.filter(item => item !== query);
        // Add to front
        history.unshift(query);
        // Limit to 5
        if (history.length > 5) history.pop();
        localStorage.setItem('searchHistory', JSON.stringify(history));
        renderRecentSearches();
    };

    // Global wrapper for onclick
    window.runSearch = (term) => {
        searchInput.value = term;
        searchInput.dispatchEvent(new Event('input')); // Trigger search
    };

    if (searchIcon) {
        searchIcon.addEventListener('click', (e) => {
            e.preventDefault();
            searchOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Disable background scroll
            renderRecentSearches(); // Show history on open
            setTimeout(() => searchInput.focus(), 100);
        });
    }

    if (closeSearch) {
        closeSearch.addEventListener('click', () => {
            searchOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Re-enable background scroll
        });
    }

    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
            searchOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Handle Enter Key to Save Search
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && searchInput.value.trim().length > 0) {
                addToHistory(searchInput.value.trim().toLowerCase());
                searchInput.blur(); // Close keyboard on mobile
            }
        });
    }

    // Unified Search Filter Logic
    const performSearch = () => {
        const query = searchInput.value.toLowerCase().trim();
        const categoryFilter = document.getElementById('search-category').value;
        const priceFilter = document.getElementById('search-price').value;

        // Base check
        if (!products || products.length === 0) {
            searchResults.innerHTML = '<p style="color: #666;">Loading products...</p>';
            return;
        }

        // Filter Logic
        let filtered = products.filter(p => {
            // 1. Text Match (Name, Category, Type)
            const name = p.name ? p.name.toLowerCase() : '';
            const cat = p.category ? p.category.toLowerCase() : '';
            const type = p.type ? p.type.toLowerCase() : '';
            const matchesText = (query === '') || (name.includes(query) || cat.includes(query) || type.includes(query));

            // 2. Category Match
            const matchesCategory = (categoryFilter === 'all') || (type === categoryFilter);

            // 3. Price Match
            let price = typeof p.price === 'string' ? parseFloat(p.price.replace(/[^0-9.]/g, '')) : p.price;
            let matchesPrice = true;
            if (priceFilter === '0-50') matchesPrice = price < 50;
            if (priceFilter === '50-100') matchesPrice = price >= 50 && price <= 100;
            if (priceFilter === '100+') matchesPrice = price > 100;

            return matchesText && matchesCategory && matchesPrice;
        });

        if (filtered.length === 0) {
            // If query exists but no results, show feedback
            if (query.length > 0 || categoryFilter !== 'all' || priceFilter !== 'all') {
                searchResults.innerHTML = '<p style="text-align: center; color: #888; grid-column: 1/-1;">No results found matching your criteria.</p>';
            } else {
                searchResults.innerHTML = ''; // Empty start
            }
            return;
        }

        searchResults.innerHTML = filtered.map(product => {
            let displayPrice = product.price;
            if (typeof product.price === 'number') displayPrice = product.price.toFixed(2);

            return `
            <div class="product-card" onclick="window.location.href='index.html#shop'" style="cursor: pointer;">
                <div style="height: 200px; overflow: hidden; margin-bottom: 10px; border-radius: 4px;">
                    <img src="${product.image}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <h4 style="font-size: 1rem; margin-bottom: 5px;">${product.name}</h4>
                <p style="color: var(--color-gold);">₹${displayPrice}</p>
                <button class="btn btn-outline" style="width:100%; padding: 5px; font-size: 0.8rem; margin-top: 5px;" onclick='event.stopPropagation(); buyNow(${JSON.stringify(product)})'>Buy Now</button>
            </div>
        `}).join('');
    };

    // Event Listeners for Filters
    if (searchInput) {
        // Text Input
        searchInput.addEventListener('input', performSearch);

        // Dropdowns
        document.getElementById('search-category').addEventListener('change', performSearch);
        document.getElementById('search-price').addEventListener('change', performSearch);
    }

    // Scroll Animations (Intersection Observer)
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in-up').forEach(el => {
        el.style.animationPlayState = 'paused'; // Pause initially
        observer.observe(el);
    });
});
