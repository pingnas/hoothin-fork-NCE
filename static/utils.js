(() => {
    function hashString(input) {
        let hash = 0;
        const str = String(input || '');
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    function escapeForSvg(value) {
        return String(value || '').replace(/[&<>'"]/g, (char) => {
            switch (char) {
                case '&':
                    return '&amp;';
                case '<':
                    return '&lt;';
                case '>':
                    return '&gt;';
                case '"':
                    return '&quot;';
                case '\'':
                    return '&#39;';
                default:
                    return char;
            }
        });
    }

    function createPlaceholderCover(label, options = {}) {
        const base = (label || '自定义').trim();
        const displayText = base ? base.slice(0, 4) : '自定义';
        const width = Number.isFinite(options.width) ? options.width : 200;
        const height = Number.isFinite(options.height) ? options.height : 200;
        const fontSize = Number.isFinite(options.fontSize) ? options.fontSize : Math.round(Math.min(width, height) * 0.24);
        const colors = ['#1DB954', '#4CAF50', '#2ECC71', '#27AE60', '#00BFA5'];
        const color = colors[Math.abs(hashString(base)) % colors.length];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <defs>
                <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${color}" stop-opacity="0.85"/>
                    <stop offset="100%" stop-color="${color}" stop-opacity="0.45"/>
                </linearGradient>
            </defs>
            <rect width="${width}" height="${height}" rx="${Math.round(Math.min(width, height) * 0.04)}" fill="url(#g)"/>
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF"
                font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${fontSize}">
                ${escapeForSvg(displayText)}
            </text>
        </svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function deriveLrcUrl(filename) {
        if (!filename) {
            return '';
        }
        const queryIndex = filename.indexOf('?');
        const hashIndex = filename.indexOf('#');
        let endIndex = filename.length;
        if (queryIndex !== -1) {
            endIndex = queryIndex;
        }
        if (hashIndex !== -1 && hashIndex < endIndex) {
            endIndex = hashIndex;
        }
        const base = filename.slice(0, endIndex);
        const suffix = filename.slice(endIndex);
        const dotIndex = base.lastIndexOf('.');
        const replaced = dotIndex === -1 ? `${base}.lrc` : `${base.slice(0, dotIndex)}.lrc`;
        return `${replaced}${suffix}`;
    }

    function parseCustomBookKey(rawKey) {
        const str = String(rawKey || '');
        const parts = str.split('|');
        const name = (parts.shift() || '自定义课程').trim() || '自定义课程';
        const cover = parts.length ? parts.join('|').trim() : '';
        return { raw: str, name, cover };
    }

    function loadStoredCustomData() {
        const stored = localStorage.getItem('nceCustomData');
        if (!stored) {
            return null;
        }
        try {
            const parsed = JSON.parse(stored);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    function formatCustomData(data) {
        try {
            return JSON.stringify(data, null, 2);
        } catch (_) {
            return '';
        }
    }

    function sanitizeCustomDataInput(parsed) {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('根对象必须是以书名为键的对象。');
        }
        const sanitized = {};
        Object.keys(parsed).forEach((bookName) => {
            const lessons = parsed[bookName];
            if (!Array.isArray(lessons)) {
                throw new Error(`“${bookName}” 的数据必须是数组。`);
            }
            sanitized[bookName] = lessons.map((lesson, index) => {
                if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
                    throw new Error(`“${bookName}” 第 ${index + 1} 项必须是对象。`);
                }
                const title = lesson.title ? String(lesson.title).trim() : '';
                const filename = lesson.filename ? String(lesson.filename).trim() : '';
                if (!title || !filename) {
                    throw new Error(`“${bookName}” 第 ${index + 1} 项缺少 title 或 filename。`);
                }
                const sanitizedLesson = { title, filename };
                const lrc = lesson.lrc ? String(lesson.lrc).trim() : '';
                if (lrc) {
                    sanitizedLesson.lrc = lrc;
                }
                return sanitizedLesson;
            });
        });
        return sanitized;
    }

    function prepareCustomLessons(raw, options = {}) {
        const derive = options.deriveLrc !== false;
        const filterEmpty = options.filterEmpty !== false;
        const prepared = {};
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return prepared;
        }
        Object.keys(raw).forEach((bookName) => {
            const lessons = Array.isArray(raw[bookName]) ? raw[bookName] : [];
            const normalized = lessons
                .map((lesson) => {
                    if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
                        return null;
                    }
                    const title = lesson.title ? String(lesson.title).trim() : '';
                    const filename = lesson.filename ? String(lesson.filename).trim() : '';
                    if (!title || !filename) {
                        return null;
                    }
                    const preparedLesson = { title, filename };
                    const lrc = lesson.lrc ? String(lesson.lrc).trim() : '';
                    preparedLesson.lrc = lrc || (derive ? deriveLrcUrl(filename) : '');
                    if (!preparedLesson.lrc) {
                        delete preparedLesson.lrc;
                    }
                    return preparedLesson;
                })
                .filter(Boolean);
            if (normalized.length || !filterEmpty) {
                prepared[bookName] = normalized;
            }
        });
        return prepared;
    }

    function getCustomLessonsWithDefaults() {
        const raw = loadStoredCustomData();
        return prepareCustomLessons(raw, { deriveLrc: true });
    }

    const utils = {
        hashString,
        escapeForSvg,
        createPlaceholderCover,
        deriveLrcUrl,
        parseCustomBookKey,
        loadStoredCustomData,
        formatCustomData,
        sanitizeCustomDataInput,
        prepareCustomLessons,
        getCustomLessonsWithDefaults
    };

    if (typeof window !== 'undefined') {
        window.NCEUtils = Object.freeze(utils);
    }
})();
