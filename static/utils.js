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

    function normalizeShareOptions(rawOptions = {}) {
        const win = typeof window !== 'undefined' ? window : null;
        const doc = typeof document !== 'undefined' ? document : null;
        const baseUrl = rawOptions.url || (win && win.location ? win.location.href : '');
        let url = String(baseUrl || '').trim();
        if (url && win) {
            try {
                url = new URL(url, win.location.href).toString();
            } catch (_) {
                url = String(url);
            }
        }
        const titleSource = rawOptions.title || (doc ? doc.title : '');
        const descriptionSource = rawOptions.description || rawOptions.summary || '';
        const textSource = rawOptions.text || '';
        const imageSource = rawOptions.image || rawOptions.pic || '';
        return {
            url,
            title: String(titleSource || '').trim(),
            description: String(descriptionSource || '').trim(),
            text: String(textSource || '').trim(),
            image: String(imageSource || '').trim()
        };
    }

    function detectShareEnvironment() {
        const win = typeof window !== 'undefined' ? window : null;
        if (!win || typeof navigator === 'undefined') {
            return {
                isMobile: false,
                isWeChatBrowser: false
            };
        }
        const ua = navigator.userAgent || navigator.vendor || '';
        const isWeChatBrowser = /micromessenger/i.test(ua);
        const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
        return {
            isMobile,
            isWeChatBrowser
        };
    }

    function buildSharePayload(target, options = {}) {
        const normalizedTarget = String(target || '').toLowerCase();
        const { url, title, description, text, image } = normalizeShareOptions(options);
        const composedText = [text, title, description].filter(Boolean).join(' ') || url;
        const searchPic = options.searchPic === false ? '0' : '1';
        switch (normalizedTarget) {
            case 'weibo': {
                const params = new URLSearchParams();
                if (url) params.set('url', url);
                if (composedText) params.set('title', composedText);
                if (image) params.set('pic', image);
                params.set('searchPic', searchPic);
                return {
                    platform: 'weibo',
                    mode: 'popup',
                    url: `https://service.weibo.com/share/share.php?${params.toString()}`
                };
            }
            case 'qq': {
                const params = new URLSearchParams();
                if (url) params.set('url', url);
                if (title || text) params.set('title', title || text);
                if (description) params.set('summary', description);
                if (image) params.set('pics', image);
                return {
                    platform: 'qq',
                    mode: 'popup',
                    url: `https://connect.qq.com/widget/shareqq/index.html?${params.toString()}`
                };
            }
            case 'qzone': {
                const params = new URLSearchParams();
                if (url) params.set('url', url);
                if (title) params.set('title', title);
                if (description) params.set('desc', description);
                if (composedText) params.set('summary', composedText);
                if (image) params.set('pics', image);
                return {
                    platform: 'qzone',
                    mode: 'popup',
                    url: `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?${params.toString()}`
                };
            }
            case 'wechat': {
                const env = detectShareEnvironment();
                if (env.isWeChatBrowser) {
                    return {
                        platform: 'wechat',
                        mode: 'wechat-internal',
                        url,
                        title: title || composedText,
                        text: composedText
                    };
                }
                const preferNative = env.isMobile && typeof navigator !== 'undefined' && typeof navigator.share === 'function';
                if (preferNative) {
                    return {
                        platform: 'wechat',
                        mode: 'native',
                        url,
                        title: title || composedText,
                        text: composedText
                    };
                }
                const sizeOption = Number.isFinite(options.qrSize) ? Math.round(options.qrSize) : 180;
                const size = Math.min(Math.max(sizeOption, 80), 512);
                const qrUrl = url ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}` : '';
                return {
                    platform: 'wechat',
                    mode: 'qr',
                    url,
                    qrImage: qrUrl,
                    title: title || composedText
                };
            }
            case 'native': {
                return {
                    platform: 'native',
                    mode: 'native',
                    url,
                    title: title || '',
                    text: composedText
                };
            }
            case 'copy': {
                return {
                    platform: 'copy',
                    mode: 'copy',
                    url,
                    text: composedText
                };
            }
            default:
                return {
                    platform: normalizedTarget || 'generic',
                    mode: 'link',
                    url,
                    title,
                    text: composedText,
                    description,
                    image
                };
        }
    }

    function openShare(target, options = {}) {
        const payload = buildSharePayload(target, options);
        if (!payload) {
            return null;
        }
        const win = typeof window !== 'undefined' ? window : null;
        if (payload.mode === 'popup' && payload.url && win) {
            const features = options.windowFeatures || 'width=600,height=540,top=100,left=100,toolbar=no,menubar=no,scrollbars=yes,resizable=yes';
            win.open(payload.url, '_blank', features);
        } else if (payload.mode === 'native' && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            const shareData = {
                title: payload.title || options.title || '',
                text: payload.text || options.text || '',
                url: payload.url || options.url || ''
            };
            navigator.share(shareData).catch(() => {
                /* noop */
            });
        } else if (payload.mode === 'copy' && options.autoCopy !== false && typeof navigator !== 'undefined' && navigator.clipboard && payload.url) {
            navigator.clipboard.writeText(payload.url).catch(() => {
                /* noop */
            });
        }
        return payload;
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
        getCustomLessonsWithDefaults,
        detectShareEnvironment,
        buildSharePayload,
        openShare
    };

    if (typeof window !== 'undefined') {
        window.NCEUtils = Object.freeze(utils);
    }
})();
