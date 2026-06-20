/**
 * BigQuery Release Notes Hub & Tweet Composer
 * Frontend Application Script (Vanilla Javascript)
 */

// Application State
let state = {
    releases: [],
    selectedRelease: null,
    searchQuery: '',
    activeFilter: 'all',
    sortOrder: 'desc', // 'desc' (newest first) or 'asc' (oldest first)
    isLoading: false
};

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const filterBtns = document.querySelectorAll('.filter-btn');
const sortSelect = document.getElementById('sort-select');
const feedMeta = document.getElementById('feed-meta');
const feedLoading = document.getElementById('feed-loading');
const feedEmpty = document.getElementById('feed-empty');
const releasesList = document.getElementById('releases-list');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const connectionStatus = document.getElementById('connection-status');

// Composer DOM Elements
const composerEmptyState = document.getElementById('composer-empty-state');
const composerContent = document.getElementById('composer-content');
const selectedTypeBadge = document.getElementById('selected-type-badge');
const selectedDate = document.getElementById('selected-date');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const progressRingBar = document.getElementById('progress-ring-bar');
const progressRing = document.querySelector('.progress-ring');
const tweetBtn = document.getElementById('tweet-btn');
const btnHashBq = document.getElementById('btn-hash-bq');
const btnHashGcp = document.getElementById('btn-hash-gcp');
const btnResetText = document.getElementById('btn-reset-text');

// Mobile trigger DOM Elements
const mobileComposerTrigger = document.getElementById('mobile-composer-trigger');
const mobileTriggerText = document.getElementById('mobile-trigger-text');
const mobileTriggerBtn = document.getElementById('mobile-trigger-btn');

// Constants
const TWITTER_CHAR_LIMIT = 280;
const TWITTER_SHORT_URL_LENGTH = 23; // Twitter wraps all URLs to 23 chars
const CIRCUMFERENCE = 2 * Math.PI * 10; // r=10 for progress ring

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch
    fetchReleases();

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchReleases(true));
    
    searchInput.addEventListener('input', handleSearchInput);
    clearSearchBtn.addEventListener('click', clearSearch);
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.activeFilter = e.target.getAttribute('data-type');
            renderReleases();
        });
    });

    sortSelect.addEventListener('change', (e) => {
        state.sortOrder = e.target.value;
        renderReleases();
    });

    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        
        filterBtns.forEach(b => b.classList.remove('active'));
        document.getElementById('filter-all').classList.add('active');
        state.activeFilter = 'all';
        
        renderReleases();
    });

    // Composer Input Events
    tweetTextarea.addEventListener('input', updateCharCount);
    
    // Composer Utility Buttons
    btnHashBq.addEventListener('click', () => appendText(' #BigQuery'));
    btnHashGcp.addEventListener('click', () => appendText(' #GoogleCloud'));
    btnResetText.addEventListener('click', resetTweetDraft);
    
    // Tweet Action
    tweetBtn.addEventListener('click', shareOnTwitter);

    // Mobile scroll helper
    mobileTriggerBtn.addEventListener('click', () => {
        document.querySelector('.composer-section').scrollIntoView({ behavior: 'smooth' });
    });

    // Handle mobile responsiveness check
    handleResponsiveLayout();
    window.addEventListener('resize', handleResponsiveLayout);
});

/**
 * Fetches release notes from Flask API
 */
