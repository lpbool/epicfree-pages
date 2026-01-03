// Epic Free Games - Shared Utilities

/**
 * 숫자를 2자리 문자열로 패딩
 * @param {number} n - 패딩할 숫자
 * @returns {string} 2자리 문자열
 */
function pad(n) {
    return String(n).padStart(2, '0');
}

/**
 * XSS 방어: HTML 특수문자 이스케이프
 * @param {string} unsafe - 이스케이프할 문자열
 * @returns {string} 안전한 문자열
 */
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * URL 프로토콜 검증 (javascript:, data: 등 위험한 프로토콜 차단)
 * @param {string} url - 검증할 URL
 * @returns {string} 안전한 URL 또는 '#'
 */
function sanitizeUrl(url) {
    if (!url) return '';
    const urlStr = url.toString().trim().toLowerCase();

    // 위험한 프로토콜 차단
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerousProtocols.some(proto => urlStr.startsWith(proto))) {
        console.warn('Dangerous URL protocol blocked:', url);
        return '#';
    }

    // https:// 또는 http://만 허용
    if (urlStr && !/^https?:\/\//i.test(urlStr)) {
        console.warn('Invalid URL protocol:', url);
        return '#';
    }

    return escapeHtml(url);
}

/**
 * 날짜 포맷팅 (영어)
 * @param {Date} date - 포맷팅할 날짜
 * @returns {string} 포맷된 문자열
 */
function formatDate(date) {
    // Invalid Date 방어
    if (isNaN(date.getTime())) {
        return 'Date unavailable';
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 게임 목록 정렬 (카테고리별 최적 순서)
 * - 무료: 종료 시간 오름차순 (마감 임박 먼저)
 * - 예정: 시작 시간 오름차순 (곧 시작 먼저)
 * - 종료: 종료 시간 내림차순 (최근 종료 먼저)
 * @param {Array} games - 게임 목록
 * @returns {Array} 정렬된 게임 목록
 */
function sortGames(games) {
    const getStart = (g) => g.freePeriod?.start || g.free_start;
    const getEnd = (g) => g.freePeriod?.end || g.free_end;
    const getName = (g) => (g.title || '').toLowerCase();

    // 카테고리별 분리
    const current = games.filter(g => g.isCurrent);
    const upcoming = games.filter(g => g.isUpcoming);
    const past = games.filter(g => g.isEnded);

    // 무료: 종료 시간 오름차순, 동일 시 이름순
    current.sort((a, b) => {
        const timeDiff = new Date(getEnd(a)) - new Date(getEnd(b));
        return timeDiff !== 0 ? timeDiff : getName(a).localeCompare(getName(b));
    });

    // 예정: 시작 시간 오름차순, 동일 시 이름순
    upcoming.sort((a, b) => {
        const timeDiff = new Date(getStart(a)) - new Date(getStart(b));
        return timeDiff !== 0 ? timeDiff : getName(a).localeCompare(getName(b));
    });

    // 종료: 종료 시간 내림차순, 동일 시 이름순
    past.sort((a, b) => {
        const timeDiff = new Date(getEnd(b)) - new Date(getEnd(a));
        return timeDiff !== 0 ? timeDiff : getName(a).localeCompare(getName(b));
    });

    return [...current, ...upcoming, ...past];
}
