// Epic Free Games - Main JavaScript

const DATA_URL = `data/games-free.json?v=${Date.now()}`;

// State
let allGames = [];
let searchQuery = '';
let showEndedGames = false;

// DOM Elements
const gamesGrid = document.getElementById('gamesGrid');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const updateTime = document.getElementById('updateTime');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const themeToggle = document.getElementById('themeToggle');
const pastToggle = document.getElementById('pastToggle');
const pastToggleContainer = document.getElementById('pastToggleContainer');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    initTheme();
    setupEventListeners();
    setupVisibilityHandler(); // 페이지 가시성 핸들러
    setupCleanup();           // 정리 로직
    await loadGames();
    startCountdowns();
    registerServiceWorker();
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (themeToggle) {
        themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function setupEventListeners() {
    // Theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Search input (debounced)
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                searchQuery = e.target.value.trim().toLowerCase();
                renderGames();
            }, 200);
            // X 버튼 표시/숨김
            if (searchClear) {
                searchClear.classList.toggle('visible', e.target.value.length > 0);
            }
        });
    }

    // Search clear button
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchQuery = '';
                searchClear.classList.remove('visible');
                renderGames();
                searchInput.focus();
            }
        });
    }

    // Ended games toggle (종료 게임 표시/숨김)
    if (pastToggle) {
        pastToggle.addEventListener('change', (e) => {
            showEndedGames = e.target.checked;
            renderGames();
        });
    }
}

// Service Worker Registration
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

/**
 * 종료된 게임의 시간 표시 (하이브리드 방식)
 * - 24시간 이내: "X시간 전 종료"
 * - 7일 이내: "X일 전 종료"
 * - 30일 이내: "M월 D일 종료"
 * - 30일 이상: "YY년 M월 D일 종료"
 * @param {string} endTime - ISO 8601 형식의 종료 시간
 * @returns {string} 포맷된 종료 시간 문자열
 */
function formatEndedTime(endTime) {
    const now = new Date();
    const end = new Date(endTime);

    if (isNaN(end.getTime())) {
        return 'Ended';
    }

    const diffMs = now - end;
    const hoursAgo = Math.floor(diffMs / (1000 * 60 * 60));
    const daysAgo = Math.floor(hoursAgo / 24);

    if (hoursAgo < 1) {
        return 'Just ended';
    } else if (hoursAgo < 24) {
        return `${hoursAgo}h ago`;
    } else if (daysAgo < 7) {
        return `${daysAgo}d ago`;
    } else if (daysAgo < 30) {
        const month = end.getMonth() + 1;
        const day = end.getDate();
        return `${month}/${day}`;
    } else {
        const year = end.getFullYear();
        const month = end.getMonth() + 1;
        const day = end.getDate();
        return `${year}/${month}/${day}`;
    }
}

/**
 * 무료 게임용 카운트다운 타이머 HTML 생성
 * 포맷: "01일 23시 12분 50초"
 * @param {string} endTime - ISO 8601 형식의 종료 시간
 * @returns {string} 카운트다운 타이머 HTML
 */