async function fetchReleases(forceRefresh = false) {
    if (state.isLoading) return;
    
    setLoadingState(true);
    updateConnectionStatus('loading', 'Fetching notes...');
    
    try {
        const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'success' || data.status === 'fallback') {
            state.releases = data.releases;
            setLoadingState(false);
            updateConnectionStatus('connected', 'Connected');
            renderReleases();
            
            // Re-select release if we refreshed and it still exists
            if (state.selectedRelease) {
                const stillExists = state.releases.find(r => r.id === state.selectedRelease.id);
                if (stillExists) {
                    selectRelease(stillExists);
                } else {
                    deselectRelease();
                }
            }
        } else {
            throw new Error(data.message || 'Unknown server error');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        setLoadingState(false);
        updateConnectionStatus('error', 'Sync Failed');
        
        // Show alert or UI indication
        feedMeta.textContent = 'Error loading release notes.';
        releasesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-container" style="border-color: var(--border-fix)">
                    <i data-lucide="alert-triangle" style="color: var(--text-fix)"></i>
                </div>
                <h3>Failed to fetch releases</h3>
                <p>${error.message || 'Could not connect to the backend server. Please verify Flask is running.'}</p>
                <button onclick="fetchReleases(true)" class="btn btn-primary">Try Again</button>
            </div>
        `;
        lucide.createIcons();
    }
}

/**
 * Sets loading state UI
 */
function setLoadingState(loading) {
    state.isLoading = loading;
    
    if (loading) {
        refreshBtn.disabled = true;
        refreshBtn.querySelector('i').classList.add('spinning');
        feedLoading.style.display = 'flex';
        releasesList.style.display = 'none';
        feedEmpty.style.display = 'none';
        feedMeta.textContent = 'Refreshing official feeds...';
    } else {
        refreshBtn.disabled = false;
        refreshBtn.querySelector('i').classList.remove('spinning');
        feedLoading.style.display = 'none';
        releasesList.style.display = 'flex';
    }
}

/**
 * Updates connection status badge
 */
function updateConnectionStatus(status, text) {
    connectionStatus.className = `status-badge ${status}`;
    connectionStatus.querySelector('.status-text').textContent = text;
}

/**
 * Search input handler
 */
function handleSearchInput(e) {
    state.searchQuery = e.target.value.toLowerCase().trim();
    clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
    renderReleases();
}

/**
 * Clears search input
 */
function clearSearch() {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderReleases();
}

/**
 * Renders release cards based on search, filter, and sort
 */
function renderReleases() {
    if (state.isLoading) return;
    
    // 1. Filter releases
    let filtered = state.releases.filter(item => {
        // Category filter
        if (state.activeFilter !== 'all' && item.type.toLowerCase() !== state.activeFilter.toLowerCase()) {
            return false;
        }
        
        // Search filter
        if (state.searchQuery) {
            const inDate = item.date.toLowerCase().includes(state.searchQuery);
            const inType = item.type.toLowerCase().includes(state.searchQuery);
            const inContent = item.text_content.toLowerCase().includes(state.searchQuery);
            return inDate || inType || inContent;
        }
        
        return true;
    });

    // 2. Sort releases (based on original array position or ISO date)
    filtered.sort((a, b) => {
        const dateA = new Date(a.iso_date || a.date);
        const dateB = new Date(b.iso_date || b.date);
        return state.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // 3. Update result meta text
    feedMeta.textContent = `Showing ${filtered.length} of ${state.releases.length} updates`;

    // 4. Render cards
    releasesList.innerHTML = '';
    
    if (filtered.length === 0) {
        feedEmpty.style.display = 'flex';
        return;
    }
    
    feedEmpty.style.display = 'none';
    
    filtered.forEach(item => {
        const card = document.createElement('div');
        const isSelected = state.selectedRelease && state.selectedRelease.id === item.id;
        
        card.className = `release-card ${isSelected ? 'selected' : ''}`;
        card.setAttribute('data-id', item.id);
        
        // Map badge type classes
        const typeClass = item.type.toLowerCase();
        
        card.innerHTML = `
            <div class="card-header-row">
                <div class="header-badges">
                    <span class="badge ${typeClass}">${item.type}</span>
                </div>
                <div class="date-container">
                    <i data-lucide="calendar" class="date-icon"></i>
                    <span>${item.date}</span>
                </div>
            </div>
            <div class="card-content-render">
                ${item.html_content}
            </div>
            <div class="card-actions-row">
                <button class="btn btn-card-tweet" onclick="handleCardTweetClick(event, '${item.id}')">
                    <i data-lucide="twitter" style="width: 14px; height: 14px;"></i>
                    <span>${isSelected ? 'Selected for Draft' : 'Draft Tweet'}</span>
                </button>
            </div>
        `;
        
        // Clicking anywhere on the card selects it
        card.addEventListener('click', (e) => {
            // Avoid selecting if clicking a link or button directly
            if (e.target.tagName.toLowerCase() === 'a' || e.target.closest('.btn-card-tweet')) {
                return;
            }
            selectRelease(item);
        });
        
        releasesList.appendChild(card);
    });

    // Re-initialize Lucide Icons for dynamic content
    lucide.createIcons();
}

/**
 * Handles quick tweet button click on card
 */
function handleCardTweetClick(event, releaseId) {
    event.stopPropagation(); // Stop click from bubling up
    
    const release = state.releases.find(r => r.id === releaseId);
    if (!release) return;
    
    selectRelease(release);
    
    // Smooth scroll to composer on smaller screens
    if (window.innerWidth <= 1024) {
        document.querySelector('.composer-section').scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Selects a release note and loads it into the composer
 */
function selectRelease(release) {
    state.selectedRelease = release;
    
    // Highlight card visually
    document.querySelectorAll('.release-card').forEach(card => {
        if (card.getAttribute('data-id') === release.id) {
            card.classList.add('selected');
            const btn = card.querySelector('.btn-card-tweet span');
            if (btn) btn.textContent = 'Selected for Draft';
        } else {
            card.classList.remove('selected');
            const btn = card.querySelector('.btn-card-tweet span');
            if (btn) btn.textContent = 'Draft Tweet';
        }
    });

    // Update Composer Form
    composerEmptyState.style.display = 'none';
    composerContent.style.display = 'flex';
    
    // Set metadata in composer
    selectedTypeBadge.textContent = release.type;
    selectedTypeBadge.className = `badge ${release.type.toLowerCase()}`;
    selectedDate.textContent = release.date;
    
    // Format Tweet and set textarea
    const defaultText = formatDefaultTweet(release);
    tweetTextarea.value = defaultText;
    
    // Recalculate character counters
    updateCharCount();

    // Update Mobile Trigger Bar
    mobileTriggerText.textContent = `Drafting: BigQuery ${release.type} (${release.date})`;
    mobileTriggerBtn.removeAttribute('disabled');
    
    // Highlight composer wrapper briefly
    const cardWrapper = document.querySelector('.composer-card');
    cardWrapper.style.borderColor = 'var(--color-primary)';
    cardWrapper.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.3)';
    setTimeout(() => {
        cardWrapper.style.borderColor = '';
        cardWrapper.style.boxShadow = '';
    }, 400);
}

/**
 * Deselects currently selected release
 */
function deselectRelease() {
    state.selectedRelease = null;
    composerEmptyState.style.display = 'flex';
    composerContent.style.display = 'none';
    
    mobileTriggerText.textContent = 'No update selected';
    mobileTriggerBtn.setAttribute('disabled', 'true');
    
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.remove('selected');
        const btn = card.querySelector('.btn-card-tweet span');
        if (btn) btn.textContent = 'Draft Tweet';
    });
}

/**
 * Formats a template tweet text based on character constraints
 */
function formatDefaultTweet(release) {
    const prefix = `📢 BigQuery #${release.type} Update [${release.date}]:\n`;
    const url = release.link || 'https://cloud.google.com/bigquery/docs/release-notes';
    
    // Characters reserved for metadata
    // Twitter wraps URLs in t.co which counts as 23 characters
    const textPrefixLength = prefix.length;
    const spacingLength = 4; // newline breaks
    const urlLength = TWITTER_SHORT_URL_LENGTH;
    const maxDescriptionLength = TWITTER_CHAR_LIMIT - textPrefixLength - spacingLength - urlLength;
    
    let description = release.text_content;
    
    // Clean up excessive spacing from text
    description = description.replace(/\s+/g, ' ').trim();
    
    if (description.length > maxDescriptionLength) {
        description = description.substring(0, maxDescriptionLength - 3) + '...';
    }
    
    return `${prefix}${description}\n\n${url}`;
}

/**
 * Updates character count, circular progress bar, and validations
 */
function updateCharCount() {
    const text = tweetTextarea.value;
    const length = calculateTwitterLength(text);
    const remaining = TWITTER_CHAR_LIMIT - length;
    
    // Update count text
    charCounter.textContent = remaining;
    
    // Calculate progress circle stroke offset
    // Circumference is ~62.8
    const progress = Math.max(0, Math.min(length, TWITTER_CHAR_LIMIT));
    const offset = CIRCUMFERENCE - (progress / TWITTER_CHAR_LIMIT) * CIRCUMFERENCE;
    progressRingBar.style.strokeDashoffset = offset;
    
    // Style adjustments based on remaining limits
    if (remaining < 0) {
        charCounter.className = 'char-counter danger';
        progressRing.className = 'progress-ring error';
        tweetBtn.disabled = true;
    } else if (remaining <= 20) {
        charCounter.className = 'char-counter warning';
        progressRing.className = 'progress-ring warn';
        tweetBtn.disabled = false;
    } else {
        charCounter.className = 'char-counter';
        progressRing.className = 'progress-ring';
        tweetBtn.disabled = false;
    }
    
    // Cannot send empty tweet
    if (text.trim() === '') {
        tweetBtn.disabled = true;
    }
}

/**
 * Helper to calculate Twitter's string length rules.
 * Treats all web URLs (http/https) as 23 characters.
 */
function calculateTwitterLength(str) {
    if (!str) return 0;
    
    // Regex matching URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    let urlMatches = str.match(urlRegex) || [];
    
    let plainText = str;
    urlMatches.forEach(url => {
        plainText = plainText.replace(url, '');
    });
    
    // Base length + 23 characters for each URL in the tweet
    return plainText.length + (urlMatches.length * TWITTER_SHORT_URL_LENGTH);
}

/**
 * Appends text to tweet textarea
 */
function appendText(appendText) {
    if (!state.selectedRelease) return;
    
    const text = tweetTextarea.value;
    
    // Only append if it's not already in the tweet
    if (!text.includes(appendText.trim())) {
        // Insert right before the URL link if found
        const urlIndex = text.lastIndexOf('https://');
        if (urlIndex !== -1) {
            tweetTextarea.value = text.substring(0, urlIndex).trim() + appendText + '\n\n' + text.substring(urlIndex);
        } else {
            tweetTextarea.value = text + appendText;
        }
        updateCharCount();
    }
}

/**
 * Resets the tweet draft back to formatted default
 */
function resetTweetDraft() {
    if (state.selectedRelease) {
        selectRelease(state.selectedRelease);
    }
}

/**
 * Launches Twitter Web Intent with URL-encoded draft text
 */
function shareOnTwitter() {
    const text = tweetTextarea.value;
    if (!text || text.trim() === '') return;
    
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'width=550,height=420,referrerpolicy=no-referrer');
}

/**
 * Handles showing mobile controls or sticky positioning depending on window size
 */
function handleResponsiveLayout() {
    if (window.innerWidth <= 1024) {
        mobileComposerTrigger.style.display = 'flex';
    } else {
        mobileComposerTrigger.style.display = 'none';
    }
}
