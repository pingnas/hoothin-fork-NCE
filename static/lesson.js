(() => {
    document.addEventListener('DOMContentLoaded', () => {

        /** 正则常量 */
        const LINE_RE = /\[(\d+:\d+\.\d+)\](.*)/;
        const TIME_RE = /\[(\d+):(\d+(?:\.\d+)?)\]/;
        const INFO_RE = {
            album: /\[al:(.*)\]/,
            artist: /\[ar:(.*)\]/,
            title: /\[ti:(.*)\]/
        };

        /** 读取 URL hash 并构造资源路径 */
        const filename = location.hash.slice(1).split('?')[0];
        if (!filename) {
            window.location.href = "book.html"
        }
        const book = filename.split('/').shift()
        const bookScr = `book.html#${book}`;
        const bookImgSrc = `images/${book}.jpg`;
        const mp3Src = `${filename}.mp3`;
        const lrcSrc = `${filename}.lrc`;

        /** DOM 引用 */
        const audio = document.getElementById('player');
        const content = document.getElementById('content');
        const bookEl = document.getElementById('book');
        const bookTitleEl = document.getElementById('book-title');
        const bookImgEl = document.getElementById('book-img');
        const lessonTitleEl = document.getElementById('lesson-title');
        const modesContainer = document.getElementById('playback-modes');
        const setAButton = document.getElementById('set-a');
        const setBButton = document.getElementById('set-b');
        const speedContainer = document.getElementById('playback-speed');
        const dictationModeCheckbox = document.getElementById('dictation-mode');
        const dictationContainer = document.getElementById('dictation-container');

        // Custom player controls
        const playPauseBtn = document.getElementById('play-pause-btn');
        const progressBar = document.getElementById('progress-bar');
        const progress = document.getElementById('progress');
        const timeDisplay = document.getElementById('time-display');
        const volumeBtn = document.getElementById('volume-btn');
        const volumeSlider = document.getElementById('volume-slider');

        /** 数据结构 */
        const state = {
            data: [],          // [{en, cn, start, end}]
            album: '',
            artist: '',
            title: '',
            segmentEnd: 0,
            activeIdx: -1,
            playbackMode: 'single-play', // 'single-play', 'single-loop', 'continuous', 'ab-loop'
            dictation: false,
            abLoop: { a: null, b: null }
        };
        audio.src = mp3Src;
        bookImgEl.src = bookImgSrc;
        bookImgEl.alt = book;

        /** ------------------------------------------------- 
         *  Utilities
         * ------------------------------------------------- */
        function formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
        }

        /** ------------------------------------------------- 
         *  元信息解析
         * ------------------------------------------------- */
        function parseInfo(line) {
            for (const key in INFO_RE) {
                const m = line.match(INFO_RE[key]);
                if (m) state[key] = m[1];
            }
        }

        /** ------------------------------------------------- 
         *  时间解析
         * ------------------------------------------------- */
        function parseTime(tag) {
            const m = TIME_RE.exec(tag);
            return m ? parseInt(m[1], 10) * 60 + parseFloat(m[2]) -0.5 : 0;
        }

        /** ------------------------------------------------- 
         *  LRC 解析
         * ------------------------------------------------- */
        async function loadLrc() {
            const lrcRes = await fetch(lrcSrc);
            const text = await lrcRes.text();
            const lines = text.split(/\r?\n/).filter(Boolean);

            lines.forEach((raw, i) => {
                const line = raw.trim();
                const match = line.match(LINE_RE);

                if (!match) {
                    parseInfo(line);
                    return;
                }

                const start = parseTime(`[${match[1]}]`);
                const [en, cn = ''] = match[2].split('|').map(s => s.trim());

                let end = 0;
                for (let j = i + 1; j < lines.length; j++) {
                    const nxt = lines[j].match(LINE_RE);
                    if (nxt) {
                        end = parseTime(`[${nxt[1]}]`);
                        break;
                    }
                }
                state.data.push({en, cn, start, end});
            });
            render();
        }


        /** ------------------------------------------------- 
         *  渲染
         * ------------------------------------------------- */
        function render() {
            bookEl.href = bookScr;
            bookTitleEl.textContent = state.album;
            lessonTitleEl.textContent = state.title;

            content.innerHTML = state.data.map(
                (item, idx) =>
                    `<div class="sentence" data-idx="${idx}">
                    <div class="en">${item.en}</div>
                    <div class="cn">${item.cn}</div>
                </div>`
            ).join('');
        }

        /** ------------------------------------------------- 
         *  播放区间
         * ------------------------------------------------- */
        function playSegment(start, end) {
            state.segmentEnd = end
            audio.currentTime = start;
            audio.play();
        }

        /** ------------------------------------------------- 
         *  高亮 & 自动滚动
         * ------------------------------------------------- */
        function highlight(idx, options = {}) {
            const { force = false } = options;
            if (idx === state.activeIdx && !force) return;

            // Clean up any previous dictation input
            const oldInput = content.querySelector('.dictation-input');
            if (oldInput) {
                const parentSentence = oldInput.closest('.sentence');
                if (parentSentence) {
                    parentSentence.querySelector('.en').style.display = '';
                }
                oldInput.remove();
            }

            const prev = content.querySelector('.sentence.active');
            if (prev) prev.classList.remove('active');

            const cur = content.querySelector(`.sentence[data-idx="${idx}"]`);
            if (cur) {
                cur.classList.add('active');
                const scrollBlockPosition = state.dictation ? 'start' : 'center';
                cur.scrollIntoView({behavior: 'smooth', block: scrollBlockPosition});

                const enDiv = cur.querySelector('.en');
                if (state.dictation && state.playbackMode === 'single-play') {
                    activateDictationForSentence(cur, idx);
                } else {
                    if (enDiv) enDiv.style.display = '';
                }
            }
            state.activeIdx = idx;
        }

        function activateDictationForSentence(sentenceEl, idx) {
            const enDiv = sentenceEl.querySelector('.en');
            if (enDiv) {
                enDiv.style.display = 'none';
            }

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'dictation-input';
            input.placeholder = '请输入英文句子...';
            sentenceEl.appendChild(input);
            input.focus();

            const correctAnswer = state.data[idx].en.replace(/[^a-zA-Z]/g, '').toLowerCase();

            input.addEventListener('input', e => {
                const userInput = e.target.value.replace(/[^a-zA-Z]/g, '').toLowerCase();

                if (userInput === correctAnswer) {
                    input.disabled = true;
                    const nextIdx = idx + 1;
                    if (nextIdx < state.data.length) {
                        const { start, end } = state.data[nextIdx];
                        playSegment(start, end);
                    } else {
                        audio.pause();
                        // Last sentence finished, clean up the UI
                        input.remove();
                        if (enDiv) {
                            enDiv.style.display = '';
                        }
                        sentenceEl.classList.remove('active');
                        state.activeIdx = -1;
                    }
                }
            });
        }

        /** ------------------------------------------------- 
         *  Custom Player Logic
         * ------------------------------------------------- */
        playPauseBtn.addEventListener('click', () => {
            if (audio.paused) {
                if (state.activeIdx !== -1) {
                    // If there's an active sentence, play from its start
                    const { start, end } = state.data[state.activeIdx];
                    playSegment(start, end);
                } else {
                    // If no active sentence, play from the beginning of the first sentence
                    const { start, end } = state.data[0];
                    playSegment(start, end);
                }
            } else {
                audio.pause();
            }
        });

        audio.addEventListener('play', () => {
            playPauseBtn.classList.remove('play');
            playPauseBtn.classList.add('pause');
        });

        audio.addEventListener('pause', () => {
            playPauseBtn.classList.remove('pause');
            playPauseBtn.classList.add('play');
        });

        audio.addEventListener('loadedmetadata', () => {
            timeDisplay.textContent = `${formatTime(0)} / ${formatTime(audio.duration)}`;
        });

        progressBar.addEventListener('click', e => {
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = progressBar.clientWidth;
            const duration = audio.duration;
            audio.currentTime = (clickX / width) * duration;
        });

        volumeBtn.addEventListener('click', () => {
            audio.muted = !audio.muted;
        });

        audio.addEventListener('volumechange', () => {
            if (audio.muted || audio.volume === 0) {
                volumeBtn.classList.remove('volume-high');
                volumeBtn.classList.add('volume-muted');
                volumeSlider.value = 0;
            } else {
                volumeBtn.classList.remove('volume-muted');
                volumeBtn.classList.add('volume-high');
                volumeSlider.value = audio.volume;
            }
        });

        volumeSlider.addEventListener('input', e => {
            audio.volume = e.target.value;
            audio.muted = e.target.value === '0';
        });


        /** ------------------------------------------------- 
         *  事件绑定（委托）
         * ------------------------------------------------- */
        content.addEventListener('click', e => {
            const target = e.target.closest('.sentence');
            if (!target) return;
            const idx = Number(target.dataset.idx);
            const {start, end} = state.data[idx];
            playSegment(start, end);
        });

        dictationModeCheckbox.addEventListener('change', e => {
            state.dictation = e.target.checked;

            // Re-render the current sentence to apply/remove dictation view
            if (state.activeIdx !== -1) {
                highlight(state.activeIdx, { force: true });
            }

            // If dictation is turned ON and audio is paused, start playing.
            if (state.dictation && audio.paused) {
                let playIndex = state.activeIdx;

                // If no sentence is active, start from the beginning.
                if (playIndex === -1) {
                    playIndex = 0;
                }

                // Ensure the index is valid before trying to play.
                if (playIndex >= 0 && playIndex < state.data.length) {
                    const { start, end } = state.data[playIndex];
                    playSegment(start, end);
                }
            }
        });

        modesContainer.addEventListener('click', e => {
            if (e.target.tagName !== 'BUTTON') return;

            const mode = e.target.id.replace('mode-', '');
            if (['single-play', 'single-loop', 'continuous', 'ab-loop'].includes(mode)) {
                state.playbackMode = mode;
                localStorage.setItem('playbackMode', mode);

                // Update active button
                for (const child of modesContainer.children) {
                    child.classList.remove('active');
                }
                e.target.classList.add('active');

                // Show/hide A-B buttons
                if (mode === 'ab-loop') {
                    setAButton.style.display = 'inline-block';
                    setBButton.style.display = 'inline-block';
                } else {
                    setAButton.style.display = 'none';
                    setBButton.style.display = 'none';
                }

                // Handle dictation mode availability
                if (mode === 'single-play') {
                    dictationContainer.style.display = '';
                } else {
                    dictationContainer.style.display = 'none';
                    dictationModeCheckbox.checked = false;
                    state.dictation = false;
                    // If a sentence is active, re-highlight to remove dictation input
                    if (state.activeIdx !== -1) {
                        highlight(state.activeIdx, { force: true });
                    }
                }

                if (audio.paused) {
                    if (state.activeIdx !== -1) {
                        // If there's an active sentence, play from its start
                        let nextIdx = state.activeIdx;
                        if (mode === 'single-play' || mode === 'continuous') {
                            nextIdx++;
                        }
                        if (nextIdx === state.data.length) {
                            nextIdx = 0;
                        }
                        const { start, end } = state.data[nextIdx];
                        playSegment(start, end);
                    } else {
                        // If no active sentence, play from the beginning of the first sentence
                        const { start, end } = state.data[0];
                        playSegment(start, end);
                    }
                }
            }
        });

        setAButton.addEventListener('click', () => {
            if (state.activeIdx !== -1) {
                state.abLoop.a = state.data[state.activeIdx].start;
                setAButton.textContent = `A: ${state.abLoop.a.toFixed(1)}`;
                // Reset B if A is set after B
                state.abLoop.b = null;
                setBButton.textContent = '设置B点';
            }
        });

        setBButton.addEventListener('click', () => {
            if (state.activeIdx !== -1 && state.abLoop.a !== null) {
                const bPoint = state.data[state.activeIdx].end;
                if (bPoint > state.abLoop.a) {
                    state.abLoop.b = bPoint;
                    setBButton.textContent = `B: ${state.abLoop.b.toFixed(1)}`;
                    // Start playing the loop
                    audio.currentTime = state.abLoop.a;
                    audio.play();
                }
            }
        });

        speedContainer.addEventListener('click', e => {
            if (e.target.tagName !== 'BUTTON') return;

            const speed = e.target.id.replace('speed-', ''); // e.g., '1x', '3x'
            audio.playbackRate = parseFloat(speed);
            localStorage.setItem('playbackSpeed', speed);

            // Update active button
            for (const child of speedContainer.children) {
                child.classList.remove('active');
            }
            e.target.classList.add('active');
        });

        audio.addEventListener('timeupdate', () => {
            const cur = audio.currentTime;
            const duration = audio.duration;

            // Update progress bar and time display
            if (duration) {
                progress.style.width = `${(cur / duration) * 100}%`;
                timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(duration)}`;
            }

            // A-B Loop logic
            if (state.playbackMode === 'ab-loop' && state.abLoop.a !== null && state.abLoop.b !== null && cur >= state.abLoop.b) {
                audio.currentTime = state.abLoop.a;
                return; // Return to avoid other logic
            }

            // Sentence-based logic for other modes
            if (state.segmentEnd && cur >= state.segmentEnd) {
                let shouldReturn = true;
                switch (state.playbackMode) {
                    case 'single-play':
                        audio.pause();
                        // By returning here, we prevent the findIndex and highlight logic below from running,
                        // which stops the highlight from jumping to the next sentence.
                        return;
                    case 'single-loop':
                        if (state.activeIdx !== -1) {
                            const { start } = state.data[state.activeIdx];
                            audio.currentTime = start;
                        }
                        break;
                    case 'continuous':
                    case 'ab-loop':
                        const nextIdx = state.activeIdx + 1;
                        if (state.activeIdx !== -1 && nextIdx < state.data.length) {
                            const {start, end} = state.data[nextIdx];
                            playSegment(start, end);
                            shouldReturn = false; // Allow highlight to update
                        } else {
                            audio.pause();
                            state.segmentEnd = 0;
                        }
                        break;
                }
                if (shouldReturn) return;
            }

            // Find and highlight current sentence
            const idx = state.data.findIndex(
                item => cur >= item.start && (cur < item.end || !item.end)
            );
            if (idx !== -1) highlight(idx);
        });

        function loadSettings() {
            const savedMode = localStorage.getItem('playbackMode') || 'single-play';
            const savedSpeed = localStorage.getItem('playbackSpeed') || '1x';

            // Apply mode
            state.playbackMode = savedMode;
            document.getElementById(`mode-${savedMode}`).classList.add('active');
            if (savedMode === 'ab-loop') {
                setAButton.style.display = 'inline-block';
                setBButton.style.display = 'inline-block';
            }

            // Handle dictation mode availability on load
            if (savedMode === 'single-play') {
                dictationContainer.style.display = '';
            } else {
                dictationContainer.style.display = 'none';
            }

            // Apply speed
            audio.playbackRate = parseFloat(savedSpeed);
            document.getElementById(`speed-${savedSpeed}`).classList.add('active');
        }

        document.addEventListener('keydown', e => {
            if (!state.dictation) return;

            const dictationInput = content.querySelector('.dictation-input');
            if (!dictationInput) return;

            // If focus is already on an interactive element, do nothing.
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
                return;
            }

            dictationInput.focus();
        });

        // 初始化
        loadSettings();
        loadLrc().then(r => {
            console.log("LRC Data:", JSON.stringify(state.data, null, 2));
        });

        // Lesson navigation functionality
        const prevLessonBtn = document.getElementById('prev-lesson');
        const nextLessonBtn = document.getElementById('next-lesson');
        let lessonsData = {};
        let currentBook = null;
        let currentLessonIndex = -1;

        // Load lessons data
        async function loadLessonsData() {
            try {
                const dataRes = await fetch('static/data.json');
                lessonsData = await dataRes.json();
                updateNavigationButtons();
            } catch (error) {
                console.error('Failed to load lessons data:', error);
            }
        }

        // Update navigation buttons state
        function updateNavigationButtons() {
            const hash = location.hash.slice(1).split('?')[0];
            if (!hash) return;

            const parts = hash.split('/');
            currentBook = parts[0].replace('NCE', '');
            const currentFilename = decodeURIComponent(parts[1]);

            const lessons = lessonsData[currentBook];
            if (!lessons) {
                console.log('No lessons found for book:', currentBook);
                return;
            }

            currentLessonIndex = lessons.findIndex(lesson => lesson.filename === currentFilename);

            console.log('Current book:', currentBook);
            console.log('Current filename:', currentFilename);
            console.log('Current lesson index:', currentLessonIndex);

            // Update button states
            prevLessonBtn.disabled = currentLessonIndex <= 0;
            nextLessonBtn.disabled = currentLessonIndex >= lessons.length - 1;
        }

        // Navigate to previous lesson
        prevLessonBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (currentLessonIndex > 0) {
                const prevLesson = lessonsData[currentBook][currentLessonIndex - 1];
                window.location.href = `lesson.html#NCE${currentBook}/${prevLesson.filename}`;
                window.location.reload();
            }
        });

        // Navigate to next lesson
        nextLessonBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (currentLessonIndex < lessonsData[currentBook].length - 1) {
                const nextLesson = lessonsData[currentBook][currentLessonIndex + 1];
                window.location.href = `lesson.html#NCE${currentBook}/${nextLesson.filename}`;
                window.location.reload();
            }
        });

        // Initialize navigation
        loadLessonsData();

    })
})();