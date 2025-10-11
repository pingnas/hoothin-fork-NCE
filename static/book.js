(() => {
    document.addEventListener('DOMContentLoaded', () => {
        /** 读取 URL hash 并构造资源路径 */
        const idx = location.hash.slice(1).split('?')[0];
        let bookNumber = parseInt(idx.replace("NCE", "")) || 1;
        let lessonsData = {}

        // 显示当前课本
        function showBook(num) {
            // 隐藏所有课本
            for (let i = 1; i <= 4; i++) {
                document.getElementById(`book-${i}`).classList.remove('active');
            }
            // 显示当前课本
            document.getElementById(`book-${num}`).classList.add('active');

            // 更新按钮状态
            const prevButtons = document.querySelectorAll('#prev-book');
            const nextButtons = document.querySelectorAll('#next-book');

            prevButtons.forEach(btn => btn.disabled = (num === 1));
            nextButtons.forEach(btn => btn.disabled = (num === 4));

            // 更新 URL hash
            location.hash = `NCE${num}`;
            bookNumber = num;
        }

        showBook(bookNumber);

        // 为所有上一本按钮添加事件监听
        document.querySelectorAll('#prev-book').forEach(btn => {
            btn.addEventListener('click', () => {
                if (bookNumber > 1) {
                    showBook(bookNumber - 1);
                }
            });
        });

        // 为所有下一本按钮添加事件监听
        document.querySelectorAll('#next-book').forEach(btn => {
            btn.addEventListener('click', () => {
                if (bookNumber < 4) {
                    showBook(bookNumber + 1);
                }
            });
        });

        // 监听 hash 变化
        window.addEventListener('hashchange', () => {
            const idx = location.hash.slice(1).split('?')[0];
            const newBookNumber = parseInt(idx.replace("NCE", "")) || 1;
            if (newBookNumber !== bookNumber && newBookNumber >= 1 && newBookNumber <= 4) {
                showBook(newBookNumber);
            }
        });

        loadData().then(() => {
            // 初始化所有课文列表
            for (let i = 1; i <= 4; i++) {
                generateLessons(i);
            }
        })

        async function loadData() {
            const dataSrc = 'static/data.json';
            const dataRes = await fetch(dataSrc);
            lessonsData = await dataRes.json();
        }

        // 生成课文列表的函数
        function generateLessons(bookNumber) {
            const container = document.getElementById(`book-${bookNumber}-lessons`);
            const lessons = lessonsData[bookNumber];

            container.innerHTML = '';
            lessons.forEach((lesson, index) => {
                let lessonNumber = index + 1
                if (bookNumber === 1) {
                    lessonNumber = index * 2 + 1;
                    lessonNumber = `${lessonNumber}&${lessonNumber+1}`;
                }
                const lessonElement = document.createElement('a');
                lessonElement.href = `lesson.html#NCE${bookNumber}/${lesson.filename}`;
                lessonElement.className = 'lesson-item';
                lessonElement.innerHTML = `
                    <span class="lesson-number">第${lessonNumber}课</span>
                    <span class="lesson-title">${lesson.title}</span>
                `;
                container.appendChild(lessonElement);
            });
        }

    })
})()