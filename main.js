const state = {
    inventory: [],
    currentScene: 'main',
};

const TOTAL_STEPS = 8;

// ── BGM 관리 ──
let bgm = null;

function playBGM() {
    if (bgm) return;
    bgm = new Audio('bgm/bgm.mp3');
    bgm.loop = true;
    bgm.volume = 0.45;
    bgm.play().catch(() => {});
}

// ── 대화창 높이 CSS 변수 동기화 ──
// choices-overlay의 bottom 위치를 정확하게 맞추기 위해
function syncDialogHeight() {
    const dialog = document.querySelector('.dialog-box');
    if (!dialog) return;
    const h = dialog.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--dialog-height', h + 'px');
}

// ResizeObserver: 대화창 크기 변화(폰트 로드, 텍스트 증가) 감지
let dialogObserver = null;

function observeDialog() {
    if (dialogObserver) { dialogObserver.disconnect(); dialogObserver = null; }
    const dialog = document.querySelector('.dialog-box');
    if (!dialog) return;
    syncDialogHeight();
    dialogObserver = new ResizeObserver(() => syncDialogHeight());
    dialogObserver.observe(dialog);
}

// 화면 회전/리사이즈 대응
window.addEventListener('resize', syncDialogHeight);
window.addEventListener('orientationchange', () => {
    // orientationchange 후 레이아웃 재계산까지 약간의 딜레이 필요
    setTimeout(syncDialogHeight, 150);
});

// ── 타이핑 효과 ──
let typingTimer = null;

function typeText(el, html, mathHtml, onDone) {
    const parts = [];
    const tagRegex = /(<[^>]+>)/g;
    let last = 0, m;
    while ((m = tagRegex.exec(html)) !== null) {
        if (m.index > last) parts.push({ type: 'text', val: html.slice(last, m.index) });
        parts.push({ type: 'tag', val: m[0] });
        last = m.index + m[0].length;
    }
    if (last < html.length) parts.push({ type: 'text', val: html.slice(last) });

    const sequence = [];
    let acc = '';
    for (const part of parts) {
        if (part.type === 'tag') {
            acc += part.val;
        } else {
            for (const ch of part.val) {
                acc += ch;
                sequence.push(acc);
            }
        }
    }
    if (sequence.length === 0) sequence.push(acc);

    const SPEED = 38;
    let i = 0;

    // 타이핑 중 dialog-box에 클래스 추가 (TAP TO SKIP 힌트 표시)
    const dialogBox = document.querySelector('.dialog-box');
    if (dialogBox) dialogBox.classList.add('is-typing');

    function finish() {
        if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; }
        if (dialogBox) dialogBox.classList.remove('is-typing');
        el.innerHTML = html + mathHtml + '<span class="cursor"></span>';
        // 타이핑 완료 후 높이 재측정
        syncDialogHeight();
        onDone();
    }

    // 클릭/터치 스킵 (touchend 추가로 모바일 대응)
    const skipHandler = () => finish();
    document.addEventListener('click', skipHandler, { once: true });
    document.addEventListener('touchend', skipHandler, { once: true, passive: true });

    function tick() {
        if (i >= sequence.length) {
            document.removeEventListener('click', skipHandler);
            document.removeEventListener('touchend', skipHandler);
            if (dialogBox) dialogBox.classList.remove('is-typing');
            el.innerHTML = sequence[sequence.length - 1] + mathHtml + '<span class="cursor"></span>';
            // 타이핑 완료 후 높이 재측정
            syncDialogHeight();
            onDone();
            return;
        }
        el.innerHTML = sequence[i] + '<span class="cursor"></span>';
        i++;
        typingTimer = setTimeout(tick, SPEED);
    }

    tick();
}

// ── 씬 렌더 헬퍼 ──
function dialogLayout({ badge, text, choices, isMath }) {
    const badgeHtml = badge
        ? `<div class="step-badge">STAGE ${badge} / ${TOTAL_STEPS}</div>`
        : '';
    const mathHtml = isMath
        ? `<div class="math-block">${isMath}</div>`
        : '';
    const choicesHtml = choices
        ? `<div class="choices-overlay" id="choices-wrap" style="display:none">${choices}</div>`
        : '';

    return `
        ${choicesHtml}
        <div class="dialog-box">
            ${badgeHtml}
            <div class="scene-title" id="typing-target"></div>
        </div>
    `;
}

function startTyping(text, isMath) {
    const target = document.getElementById('typing-target');
    const choicesWrap = document.getElementById('choices-wrap');
    if (!target) return;

    const mathHtml = isMath ? `<div class="math-block">${isMath}</div>` : '';

    // 초기 높이 측정 시작
    observeDialog();

    typeText(target, text, mathHtml, () => {
        if (choicesWrap) {
            choicesWrap.style.display = 'flex';
            choicesWrap.style.flexDirection = 'column';
            choicesWrap.style.gap = '8px';
            choicesWrap.style.alignItems = 'center';
            choicesWrap.classList.add('choices-appear');
            // 선택지 표시 후 높이 재측정
            syncDialogHeight();
        }
    });
}