function createFreeCountdownHTML(endTime) {
    const now = new Date();
    const end = new Date(endTime);
    const diffMs = end - now;

    if (diffMs <= 0) {
        return `<span class="game-card__time-info game-card__time-info--ended">Ended</span>`;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const timeText = `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

    return `
        <span class="game-card__time-info game-card__time-info--free"
              data-countdown-free="${endTime}"
              role="timer"
              aria-live="polite"
              aria-label="Free download ends in ${timeText}">${timeText}</span>
    `.trim();
}

// === Ended Games Filtering ===

/**
 * 종료된 게임 수 계산
 * @param {Array} games - 게임 배열
 * @returns {number} 종료된 게임 수
 */
function countEndedGames(games) {
    return games.filter(g => g.isEnded).length;
}

async function loadGames() {
    loading.classList.remove('hidden');
    gamesGrid.innerHTML = '';

    try {
        const response = await fetch(DATA_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // 백엔드 분류를 신뢰해 상태 태그를 부여
        const taggedCurrent = (data.currentFree || []).map(g => ({
            ...g,
            isCurrent: true,
            isUpcoming: false,
            isEnded: false,
        }));
        const taggedUpcoming = (data.upcoming || []).map(g => ({
            ...g,
            isCurrent: false,
            isUpcoming: true,
            isEnded: false,
        }));
        const taggedPast = (data.past || []).map(g => ({
            ...g,
            isCurrent: false,
            isUpcoming: false,
            isEnded: true,
        }));

        const allRawGames = [
            ...taggedCurrent,
            ...taggedUpcoming,
            ...taggedPast,
        ];

        // 중복 제거 (id 기준) 후 상태 유지
        const seenIds = new Set();
        allGames = allRawGames
            .filter(g => {
                if (seenIds.has(g.id)) return false;
                seenIds.add(g.id);
                return true;
            })
            .map(g => ({ ...g }));

        // Update time display
        if (data.updated) {
            const date = new Date(data.updated);
            updateTime.textContent = `Last updated: ${formatDate(date)}`;
        }

        loading.classList.add('hidden');
        renderGames();
    } catch (error) {
        console.error('Failed to load game data:', error);
        loading.classList.add('hidden');
        gamesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-secondary);">
                <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">⚠️ Unable to load data</p>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

function renderGames() {
    // 종료 게임이 있을 때만 토글 표시
    const endedCount = countEndedGames(allGames);
    if (pastToggleContainer) {
        pastToggleContainer.classList.toggle('hidden', endedCount === 0);
    }

    // Filter by search query
    let games = allGames;
    if (searchQuery) {
        games = games.filter(game =>
            (game.title || '').toLowerCase().includes(searchQuery)
        );
    }

    // 종료 게임 필터링 (체크 해제 시 숨김)
    if (!showEndedGames) {
        games = games.filter(g => !g.isEnded);
    }

    // 최신순 정렬
    games = sortGames(games);

    // Render
    if (games.length === 0) {
        gamesGrid.innerHTML = '';
        emptyState.classList.remove('hidden');
        if (!showEndedGames) {
            emptyState.textContent = 'No games to display. Try enabling "Include ended".';
        } else {
            emptyState.textContent = 'No games to display.';
        }
        return;
    }

    emptyState.classList.add('hidden');
    gamesGrid.innerHTML = games.map(createGameCard).join('');
}

// escapeHtml, sanitizeUrl, sortGames는 utils.js에서 로드됨 (HTML에서 utils.js 먼저 로드)

// === Rating System (확장 가능한 설정 기반) ===

/**
 * 점수 소스별 설정 - Epic (E), Metacritic (M), OpenCritic (O)
 * @type {Object.<string, {icon: string|null, fullName: string, scale: [number, number], format: function}>}
 */
const RATING_CONFIGS = {
    metacritic: {
        icon: 'assets/metacritic.png',
        fullName: 'Metacritic',
        scale: [0, 100],
        format: (val) => Math.round(val),
    },
    steam: {
        icon: 'assets/steam.png',
        fullName: 'Steam Rating',
        scale: [0, 100],
        format: (val) => Math.round(val) + '%',
    },
    opencritic: {
        icon: 'https://cdn.simpleicons.org/opencritic/ffffff',
        fullName: 'OpenCritic',
        scale: [0, 100],
        format: (val) => Math.round(val),
    },
    epic: {
        icon: null,  // Epic은 텍스트 라벨 사용
        label: 'E',
        fullName: 'Epic Rating',
        scale: [0, 5],
        format: (val) => val.toFixed(1),
    },
};

/**
 * 등급 임계값 설정 (0-100 정규화 기준)
 */
const RATING_TIERS = [
    { min: 75, class: 'rating-badge--excellent', label: 'Excellent' },
    { min: 50, class: 'rating-badge--good', label: 'Good' },
    { min: 0, class: 'rating-badge--poor', label: 'Poor' },
];

/**
 * 점수를 0-100 범위로 정규화
 * @param {number} value - 원본 점수
 * @param {[number, number]} scale - [최소값, 최대값]
 * @returns {number} 0-100 정규화 점수
 */
function normalizeScore(value, scale) {
    const [min, max] = scale;
    return ((value - min) / (max - min)) * 100;
}

/**
 * 정규화된 점수에 따른 색상 클래스 반환
 * @param {number} normalizedScore - 0-100 범위의 정규화 점수
 * @returns {string} CSS 클래스명
 */
function getScoreColorClass(normalizedScore) {
    for (const tier of RATING_TIERS) {
        if (normalizedScore >= tier.min) {
            return tier.class;
        }
    }
    return RATING_TIERS[RATING_TIERS.length - 1].class;
}

/**
 * 정규화된 점수에 따른 등급 라벨 반환
 * @param {number} normalizedScore - 0-100 범위의 정규화 점수
 * @returns {string} 등급 라벨
 */
function getScoreTierLabel(normalizedScore) {
    for (const tier of RATING_TIERS) {
        if (normalizedScore >= tier.min) {
            return tier.label;
        }
    }
    return RATING_TIERS[RATING_TIERS.length - 1].label;
}

/**
 * 평점 배지 HTML 생성 (아이콘 기반 - 확장 가능)
 * @param {Object} rating - { [source]: number|null, ... }
 * @returns {string} 평점 배지 HTML 또는 빈 문자열
 */
function createRatingBadges(rating) {
    if (!rating) return '';

    const badges = [];

    // 설정된 모든 소스를 순회하며 동적 생성
    for (const [source, config] of Object.entries(RATING_CONFIGS)) {
        const value = rating[source];
        if (value == null) continue;

        const normalized = normalizeScore(value, config.scale);
        const colorClass = getScoreColorClass(normalized);
        const tierLabel = getScoreTierLabel(normalized);
        const formattedValue = config.format(value);
        const ariaLabel = `${config.fullName} score ${formattedValue} - ${tierLabel}`;

        // 아이콘 또는 텍스트 라벨 결정
        const labelHtml = config.icon
            ? `<img class="rating-badge__icon" src="${config.icon}" alt="${config.fullName}" width="14" height="14" loading="lazy">`
            : `<span class="rating-badge__label" aria-hidden="true">${config.label}</span>`;

        badges.push(`
            <span
                class="rating-badge ${colorClass}"
                role="img"
                aria-label="${ariaLabel}"
                title="${config.fullName}: ${formattedValue}"
            >${labelHtml}<span class="rating-badge__score">${formattedValue}</span></span>
        `.trim().replace(/\s+/g, ' '));
    }

    if (badges.length === 0) return '';

    return `<div class="game-card__ratings" role="group" aria-label="Game ratings">${badges.join('')}</div>`;
}

function createGameCard(game) {
    const start = game.freePeriod?.start || game.free_start;
    const end = game.freePeriod?.end || game.free_end;
    const isEnded = game.isEnded || false;
    const isUpcoming = game.isUpcoming || (!game.isCurrent && !isEnded);
    const isCurrent = game.isCurrent || false;
    // genres can be array of strings or array of objects
    const genreList = (game.genres || []).map(g => typeof g === 'string' ? g : g.name).slice(0, 3);

    // XSS 방어: 사용자 입력 이스케이프
    const safeTitle = escapeHtml(game.title);
    const safeThumbnail = escapeHtml(game.thumbnail);
    const safeEpicUrl = sanitizeUrl(game.epicUrl || game.epic_url);
    const safeGenreList = genreList.map(g => escapeHtml(g));

    // 평점 배지 HTML
    const ratingBadgesHTML = createRatingBadges(game.rating);

    // 상태 배지 결정 (무료/예정/종료)
    let statusBadge = '';
    if (isEnded) {
        statusBadge = '<span class="badge-ended" role="status">Ended</span>';
    } else if (isCurrent) {
        statusBadge = '<span class="badge-free" role="status">Free</span>';
    } else {
        statusBadge = '<span class="badge-upcoming" role="status">Upcoming</span>';
    }

    // 시간 정보 HTML (상태별)
    let timeInfoHTML = '';
    if (isEnded) {
        // 종료: 하이브리드 텍스트 표시
        const endedText = formatEndedTime(end);
        timeInfoHTML = `<span class="game-card__time-info game-card__time-info--ended">${endedText}</span>`;
    } else if (isCurrent) {
        // 무료: 종료까지 카운트다운
        timeInfoHTML = createFreeCountdownHTML(end);
    } else if (isUpcoming) {
        // 예정: 시작까지 카운트다운
        timeInfoHTML = createCountdownTimerHTML(start);
    }

    // 카드 클래스 결정
    const hasGenres = safeGenreList.length > 0;
    const noGenresClass = hasGenres ? '' : ' game-card--no-genres';
    const cardClass = (isUpcoming ? 'game-card game-card--upcoming' :
                      isEnded ? 'game-card game-card--ended' : 'game-card') + noGenresClass;

    // 카드 내용 HTML (새 레이아웃)
    const cardContent = `
        <div class="game-card__image-wrapper">
            <img
                class="game-card__image"
                src="${safeThumbnail}"
                alt="${safeTitle}"
                loading="lazy"
                data-fallback="true"
            >
            ${ratingBadgesHTML}
        </div>
        <div class="game-card__content">
            <div class="game-card__header">
                <div class="game-card__title-row">
                    <h2 class="game-card__title" title="${safeTitle}">${safeTitle}</h2>
                    ${statusBadge}
                </div>
                ${timeInfoHTML}
            </div>
            ${safeGenreList.length > 0 ? `
                <div class="game-card__genres">
                    ${safeGenreList.map(g => `<span class="genre-tag">${g}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;

    // URL이 있으면 링크로 감싸기, 없으면 article로
    if (safeEpicUrl && safeEpicUrl !== '#') {
        return `
            <a class="${cardClass}" href="${safeEpicUrl}" target="_blank" rel="noopener" aria-label="${safeTitle} - View on Epic Store">
                ${cardContent}
            </a>
        `;
    } else {
        return `
            <article class="${cardClass} game-card--no-link">
                ${cardContent}
            </article>
        `;
    }
}

// formatDate 등은 utils.js에서 로드됨 (HTML에서 utils.js 먼저 로드)

// === Countdown Functions ===

// 전역 타이머 변수
let countdownTimer = null;
let isPageVisible = true;

/**
 * 예정 게임용 카운트다운 타이머 HTML 생성
 * 포맷: "01일 23시 12분 50초"
 * @param {string} startTime - ISO 8601 형식의 시작 시간
 * @returns {string} 카운트다운 타이머 HTML
 */
function createCountdownTimerHTML(startTime) {
    const now = new Date();
    const start = new Date(startTime);
    const diffMs = start - now;

    if (diffMs <= 0) {
        return `<span class="game-card__time-info game-card__time-info--free">Starting soon!</span>`;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const timeText = `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

    return `
        <span class="game-card__time-info game-card__time-info--upcoming"
              data-countdown-timer="${startTime}"
              role="timer"
              aria-live="polite"
              aria-label="Starts in ${timeText}">${timeText}</span>
    `.trim();
}

/**
 * 모든 카운트다운 타이머 업데이트 (1초마다)
 */
function updateAllCountdowns() {
    // 예정 게임 카운트다운 (시작까지)
    document.querySelectorAll('[data-countdown-timer]').forEach(el => {
        const startTime = el.dataset.countdownTimer;
        const now = new Date();
        const start = new Date(startTime);
        const diffMs = start - now;

        if (diffMs <= 0) {
            // 만료됨 - 페이지 새로고침 유도
            el.outerHTML = `
                <span class="game-card__time-info game-card__time-info--free" style="cursor: pointer;"
                      onclick="location.reload()">
                    Free now! (Refresh)
                </span>
            `;
            return;
        }

        const totalSeconds = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const timeText = `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
        el.textContent = timeText;

        // ARIA 라벨 업데이트 (스크린 리더용 - 10초마다만)
        if (seconds % 10 === 0) {
            el.setAttribute('aria-label', `Starts in ${timeText}`);
        }
    });

    // 무료 게임 카운트다운 (종료까지)
    document.querySelectorAll('[data-countdown-free]').forEach(el => {
        const endTime = el.dataset.countdownFree;
        const now = new Date();
        const end = new Date(endTime);
        const diffMs = end - now;

        if (diffMs <= 0) {
            // 종료됨 - 페이지 새로고침 유도
            el.outerHTML = `
                <span class="game-card__time-info game-card__time-info--ended" style="cursor: pointer;"
                      onclick="location.reload()">
                    Ended (Refresh)
                </span>
            `;
            return;
        }

        const totalSeconds = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const timeText = `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
        el.textContent = timeText;

        // ARIA 라벨 업데이트 (스크린 리더용 - 10초마다만)
        if (seconds % 10 === 0) {
            el.setAttribute('aria-label', `Free download ends in ${timeText}`);
        }
    });
}

/**
 * 카운트다운 시작 (1초 간격)
 */
function startCountdowns() {
    stopCountdowns(); // 중복 방지
    updateAllCountdowns(); // 즉시 1회 실행

    countdownTimer = setInterval(() => {
        if (isPageVisible) {
            updateAllCountdowns();
        }
    }, 1000); // 1초마다 업데이트
}

/**
 * 카운트다운 정지
 */
function stopCountdowns() {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

/**
 * 페이지 가시성 핸들러 설정
 */
function setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
        isPageVisible = !document.hidden;

        if (isPageVisible) {
            // 탭 재활성화 시 즉시 업데이트
            updateAllCountdowns();
        }
    });
}

/**
 * 정리 로직 설정
 */
function setupCleanup() {
    const cleanup = () => stopCountdowns();

    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
}

// 이미지 로드 실패 시 fallback 처리 (인라인 onerror 대신 이벤트 위임 - CSP 호환)
document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.dataset.fallback === 'true') {
        e.target.src = 'https://via.placeholder.com/400x225?text=No+Image';
        e.target.dataset.fallback = 'used';
    }
}, true);
