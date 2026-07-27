let songListData = [];
let currentSong = null;
let currentMidi = null;
let isPlaying = false;

let instruments = [];
let partEvents = [];
let bgmPlayer = null; // MP3再生用
let draggedItem = null;
let formation = {};

const STORAGE_KEY = "anomyStats";
const anomyStats = {
    anomy_1: { softness: 0, echo: 0, brightness: 0 },
    anomy_2: { softness: 0, echo: 0, brightness: 0 },
    anomy_3: { softness: 0, echo: 0, brightness: 0 }
};

const ANOMY_SLOTS = [
    { id: "anomy_1", name: "アノミー1", type: "anomy", icon: "images/anomyicon.png" },
    { id: "anomy_2", name: "アノミー2", type: "anomy", icon: "images/anomyicon.png" },
    { id: "anomy_3", name: "アノミー3", type: "anomy", icon: "images/anomyicon.png" }
];

const NORMAL_INSTRUMENTS = [
    { id: "clap", name: "クラップ", type: "instrument", icon: "images/gakkiicon.png" },
    { id: "water", name: "Water", type: "instrument", icon: "images/gakkiicon.png" }
];

const INSTRUMENT_DEFINITIONS = {
    clap: { type: "sample", file: "instruments/clap.mp3" },
    water: { type: "sample", file: "instruments/water.wav" }
};

window.addEventListener("DOMContentLoaded", async () => {
    setupScreenButtons();
    loadStatsFromStorage();
    setupGrowScreen();

    try {
        const response = await fetch("master.json");
        const data = await response.json();
        songListData = data.songs;

        const selectEl = document.getElementById("songSelect");
        songListData.forEach(song => {
            const option = document.createElement("option");
            option.value = song.id;
            option.textContent = song.title;
            selectEl.appendChild(option);
        });

        selectEl.addEventListener("change", () => {
            const song = songListData.find(s => s.id === selectEl.value);
            if (song) buildSongScreen(song);
        });

        if (songListData.length > 0) buildSongScreen(songListData[0]);

        document.getElementById("playBtn").addEventListener("click", onPlayButtonClick);
        document.querySelectorAll(".small-tab").forEach(tab => {
            tab.addEventListener("click", () => buildIconTray(tab.dataset.filter));
        });

        updateStatsDisplay();
        document.getElementById("statusLabel").textContent = "準備完了";
    } catch (error) {
        console.error(error);
        document.getElementById("statusLabel").textContent = "読込失敗";
    }
});

function setupScreenButtons() {
    const playScreen = document.getElementById("playScreen");
    const growScreen = document.getElementById("growScreen");
    document.getElementById("showPlayScreenBtn").addEventListener("click", () => {
        playScreen.classList.add("active");
        growScreen.classList.remove("active");
    });
    document.getElementById("showGrowScreenBtn").addEventListener("click", () => {
        growScreen.classList.add("active");
        playScreen.classList.remove("active");
    });
}

function setupGrowScreen() {
    const growAnomy = document.getElementById("growAnomy");
    document.querySelectorAll(".food-icon").forEach(food => {
        food.addEventListener("click", () => {
            const statName = food.dataset.stat;
            raiseAnomyStat("anomy_1", statName, 10);
            saveStatsToStorage();
            growAnomy.classList.remove("jump");
            void growAnomy.offsetWidth;
            growAnomy.classList.add("jump");
            updateStatsDisplay();
            document.getElementById("statusLabel").textContent = `anomy_1の${statName}が上がりました`;
        });
    });
    document.getElementById("resetStatsBtn").addEventListener("click", () => {
        resetAnomyStats("anomy_1");
        saveStatsToStorage();
        updateStatsDisplay();
        document.getElementById("statusLabel").textContent = "能力値をリセットしました";
    });
}

function raiseAnomyStat(anomyId, statName, amount) {
    if (!anomyStats[anomyId]) return;
    anomyStats[anomyId][statName] = Math.min(100, anomyStats[anomyId][statName] + amount);
}

function resetAnomyStats(anomyId) {
    if (!anomyStats[anomyId]) return;
    anomyStats[anomyId] = { softness: 0, echo: 0, brightness: 0 };
}

function updateStatsDisplay() {
    document.getElementById("softnessValue").textContent = anomyStats.anomy_1.softness;
    document.getElementById("echoValue").textContent = anomyStats.anomy_1.echo;
    document.getElementById("brightnessValue").textContent = anomyStats.anomy_1.brightness;
}

function saveStatsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(anomyStats));
}

function loadStatsFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
        const parsed = JSON.parse(saved);
        Object.assign(anomyStats, parsed);
    } catch (e) { console.warn(e); }
}

function buildSongScreen(song) {
    currentSong = song;
    formation = {};
    const spotArea = document.getElementById("spotArea");
    spotArea.innerHTML = "";
    song.tracks.forEach((track, index) => {
        formation[index] = track.defaultInstrument || null;
        const spot = document.createElement("img");
        spot.src = track.spotImage;
        spot.className = "spot";
        spot.style.left = track.x + "px";
        spot.style.top = track.y + "px";
        spot.addEventListener("dragover", e => e.preventDefault());
        spot.addEventListener("drop", e => { e.preventDefault(); handleDrop(index); });
        spotArea.appendChild(spot);
    });
    buildIconTray("all");
    renderFormation();
}

function buildIconTray(filter = "all") {
    const tray = document.getElementById("iconTray");
    tray.innerHTML = "";
    const items = [...ANOMY_SLOTS, ...NORMAL_INSTRUMENTS];
    items.forEach(item => {
        if (filter !== "all" && item.type !== filter) return;
        const icon = document.createElement("img");
        icon.src = item.icon;
        icon.className = "tray-icon";
        icon.draggable = true;
        icon.dataset.itemId = item.id;
        icon.addEventListener("dragstart", () => {
            draggedItem = { id: item.id, type: item.type, fromTrackIndex: null };
        });
        tray.appendChild(icon);
    });
}