function choiceBtn(key, label, action, extraClass = '') {
    return `
        <button class="choice-btn ${extraClass}" onclick="${action}">
            <span class="choice-key">${key}</span> ${label}
        </button>
    `;
}

function failScene(msg) {
    return `
        <div class="scene result-scene">
            <div class="result-msg">${msg}</div>
            <button class="action-btn" onclick="restart()">처음부터 다시!</button>
        </div>
    `;
}

// ── 씬 정의 ──
const scenes = {
    main: {
        progress: 0,
        render() {
            return `
                <div class="scene main-scene">
                    <div class="main-title">장애물 경주</div>
                    <button class="start-btn" onclick="playBGM(); goTo('q1')">게임 시작!</button>
                </div>`;
        },
    },

    // 1번
    q1: {
        progress: 1,
        typing: { text: '왼쪽으로 달릴까? 오른쪽으로 달릴까?' },
        render() {
            return `<div class="scene">${
                dialogLayout({
                    badge: 1,
                    text: '왼쪽으로 달릴까? 오른쪽으로 달릴까?',
                    choices:
                        choiceBtn('A', '왼쪽으로 달린다', "goTo('q1_fail')") +
                        choiceBtn('B', '오른쪽으로 달린다', "goTo('q2')"),
                })
            }</div>`;
        },
    },
    q1_fail: {
        fail: true,
        render() { return failScene('돌에 걸려 넘어졌다...'); },
    },

    // 2번
    q2: {
        progress: 2,
        typing: { text: '두 번째 갈림길이야!<br>이번엔 어느 쪽으로?' },
        render() {
            return `<div class="scene">${
                dialogLayout({
                    badge: 2,
                    text: '두 번째 갈림길이야!<br>이번엔 어느 쪽으로?',
                    choices:
                        choiceBtn('A', '왼쪽으로 달린다', "goTo('q3')") +
                        choiceBtn('B', '오른쪽으로 달린다', "goTo('q2_fail')"),
                })
            }</div>`;
        },
    },
    q2_fail: {
        fail: true,
        render() { return failScene('너무 오른쪽으로 돌아버렸는지<br>트랙 밖이다...'); },
    },

    // 3번
    q3: {
        progress: 3,
        typing: { text: '또 갈림길이다!<br>세 번째 선택을 해야 해!' },
        render() {
            return `<div class="scene">${
                dialogLayout({
                    badge: 3,
                    text: '또 갈림길이다!<br>세 번째 선택을 해야 해!',
                    choices:
                        choiceBtn('A', '왼쪽으로 달린다', "goTo('q3_fail')") +
                        choiceBtn('B', '오른쪽으로 달린다', "goTo('q4')"),
                })
            }</div>`;
        },
    },
    q3_fail: {
        fail: true,
        render() { return failScene('너무 왼쪽으로 돌아버렸는지<br>트랙 밖이다...'); },
    },

    // 4번
    q4: {
        progress: 4,
        typing: { text: '야생의 뜀틀이 나왔다!<br>어떻게 할까?' },
        render() {
            return `<div class="scene">${
                dialogLayout({
                    badge: 4,
                    text: '야생의 뜀틀이 나왔다!<br>어떻게 할까?',
                    choices:
                        choiceBtn('A', '위로 뜀틀을 넘는다', "goTo('q5')") +
                        choiceBtn('B', '그냥 지나쳐간다', "goTo('q4_fail')"),
                })
            }</div>`;
        },
    },
    q4_fail: {
        fail: true,
        render() { return failScene('장애물을 안 넘으면 어떡해!'); },
    },

    // 5번
    q5: {
        progress: 5,
        typing: { text: '빈약한 체력으로나마 겨우 성공했다...<br>그런데 철봉을 마주했다! 어떻게 할까?' },
        render() {
            return `<div class="scene">${
                dialogLayout({
                    badge: 5,
                    text: '빈약한 체력으로나마 겨우 성공했다...<br>그런데 철봉을 마주했다! 어떻게 할까?',
                    choices:
                        choiceBtn('A', '옆에 있는 장대를 들고 위로 철봉을 넘는다', "goTo('q5_fail')") +
                        choiceBtn('B', '그냥 아래로 숙여서 간다', "goTo('q6')"),
                })
            }</div>`;
        },
    },
    q5_fail: {
        fail: true,
        render() { return failScene('고3의 체력으로는 무리였다...'); },
    },

    // 6번 (빨간/파란 휴지)
    q6: {
        progress: 6,
        typing: { text: '고3의 허리는 소중한 법...<br>아무튼 빨간휴지 줄까, 파란휴지 줄까?' },
        render() {
            return `<div class="scene">${
                dialogLayout({
                    badge: 6,
                    text: '고3의 허리는 소중한 법...<br>아무튼 빨간휴지 줄까, 파란휴지 줄까?',
                    choices:
                        choiceBtn('A', '빨간휴지', "goTo('q6_red_confirm')") +
                        choiceBtn('B', '파란휴지', "goTo('q6_blue')"),
                })
            }</div>`;
        },
    },
    q6_red_confirm: {
        typing: { text: '엑... 정말로?' },
        render() {
            return `<div class="scene">${
                dialogLayout({
                    text: '엑... 정말로?',
                    choices:
                        choiceBtn('A', '네', "getItem('포켓몬 피리'); goTo('q6_blue')") +
                        choiceBtn('B', '파란휴지 할래요...', "goTo('q6_blue')"),
                })
            }</div>`;
        },
    },
    q6_blue: {
        typing: { text: '화강돌의 약점은?' },
        render() {
            return `<div class="scene">${
                dialogLayout({
                    text: '화강돌의 약점은?',
                    choices:
                        choiceBtn('A', '악', "goTo('q6_blue_fail')") +
                        choiceBtn('B', '고스트', "goTo('q6_blue_fail')") +
                        choiceBtn('C', '페어리', "goTo('q7')"),
                })
            }</div>`;
        },
    },
    q6_blue_fail: {
        fail: true,
        render() { return failScene('바보!!!'); },
    },

    // 7번
    q7: {
        progress: 7,
        typing: {
            text: '풀어.',
            isMath: `정적분 I = ∫₀^∞ 1 / (1 + x⁴) dx 라 할 때,<br>∫₀^∞ (1 + x²) / (1 + x⁴) dx 의 값은?`,
        },
        render() {
            return `<div class="scene">${
                dialogLayout({
                    badge: 7,
                    text: '풀어.',
                    isMath: `정적분 I = ∫₀^∞ 1 / (1 + x⁴) dx 라 할 때,<br>∫₀^∞ (1 + x²) / (1 + x⁴) dx 의 값은?`,
                    choices:
                        choiceBtn('A', '(1/2)I', "goTo('q7_fail')") +
                        choiceBtn('B', '√2 I', "goTo('q7_fail')") +
                        choiceBtn('C', '2I', "goTo('q8')"),
                })
            }</div>`;
        },
    },
    q7_fail: {
        fail: true,
        render() { return failScene('틀렸어!!'); },
    },

    // 8번
    q8: {
        progress: 8,
        typing: { text: '잠만보가 결승선을 막고 있다...!!<br>어떻게 할까?' },
        render() {
            const hasPipe = state.inventory.includes('포켓몬 피리');
            return `<div class="scene">${
                dialogLayout({
                    badge: 8,
                    text: '잠만보가 결승선을 막고 있다...!!<br>어떻게 할까?',
                    choices:
                        choiceBtn('A', '일어나달라고 빌기', "goTo('q8_fail')") +
                        (hasPipe
                            ? choiceBtn('B', '포켓몬 피리를 사용한다!', "goTo('finish')", 'hidden-item')
                            : ''),
                })
            }</div>`;
        },
    },
    q8_fail: {
        fail: true,
        render() {
            return failScene('잠만보는 미동도 하지 않는다...<br>어딘가에서 아이템을 얻을 수 있지 않을까...?');
        },
    },

    // 결승선
    finish: {
        progress: 9,
        render() {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            return `
                <div class="scene result-scene">
                    <div class="result-msg success">🎉 결승선 통과!</div>
                    <div class="finish-time">${h}시 ${m}분 ${s}초</div>
                </div>`;
        },
    },
};

