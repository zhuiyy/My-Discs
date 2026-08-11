document.addEventListener('DOMContentLoaded', () => {
    const INTERLUDE_SECONDS = 20;
    const tracks = Array.isArray(window.listeningTracks)
        ? window.listeningTracks.filter((track) => track && track.id && track.src && track.title)
        : [];

    const section = document.getElementById('listening');
    const audio = document.getElementById('listening-audio');
    const listenButton = document.getElementById('listening-button');
    const soundButton = document.getElementById('listening-sound');
    const statusLabel = document.getElementById('listening-status-label');
    const statusDetail = document.getElementById('listening-status-detail');
    const trackKicker = document.getElementById('listening-kicker');
    const trackTitle = document.getElementById('listening-track-title');
    const trackNote = document.getElementById('listening-track-note');
    const composer = document.getElementById('listening-composer');
    const performance = document.getElementById('listening-performance');
    const recording = document.getElementById('listening-recording');
    const buttonOverline = document.getElementById('listening-button-overline');
    const buttonLabel = document.getElementById('listening-button-label');
    const waveform = document.getElementById('listening-waveform');
    const elapsedTime = document.getElementById('listening-elapsed');
    const durationTime = document.getElementById('listening-duration');
    const timelineLabel = document.getElementById('listening-timeline-label');
    const listeningNote = document.getElementById('listening-note');
    const dock = document.getElementById('listening-dock');
    const dockStateLabel = document.getElementById('dock-state-label');
    const dockTrackTitle = document.getElementById('dock-track-title');
    const dockTrackMeta = document.getElementById('dock-track-meta');
    const dockProgressFill = document.getElementById('dock-progress-fill');
    const dockTime = document.getElementById('dock-time');
    const dockButton = document.getElementById('dock-button');

    const waveformHeights = [
        24, 42, 32, 68, 46, 78, 54, 36, 64, 88, 58, 40,
        72, 52, 92, 62, 44, 74, 56, 82, 48, 66, 38, 76,
        52, 86, 60, 34, 70, 46, 80, 56, 42, 72, 50, 64
    ];

    let state = 'idle';
    let sessionActive = false;
    let currentTrack = null;
    let currentTrackIndex = -1;
    let firstSelectionPending = true;
    let shuffleBag = [];
    let interludeDeadline = 0;
    let interludeTimer = null;
    let progressFrame = null;
    let sectionIsVisible = true;
    const unavailableTracks = new Set();

    function buildWaveform() {
        const fragment = document.createDocumentFragment();
        waveformHeights.forEach((height) => {
            const bar = document.createElement('i');
            bar.style.setProperty('--bar-height', `${height}%`);
            fragment.appendChild(bar);
        });
        waveform.appendChild(fragment);
    }

    function formatTime(value) {
        if (!Number.isFinite(value) || value < 0) {
            return '00:00';
        }
        const total = Math.floor(value);
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    function setProgress(progress, currentLabel, endLabel) {
        const bounded = Math.max(0, Math.min(1, progress));
        const activeCount = Math.round(bounded * waveform.children.length);
        Array.from(waveform.children).forEach((bar, index) => {
            bar.classList.toggle('is-past', index < activeCount);
        });
        dockProgressFill.style.width = `${bounded * 100}%`;
        dockTime.textContent = currentLabel;
        elapsedTime.textContent = currentLabel;
        durationTime.textContent = endLabel;
    }

    function shuffle(values) {
        for (let index = values.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
        }
        return values;
    }

    function refillShuffleBag() {
        shuffleBag = shuffle(
            tracks
                .map((track, index) => ({ track, index }))
                .filter(({ track }) => !unavailableTracks.has(track.id))
                .map(({ index }) => index)
        );

        if (shuffleBag.length > 1 && shuffleBag[shuffleBag.length - 1] === currentTrackIndex) {
            [shuffleBag[0], shuffleBag[shuffleBag.length - 1]] = [
                shuffleBag[shuffleBag.length - 1],
                shuffleBag[0]
            ];
        }
    }

    function nextRandomTrack() {
        if (!shuffleBag.length) {
            refillShuffleBag();
        }
        const nextIndex = shuffleBag.pop();
        if (typeof nextIndex !== 'number') {
            return null;
        }
        currentTrackIndex = nextIndex;
        return tracks[nextIndex];
    }

    function performanceLine(track) {
        return [
            track.performer,
            track.pianist,
            track.ensemble,
            track.conductor ? `${track.conductor} (conductor)` : ''
        ].filter(Boolean).join(' · ');
    }

    function showTrack(track) {
        currentTrack = track;
        trackKicker.textContent = track.movement || 'Selected excerpt';
        trackTitle.textContent = track.title;
        trackNote.textContent = track.note || 'A listening selection shared independently of the physical collection below.';
        composer.textContent = track.composer || '—';
        performance.textContent = performanceLine(track) || '—';
        recording.textContent = track.recording || '—';
        dockTrackTitle.textContent = track.title;
        dockTrackMeta.textContent = [track.composer, track.performer, track.pianist].filter(Boolean).join(' · ');
    }

    function updateDockVisibility() {
        const shouldShow = sessionActive && !sectionIsVisible;
        dock.classList.toggle('is-visible', shouldShow);
        document.body.classList.toggle('dock-visible', shouldShow);
    }

    function setState(nextState) {
        state = nextState;
        document.body.dataset.listeningState = nextState;
        const isRunning = sessionActive && ['loading', 'playing', 'interlude'].includes(nextState);
        listenButton.classList.toggle('is-stop', isRunning);
        buttonOverline.textContent = isRunning ? 'Finish' : nextState === 'blocked' ? 'Resume' : 'Begin';
        buttonLabel.textContent = isRunning ? '结束聆听' : nextState === 'blocked' ? '继续聆听' : '开始聆听';

        if (nextState === 'playing') {
            statusLabel.textContent = 'Now playing';
            statusDetail.textContent = 'A listening selection';
            dockStateLabel.textContent = 'Now playing';
            timelineLabel.textContent = 'Excerpt';
        } else if (nextState === 'interlude') {
            statusLabel.textContent = 'In silence';
            dockStateLabel.textContent = 'In silence';
            timelineLabel.textContent = 'Interlude';
        } else if (nextState === 'loading') {
            statusLabel.textContent = 'Preparing';
            statusDetail.textContent = 'Opening the next selection';
            dockStateLabel.textContent = 'Preparing';
            timelineLabel.textContent = 'Loading';
        } else if (nextState === 'blocked') {
            statusLabel.textContent = 'A small pause';
            statusDetail.textContent = 'The browser needs one more click';
            timelineLabel.textContent = 'Ready';
        } else if (nextState === 'error') {
            statusLabel.textContent = 'Unable to play';
            statusDetail.textContent = 'The audio file could not be opened';
            timelineLabel.textContent = 'Unavailable';
        } else if (nextState === 'empty') {
            statusLabel.textContent = 'Programme pending';
            statusDetail.textContent = 'Audio selections have not been added yet';
        } else {
            statusLabel.textContent = 'Ready to listen';
            statusDetail.textContent = currentTrack ? 'The selection remains ready' : 'One selection at a time';
            timelineLabel.textContent = 'Excerpt';
        }
        updateDockVisibility();
    }

    function cancelTimers() {
        window.clearInterval(interludeTimer);
        interludeTimer = null;
        window.cancelAnimationFrame(progressFrame);
        progressFrame = null;
    }

    function updatePlaybackProgress() {
        if (state !== 'playing') {
            return;
        }
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        setProgress(duration ? current / duration : 0, formatTime(current), formatTime(duration));
        progressFrame = window.requestAnimationFrame(updatePlaybackProgress);
    }

    function updateInterlude() {
        const remainingMs = Math.max(0, interludeDeadline - Date.now());
        const remaining = Math.ceil(remainingMs / 1000);
        const elapsed = INTERLUDE_SECONDS - remainingMs / 1000;
        statusDetail.textContent = `Next selection in ${remaining} second${remaining === 1 ? '' : 's'}`;
        dockTrackMeta.textContent = `Next selection in ${remaining}s`;
        setProgress(
            elapsed / INTERLUDE_SECONDS,
            formatTime(elapsed),
            `00:${String(INTERLUDE_SECONDS).padStart(2, '0')}`
        );

        if (remainingMs <= 0) {
            window.clearInterval(interludeTimer);
            interludeTimer = null;
            playRandomTrack();
        }
    }

    function beginInterlude() {
        if (!sessionActive) {
            return;
        }
        cancelTimers();
        audio.removeAttribute('src');
        audio.load();
        interludeDeadline = Date.now() + INTERLUDE_SECONDS * 1000;
        setState('interlude');
        updateInterlude();
        interludeTimer = window.setInterval(updateInterlude, 250);
    }

    async function playTrack(track) {
        cancelTimers();
        showTrack(track);
        setState('loading');
        setProgress(0, '00:00', '00:00');
        audio.src = track.src;
        audio.load();

        try {
            await audio.play();
            if (!sessionActive) {
                audio.pause();
                return;
            }
            setState('playing');
            updatePlaybackProgress();
        } catch (error) {
            if (!sessionActive) {
                return;
            }
            if (error && error.name === 'NotAllowedError') {
                sessionActive = false;
                setState('blocked');
                listeningNote.textContent = '浏览器暂停了自动续播。点击“继续聆听”即可恢复，之后仍会保持二十秒间隔。';
                return;
            }
            handleUnavailableTrack();
        }
    }

    function playRandomTrack() {
        if (!sessionActive) {
            return;
        }
        const nextTrack = nextRandomTrack();
        if (!nextTrack) {
            sessionActive = false;
            setState('error');
            listeningNote.textContent = '当前没有可以播放的音频文件。';
            return;
        }
        playTrack(nextTrack);
    }

    function handleUnavailableTrack() {
        if (currentTrack) {
            unavailableTracks.add(currentTrack.id);
        }
        const availableCount = tracks.filter((track) => !unavailableTracks.has(track.id)).length;
        if (!sessionActive || availableCount === 0) {
            sessionActive = false;
            setState('error');
            listeningNote.textContent = '当前曲目暂时无法播放，请稍后再来。';
            return;
        }
        statusLabel.textContent = 'Turning the page';
        statusDetail.textContent = 'Trying another selection';
        window.setTimeout(playRandomTrack, 800);
    }

    function stopSession() {
        sessionActive = false;
        cancelTimers();
        audio.pause();
        if (audio.currentSrc) {
            audio.currentTime = 0;
        }
        setProgress(0, '00:00', formatTime(audio.duration));
        setState('idle');
    }

    function startSession() {
        if (!tracks.length) {
            return;
        }
        sessionActive = true;
        listeningNote.textContent = 'Press stop, and a precious musical memory slips away.';
        if (state === 'blocked' && currentTrack) {
            playTrack(currentTrack);
        } else if (firstSelectionPending && currentTrack) {
            firstSelectionPending = false;
            playTrack(currentTrack);
        } else {
            playRandomTrack();
        }
    }

    function toggleSession() {
        if (sessionActive) {
            stopSession();
        } else {
            startSession();
        }
    }

    listenButton.addEventListener('click', toggleSession);
    dockButton.addEventListener('click', stopSession);
    soundButton.addEventListener('click', () => {
        audio.muted = !audio.muted;
        soundButton.setAttribute('aria-pressed', String(audio.muted));
        soundButton.setAttribute('aria-label', audio.muted ? '取消静音' : '静音');
        soundButton.querySelector('span').textContent = audio.muted ? 'Muted' : 'Sound';
    });

    audio.addEventListener('ended', beginInterlude);
    audio.addEventListener('loadedmetadata', () => {
        durationTime.textContent = formatTime(audio.duration);
    });

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(([entry]) => {
            sectionIsVisible = entry.isIntersecting;
            updateDockVisibility();
        }, { threshold: 0.08 });
        observer.observe(section);
    }

    buildWaveform();
    if (!tracks.length) {
        listenButton.disabled = true;
        buttonOverline.textContent = 'Programme';
        buttonLabel.textContent = '曲目准备中';
        setState('empty');
    } else {
        currentTrackIndex = Math.floor(Math.random() * tracks.length);
        showTrack(tracks[currentTrackIndex]);
        setState('idle');
    }
});