function renderFormation() {
    document.querySelectorAll(".placed-icon").forEach(el => el.remove());
    if (!currentSong) return;
    currentSong.tracks.forEach((track, index) => {
        const itemId = formation[index];
        if (!itemId) return;
        const item = findItemById(itemId);
        const icon = document.createElement("img");
        icon.src = item.icon;
        icon.className = "placed-icon";
        icon.style.left = (track.x + 4) + "px";
        icon.style.top = (track.y + 10) + "px";
        icon.addEventListener("click", () => { formation[index] = null; renderFormation(); });
        icon.addEventListener("dragstart", () => {
            draggedItem = { id: item.id, type: item.type, fromTrackIndex: index };
        });
        document.getElementById("stage").appendChild(icon);
    });
}

function handleDrop(targetTrackIndex) {
    if (!draggedItem || !currentSong) return;
    const targetTrack = currentSong.tracks[targetTrackIndex];
    if (targetTrack.slotType !== draggedItem.type) {
        alert("ここには配置できません");
        return;
    }
    if (draggedItem.fromTrackIndex !== null) formation[draggedItem.fromTrackIndex] = null;
    formation[targetTrackIndex] = draggedItem.id;
    draggedItem = null;
    renderFormation();
}

function findItemById(id) {
    return [...ANOMY_SLOTS, ...NORMAL_INSTRUMENTS].find(item => item.id === id);
}

// --- 音響生成ロジック ---

function createAnomyInstrument(anomyId) {
    const stats = anomyStats[anomyId] || { softness: 0, echo: 0, brightness: 0 };
    const softnessRate = stats.softness / 100;
    const echoRate = stats.echo / 100;
    const brightnessRate = stats.brightness / 100;

    // 音の波形選択
    let oscType = softnessRate >= 0.7 ? "sine" : (softnessRate >= 0.35 ? "triangle" : "square");
    
    const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: oscType },
        envelope: { attack: 0.02 + softnessRate * 0.25, release: 0.2 + softnessRate * 0.8 }
    });

    // フィルター設定：明るさ0でも1000Hzまでは通す（メロディを聞こえやすくするため）
    const filter = new Tone.Filter(1000 + brightnessRate * 4000, "lowpass");
    
    // リバーブ設定：少し抑えめにして芯のある音にする
    const reverb = new Tone.Reverb({ decay: 0.2 + echoRate * 4, wet: echoRate * 0.4 });

    synth.connect(filter);
    filter.connect(reverb);
    reverb.toDestination();
    return synth;
}

async function createInstrumentFromSelection(selectedValue) {
    if (!selectedValue) return null;
    if (selectedValue.startsWith("anomy_")) return createAnomyInstrument(selectedValue);
    
    const def = INSTRUMENT_DEFINITIONS[selectedValue];
    if (def?.type === "sample") {
        const sampler = new Tone.Sampler({ urls: { C4: def.file } }).toDestination();
        await Tone.loaded();
        return sampler;
    }
    return null;
}

// --- 再生制御 ---

async function onPlayButtonClick() {
    await Tone.start();
    if (isPlaying) { stopMusic(); return; }

    const statusLabel = document.getElementById("statusLabel");
    statusLabel.textContent = "読み込み中...";

    try {
        // MIDIとMP3の読み込み
        currentMidi = await Midi.fromUrl(currentSong.filename);
        
        if (currentSong.bgm) {
            bgmPlayer = new Tone.Player(currentSong.bgm).toDestination();
            await Tone.loaded(); 

            // 【重要】BGM（MP3）の音量を下げて、育成メロディを聞こえやすくします
            // -15dBは元の約1/5程度の音量です
            bgmPlayer.volume.value = -10; 

            bgmPlayer.sync().start(0); // Transportと同期
        }

        cleanUpSynths();
        instruments = [];
        for (let i = 0; i < currentSong.tracks.length; i++) {
            instruments.push(await createInstrumentFromSelection(formation[i]));
        }

        // BPM設定
        Tone.Transport.bpm.value = currentMidi.header.tempos[0]?.bpm || 120;
        Tone.Transport.seconds = 0;

        // MIDIイベントのスケジュール
        currentMidi.tracks.forEach((track, index) => {
            const inst = instruments[index];
            if (!inst) return;
            track.notes.forEach(note => {
                const ev = Tone.Transport.schedule(time => {
                    inst.triggerAttackRelease(note.name, note.duration, time, note.velocity);
                }, note.time);
                partEvents.push(ev);
            });
        });

        // 終了イベント
        const endEv = Tone.Transport.schedule(time => {
            Tone.Draw.schedule(() => stopMusic(), time);
        }, currentMidi.duration + 0.5);
        partEvents.push(endEv);

        isPlaying = true;
        statusLabel.textContent = "演奏中";
        Tone.Transport.start();

    } catch (e) {
        console.error(e);
        statusLabel.textContent = "エラーが発生しました";
    }
}

function cleanUpSynths() {
    partEvents.forEach(ev => Tone.Transport.clear(ev));
    partEvents = [];
    instruments.forEach(inst => {
        if(inst && inst.dispose) inst.dispose();
    });
    instruments = [];
}

function stopMusic() {
    if (!isPlaying) return;
    Tone.Transport.stop();
    if (bgmPlayer) {
        bgmPlayer.dispose();
        bgmPlayer = null;
    }
    cleanUpSynths();
    isPlaying = false;
    document.getElementById("statusLabel").textContent = "演奏終了";
}