// ── 유틸 ──
function goTo(sceneId) {
    state.currentScene = sceneId;
    render();
}

function restart() {
    state.inventory = [];
    state.currentScene = 'main';
    render();
}

function getItem(item) {
    if (!state.inventory.includes(item)) {
        state.inventory.push(item);
    }
}

// ── 렌더 ──
function render() {
    const scene = scenes[state.currentScene];
    if (!scene) return;

    // 진행바
    const progressWrap = document.getElementById('progress-wrap');
    const progressBar  = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');

    // label을 progress-bar 안으로 이동 (최초 1회)
    if (progressLabel && progressBar && progressLabel.parentElement !== progressBar) {
        progressBar.appendChild(progressLabel);
    }

    if (state.currentScene === 'main') {
        progressWrap.style.display = 'none';
    } else {
        progressWrap.style.display = 'block';
        const pct = scene.progress ? Math.min((scene.progress / TOTAL_STEPS) * 100, 100) : null;
        if (pct !== null) progressBar.style.width = pct + '%';
    }

    // 인벤토리
    const inv = document.getElementById('inventory');
    inv.innerHTML = state.inventory.map(item =>
        `<span class="item-badge">${item}</span>`
    ).join('');

    // 이전 타이핑 중단
    if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; }

    // 이전 ResizeObserver 정리
    if (dialogObserver) { dialogObserver.disconnect(); dialogObserver = null; }

    // 씬 렌더
    const container = document.getElementById('scene-container');
    container.innerHTML = scene.render();

    // 타이핑 시작 (dialog 씬만)
    if (scene.typing) {
        startTyping(scene.typing.text, scene.typing.isMath);
    }

    // 실패 흔들림
    if (scene.fail) {
        const el = container.querySelector('.result-scene') || container.querySelector('.scene');
        if (el) {
            el.classList.remove('shake');
            void el.offsetWidth;
            el.classList.add('shake');
        }
    }
}

render();