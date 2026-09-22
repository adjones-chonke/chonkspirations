import json
import html
from pathlib import Path

# Configuration
LIBRARY_DIR = Path("./chonk_library")
OUTPUT_FILE = Path("index.html")
ENABLE_COMPARE = False  # Feature flag: set to True to enable the Compare feature

def find_triples(lib_dir):
    triples = []
    if not lib_dir.exists():
        print(f"Error: Directory '{lib_dir}' not found.")
        return triples

    for folder in sorted(lib_dir.iterdir()):
        if not folder.is_dir() or folder.name.startswith("."):
            continue

        files = [f for f in folder.iterdir() if f.is_file() and not f.name.startswith(".")]

        # Classify video file (.mp4, .mov, .webm, .mkv)
        video_file = next((f for f in files if f.suffix.lower() in [".mp4", ".mov", ".webm", ".mkv"]), None)

        # Image files (.png, .jpg, .jpeg, .webp)
        img_files = [f for f in files if f.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]]

        # Params PNG heuristic: filename contains 'param', 'meta', 'spec'
        params_img = next((f for f in img_files if any(k in f.stem.lower() for k in ["param", "meta", "spec"])), None)
        if not params_img and len(img_files) > 1:
            params_img = img_files[1]

        # Static image is the non-params image
        static_img = next((f for f in img_files if f != params_img), None)
        if not static_img and len(img_files) > 0 and img_files[0] != params_img:
            static_img = img_files[0]

        # If no media assets found at all, skip
        if not (video_file or static_img or params_img):
            continue

        triples.append({
            "id": folder.name,
            "static_src": str(static_img.relative_to(lib_dir.parent)) if static_img else "",
            "video_src": str(video_file.relative_to(lib_dir.parent)) if video_file else "",
            "params_src": str(params_img.relative_to(lib_dir.parent)) if params_img else "",
        })

    return sorted(triples, key=lambda x: x["id"])

def generate_html(triples, enable_compare=ENABLE_COMPARE):
    items_json = json.dumps(triples)
    
    # Generate cards HTML
    cards_html = ""
    for item in triples:
        item_id = html.escape(item["id"])
        video_src = html.escape(item["video_src"])
        static_src = html.escape(item["static_src"])
        params_src = html.escape(item["params_src"])

        default_type = "video" if video_src else ("static" if static_src else "params")

        checkbox_html = f'''
                    <label class="checkbox-wrapper" onclick="event.stopPropagation()">
                        <input type="checkbox" onchange="toggleSelectCard('{item_id}', this.checked)">
                    </label>''' if enable_compare else ""

        cards_html += f"""
        <div class="card" id="card-{item_id}" data-id="{item_id}" data-search="{item_id.lower()}">
            <div class="card-header">
                <div class="card-title">
                    {checkbox_html}
                    <span>{item_id}</span>
                </div>
                <button class="icon-btn" title="Expand Lightbox" onclick="openLightbox('{item_id}')">
                    🔍
                </button>
            </div>

            <div class="media-container" id="media-box-{item_id}">
                <!-- Rendered dynamically by JS -->
            </div>

            <div class="card-tabs">
                <button class="tab-btn video-tab {'active' if default_type=='video' else ''}" 
                        onclick="switchTab('{item_id}', 'video')">
                    🎬 Video
                </button>
                <button class="tab-btn {'active' if default_type=='static' else ''}" 
                        onclick="switchTab('{item_id}', 'static')">
                    🖼️ Image
                </button>
                <button class="tab-btn {'active' if default_type=='params' else ''}" 
                        onclick="switchTab('{item_id}', 'params')">
                    ⚙️ Params
                </button>
            </div>
        </div>
"""

    html_template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chonk Library & Video Comparator</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0b0f19;
            --surface: #151c2e;
            --surface-hover: #1e2942;
            --border: #26334d;
            --border-highlight: #3b82f6;
            --text: #f1f5f9;
            --text-muted: #94a3b8;
            --accent: #38bdf8;
            --accent-glow: rgba(56, 189, 248, 0.25);
            --primary: #6366f1;
            --success: #10b981;
            --card-radius: 12px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Header & Sticky Controls */
        header {
            position: sticky;
            top: 0;
            z-index: 50;
            background: rgba(11, 15, 25, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--border);
            padding: 1rem 2rem;
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .brand h1 {
            font-size: 1.25rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .badge {
            background: var(--surface);
            border: 1px solid var(--border);
            color: var(--accent);
            padding: 0.25rem 0.6rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
        }

        .toolbar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.75rem;
        }

        .input-group {
            position: relative;
            display: flex;
            align-items: center;
        }

        .input-group input {
            background: var(--surface);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 0.5rem 0.85rem 0.5rem 2.2rem;
            border-radius: 8px;
            font-size: 0.875rem;
            outline: none;
            transition: all 0.2s;
            width: 200px;
        }

        .input-group input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow);
            width: 240px;
        }

        .input-group svg {
            position: absolute;
            left: 0.75rem;
            width: 16px;
            height: 16px;
            stroke: var(--text-muted);
            fill: none;
        }

        .btn {
            background: var(--surface);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 0.5rem 0.85rem;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            transition: all 0.15s ease;
            user-select: none;
        }

        .btn:hover {
            background: var(--surface-hover);
            border-color: #3b4f74;
            color: #fff;
        }

        .btn-primary {
            background: linear-gradient(135deg, #4f46e5 0%, #0284c7 100%);
            border: none;
            color: white;
            box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
        }

        .btn-primary:hover {
            opacity: 0.95;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.45);
        }

        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            box-shadow: none;
        }

        .select-custom {
            background: var(--surface);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 0.5rem 0.75rem;
            border-radius: 8px;
            font-size: 0.85rem;
            outline: none;
            cursor: pointer;
        }

        /* Main Container */
        main {
            flex: 1;
            padding: 2rem;
            max-width: 1800px;
            margin: 0 auto;
            width: 100%;
        }

        /* Grid System */
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr));
            gap: 1.5rem;
        }

        @media (max-width: 1280px) {
            .gallery-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 860px) {
            .gallery-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 540px) {
            .gallery-grid { grid-template-columns: 1fr; }
        }

        /* Card Design - 9:16 Portrait Focus */
        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--card-radius);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
            position: relative;
        }

        .card:hover {
            border-color: #3b4f74;
            transform: translateY(-2px);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }

        .card.selected {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent), 0 8px 20px rgba(56, 189, 248, 0.2);
        }

        .card-header {
            padding: 0.6rem 0.85rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .card-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .checkbox-wrapper {
            display: flex;
            align-items: center;
            cursor: pointer;
        }

        .checkbox-wrapper input {
            accent-color: var(--accent);
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        /* 9:16 Portrait Media Container */
        .media-container {
            position: relative;
            width: 100%;
            aspect-ratio: 9 / 16;
            background: #000;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .media-element {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        }

        video.media-element {
            background: #000;
        }

        .no-asset {
            color: var(--text-muted);
            font-size: 0.8rem;
            text-align: center;
            padding: 1rem;
        }

        /* Card Action Overlay */
        .media-overlay {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            display: flex;
            gap: 0.4rem;
            opacity: 0;
            transition: opacity 0.2s ease;
            z-index: 10;
        }

        .media-container:hover .media-overlay {
            opacity: 1;
        }

        .icon-btn {
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #fff;
            width: 30px;
            height: 30px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.15s ease;
        }

        .icon-btn:hover {
            background: var(--accent);
            color: #000;
        }

        /* Card Tab Navigation */
        .card-tabs {
            display: flex;
            background: #0d1322;
            border-top: 1px solid var(--border);
            padding: 0.25rem;
            gap: 0.25rem;
        }

        .tab-btn {
            flex: 1;
            padding: 0.45rem 0.25rem;
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-size: 0.75rem;
            font-weight: 500;
            border-radius: 6px;
            cursor: pointer;
            text-align: center;
            transition: all 0.15s ease;
        }

        .tab-btn:hover {
            color: var(--text);
            background: rgba(255, 255, 255, 0.05);
        }

        .tab-btn.active {
            color: #fff;
            background: var(--surface);
            font-weight: 600;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
            border: 1px solid var(--border);
        }

        .tab-btn.video-tab.active {
            color: var(--accent);
            border-color: rgba(56, 189, 248, 0.3);
        }

        /* Comparison Modal & Drawer */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(4, 7, 13, 0.88);
            backdrop-filter: blur(12px);
            z-index: 100;
            display: flex;
            flex-direction: column;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
        }

        .modal-overlay.open {
            opacity: 1;
            pointer-events: auto;
        }

        .modal-header {
            padding: 1rem 2rem;
            background: rgba(15, 23, 42, 0.9);
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .modal-body {
            flex: 1;
            padding: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: auto;
            position: relative;
        }

        /* Side-by-Side Comparison Container */
        .compare-grid {
            display: flex;
            gap: 1.5rem;
            align-items: center;
            justify-content: center;
            max-width: 100%;
            max-height: 80vh;
        }

        .compare-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            max-height: 75vh;
        }

        .compare-media-wrapper {
            aspect-ratio: 9 / 16;
            height: 65vh;
            background: #000;
            border-radius: var(--card-radius);
            overflow: hidden;
            border: 1px solid var(--border);
            position: relative;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        }

        .compare-media-wrapper video, .compare-media-wrapper img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .compare-label {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--accent);
            background: var(--surface);
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            border: 1px solid var(--border);
        }

        /* Master Video Sync Bar */
        .sync-controls {
            padding: 1rem 2rem;
            background: rgba(15, 23, 42, 0.95);
            border-top: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 1.5rem;
        }

        .scrubber-container {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .scrubber {
            flex: 1;
            accent-color: var(--accent);
            cursor: pointer;
            height: 6px;
        }

        .time-display {
            font-family: monospace;
            font-size: 0.85rem;
            color: var(--text-muted);
            min-width: 90px;
        }

        /* Split Curtain Comparison Mode */
        .curtain-container {
            position: relative;
            aspect-ratio: 9 / 16;
            height: 75vh;
            background: #000;
            border-radius: var(--card-radius);
            overflow: hidden;
            border: 1px solid var(--border);
            user-select: none;
            box-shadow: 0 20px 40px rgba(0,0,0,0.7);
        }

        .curtain-layer {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
        }

        .curtain-layer-top {
            width: 100%;
            clip-path: polygon(0 0, var(--curtain-pct, 50%) 0, var(--curtain-pct, 50%) 100%, 0 100%);
            z-index: 2;
        }

        .curtain-layer video, .curtain-layer img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .curtain-slider-handle {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 50%;
            width: 4px;
            background: var(--accent);
            z-index: 10;
            cursor: ew-resize;
            transform: translateX(-50%);
        }

        .curtain-handle-circle {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 32px;
            height: 32px;
            background: var(--accent);
            color: #000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            box-shadow: 0 0 12px rgba(56, 189, 248, 0.6);
        }

        /* Lightbox */
        .lightbox-img {
            max-width: 90vw;
            max-height: 85vh;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
        }
    </style>
</head>
<body>
    <header>
        <div class="brand">
            <h1>Chonk Gallery</h1>
            <span class="badge" id="itemCount">__ITEM_COUNT__ items</span>
        </div>

        <div class="toolbar">
            <div class="input-group">
                <svg viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input type="text" id="searchInput" placeholder="Search chonk..." oninput="filterCards()">
            </div>

            <button class="btn" id="globalPlayBtn" onclick="toggleGlobalPlay()">
                <span id="globalPlayIcon">▶</span> Global Play
            </button>

            <button class="btn" id="globalMuteBtn" onclick="toggleGlobalMute()">
                <span id="globalMuteIcon">🔊</span> Mute All
            </button>

            <select class="select-custom" id="speedSelect" onchange="changeGlobalSpeed(this.value)">
                <option value="0.5">0.5x Speed</option>
                <option value="0.75">0.75x Speed</option>
                <option value="1" selected>1.0x Speed</option>
                <option value="1.25">1.25x Speed</option>
                <option value="1.5">1.5x Speed</option>
                <option value="2">2.0x Speed</option>
            </select>

            <select class="select-custom" id="colsSelect" onchange="changeGridColumns(this.value)">
                <option value="2">2 Columns</option>
                <option value="3">3 Columns</option>
                <option value="4" selected>4 Columns</option>
                <option value="5">5 Columns</option>
                <option value="6">6 Columns</option>
            </select>

            __COMPARE_BTN__
        </div>
    </header>

    <main>
        <div class="gallery-grid" id="galleryGrid">
            __CARDS_HTML__
        </div>
    </main>

    __COMPARE_MODAL__

    <!-- Lightbox Modal -->
    <div class="modal-overlay" id="lightboxModal" onclick="closeLightbox()">
        <div class="modal-header" onclick="event.stopPropagation()">
            <h2 style="font-size: 1.1rem;" id="lightboxTitle">Asset Lightbox</h2>
            <button class="btn" onclick="closeLightbox()">✕ Close</button>
        </div>
        <div class="modal-body" onclick="event.stopPropagation()" id="lightboxBody">
            <!-- Dynamically populated -->
        </div>
    </div>

    <script>
        const ITEMS = __ITEMS_JSON__;
        const itemMap = new Map(ITEMS.map(item => [item.id, item]));
        const cardStates = new Map(); // id -> { activeTab: 'video'|'static'|'params' }
        const selectedIds = new Set();

        let isGlobalPlaying = false;
        let isGlobalMuted = true;
        let globalSpeed = 1.0;

        // Sync playback variables
        let syncPlaying = false;
        let syncAnimFrame = null;

        // Initialize cards
        ITEMS.forEach(item => {
            const defaultTab = item.video_src ? 'video' : (item.static_src ? 'static' : 'params');
            cardStates.set(item.id, { activeTab: defaultTab });
            renderCardMedia(item.id);
        });

        function renderCardMedia(id) {
            const item = itemMap.get(id);
            const state = cardStates.get(id);
            const container = document.getElementById('media-box-' + id);
            if (!container || !item) return;

            if (state.activeTab === 'video') {
                if (item.video_src) {
                    container.innerHTML = `
                        <video src="${item.video_src}" class="media-element" 
                               autoplay loop muted playsinline 
                               onclick="toggleVideoPlay(this)"
                               style="cursor: pointer;"></video>
                        <div class="media-overlay">
                            <button class="icon-btn" title="Toggle Mute" onclick="event.stopPropagation(); toggleVideoMute(this)">🔊</button>
                        </div>
                    `;
                    const v = container.querySelector('video');
                    v.playbackRate = globalSpeed;
                    if (!isGlobalPlaying) v.pause();
                } else {
                    container.innerHTML = `<div class="no-asset">No video available</div>`;
                }
            } else if (state.activeTab === 'static') {
                if (item.static_src) {
                    container.innerHTML = `<img src="${item.static_src}" class="media-element" alt="Static Image" onclick="openLightbox('${id}')" style="cursor: zoom-in;">`;
                } else {
                    container.innerHTML = `<div class="no-asset">No static image available</div>`;
                }
            } else if (state.activeTab === 'params') {
                if (item.params_src) {
                    container.innerHTML = `<img src="${item.params_src}" class="media-element" alt="Params PNG" onclick="openLightbox('${id}')" style="cursor: zoom-in;">`;
                } else {
                    container.innerHTML = `<div class="no-asset">No parameters PNG available</div>`;
                }
            }
        }

        function switchTab(id, tab) {
            const card = document.getElementById('card-' + id);
            if (!card) return;

            cardStates.set(id, { activeTab: tab });
            
            const btns = card.querySelectorAll('.tab-btn');
            btns.forEach(btn => btn.classList.remove('active'));

            const targetIdx = tab === 'video' ? 0 : (tab === 'static' ? 1 : 2);
            if (btns[targetIdx]) btns[targetIdx].classList.add('active');

            renderCardMedia(id);
        }

        function toggleSelectCard(id, checked) {
            const card = document.getElementById('card-' + id);
            if (checked) {
                selectedIds.add(id);
                if (card) card.classList.add('selected');
            } else {
                selectedIds.delete(id);
                if (card) card.classList.remove('selected');
            }

            const countSpan = document.getElementById('selectedCount');
            const compareBtn = document.getElementById('compareBtn');
            countSpan.textContent = selectedIds.size;
            compareBtn.disabled = selectedIds.size < 2;
        }

        function filterCards() {
            const query = document.getElementById('searchInput').value.toLowerCase().trim();
            const cards = document.querySelectorAll('.card');
            let visibleCount = 0;

            cards.forEach(card => {
                const searchBlob = card.getAttribute('data-search');
                if (searchBlob.includes(query)) {
                    card.style.display = 'flex';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            document.getElementById('itemCount').textContent = visibleCount + ' items';
        }

        function changeGridColumns(cols) {
            const grid = document.getElementById('galleryGrid');
            grid.style.setProperty('--cols', cols);
        }

        function toggleGlobalPlay() {
            isGlobalPlaying = !isGlobalPlaying;
            const btnIcon = document.getElementById('globalPlayIcon');
            btnIcon.textContent = isGlobalPlaying ? '⏸' : '▶';

            const videos = document.querySelectorAll('.media-container video');
            videos.forEach(v => {
                if (isGlobalPlaying) v.play().catch(() => {});
                else v.pause();
            });
        }

        function toggleGlobalMute() {
            isGlobalMuted = !isGlobalMuted;
            const btnIcon = document.getElementById('globalMuteIcon');
            btnIcon.textContent = isGlobalMuted ? '🔇' : '🔊';

            const videos = document.querySelectorAll('.media-container video');
            videos.forEach(v => v.muted = isGlobalMuted);
        }

        function changeGlobalSpeed(speed) {
            globalSpeed = parseFloat(speed);
            const videos = document.querySelectorAll('video');
            videos.forEach(v => v.playbackRate = globalSpeed);
        }

        function toggleVideoPlay(video) {
            if (video.paused) video.play();
            else video.pause();
        }

        function toggleVideoMute(btn) {
            const video = btn.closest('.media-container').querySelector('video');
            if (!video) return;
            video.muted = !video.muted;
            btn.textContent = video.muted ? '🔇' : '🔊';
        }

        /* Comparison Modal Logic */
        function openComparisonModal() {
            if (selectedIds.size < 2) return;
            const modal = document.getElementById('compareModal');
            modal.classList.add('open');
            renderCompareBody();
        }

        function closeComparisonModal() {
            const modal = document.getElementById('compareModal');
            modal.classList.remove('open');
            syncPlaying = false;
            if (syncAnimFrame) cancelAnimationFrame(syncAnimFrame);
            
            // Pause any comparison videos
            const compVideos = modal.querySelectorAll('video');
            compVideos.forEach(v => v.pause());
        }

        function renderCompareBody() {
            const mode = document.getElementById('compareModeSelect').value;
            const body = document.getElementById('compareModalBody');
            const items = Array.from(selectedIds).map(id => itemMap.get(id)).filter(Boolean);

            if (mode === 'side-by-side') {
                let htmlStr = `<div class="compare-grid">`;
                items.forEach(item => {
                    htmlStr += `
                        <div class="compare-item">
                            <div class="compare-media-wrapper">
                                ${item.video_src ? `<video src="${item.video_src}" loop muted playsinline class="sync-video"></video>` : `<img src="${item.static_src}" />`}
                            </div>
                            <span class="compare-label">${item.id}</span>
                        </div>
                    `;
                });
                htmlStr += `</div>`;
                body.innerHTML = htmlStr;
            } else if (mode === 'curtain') {
                const itemA = items[0];
                const itemB = items[1] || items[0];

                body.innerHTML = `
                    <div class="curtain-container" id="curtainContainer" onmousemove="onCurtainDrag(event)" ontouchmove="onCurtainTouch(event)">
                        <div class="curtain-layer curtain-layer-bottom">
                            ${itemB.video_src ? `<video src="${itemB.video_src}" loop muted playsinline class="sync-video"></video>` : `<img src="${itemB.static_src}" />`}
                        </div>
                        <div class="curtain-layer curtain-layer-top" id="curtainTopLayer">
                            ${itemA.video_src ? `<video src="${itemA.video_src}" loop muted playsinline class="sync-video"></video>` : `<img src="${itemA.static_src}" />`}
                        </div>
                        <div class="curtain-slider-handle" id="curtainHandle">
                            <div class="curtain-handle-circle">↔</div>
                        </div>
                    </div>
                `;
            }

            setupSyncVideoListeners();
        }

        function onCurtainDrag(e) {
            const container = document.getElementById('curtainContainer');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            let x = e.clientX - rect.left;
            x = Math.max(0, Math.min(x, rect.width));
            const pct = (x / rect.width) * 100;

            const handle = document.getElementById('curtainHandle');
            container.style.setProperty('--curtain-pct', pct + '%');
            if (handle) {
                handle.style.left = pct + '%';
            }
        }

        function onCurtainTouch(e) {
            if (e.touches && e.touches[0]) {
                onCurtainDrag(e.touches[0]);
            }
        }

        function setupSyncVideoListeners() {
            const syncVideos = document.querySelectorAll('.sync-video');
            if (syncVideos.length === 0) return;

            const primary = syncVideos[0];
            const updateDuration = () => {
                if (primary.duration) {
                    document.getElementById('syncDuration').textContent = formatTime(primary.duration);
                }
            };

            if (primary.readyState >= 1 && primary.duration) {
                updateDuration();
            } else {
                primary.addEventListener('loadedmetadata', updateDuration);
            }

            syncPlaying = false;
            document.getElementById('syncPlayBtn').textContent = '▶ Play';
            document.getElementById('syncScrubber').value = 0;
            document.getElementById('syncCurrentTime').textContent = '00:00';
        }

        function toggleSyncPlay() {
            const syncVideos = document.querySelectorAll('.sync-video');
            if (syncVideos.length === 0) return;

            syncPlaying = !syncPlaying;
            const playBtn = document.getElementById('syncPlayBtn');
            playBtn.textContent = syncPlaying ? '⏸ Pause' : '▶ Play';

            syncVideos.forEach(v => {
                if (syncPlaying) v.play().catch(() => {});
                else v.pause();
            });

            if (syncPlaying) updateSyncProgress();
        }

        function updateSyncProgress() {
            if (!syncPlaying) return;
            const syncVideos = document.querySelectorAll('.sync-video');
            if (syncVideos.length > 0) {
                const primary = syncVideos[0];
                if (primary.duration) {
                    const pct = (primary.currentTime / primary.duration) * 100;
                    document.getElementById('syncScrubber').value = pct;
                    document.getElementById('syncCurrentTime').textContent = formatTime(primary.currentTime);
                }
            }
            syncAnimFrame = requestAnimationFrame(updateSyncProgress);
        }

        function onSyncScrub(val) {
            const syncVideos = document.querySelectorAll('.sync-video');
            if (syncVideos.length === 0) return;

            const primary = syncVideos[0];
            if (!primary.duration) return;

            const targetTime = (val / 100) * primary.duration;
            syncVideos.forEach(v => {
                v.currentTime = targetTime;
            });
            document.getElementById('syncCurrentTime').textContent = formatTime(targetTime);
        }

        function setSyncSpeed(spd) {
            const syncVideos = document.querySelectorAll('.sync-video');
            syncVideos.forEach(v => v.playbackRate = parseFloat(spd));
        }

        function formatTime(seconds) {
            if (isNaN(seconds)) return '00:00';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        }

        /* Lightbox Modal */
        function openLightbox(id) {
            const item = itemMap.get(id);
            if (!item) return;

            const modal = document.getElementById('lightboxModal');
            const body = document.getElementById('lightboxBody');
            const title = document.getElementById('lightboxTitle');

            title.textContent = id + ' - Asset Lightbox';

            const state = cardStates.get(id);
            let src = item.static_src || item.params_src;
            if (state.activeTab === 'params' && item.params_src) src = item.params_src;

            body.innerHTML = src 
                ? `<img src="${src}" class="lightbox-img" alt="Lightbox Asset">`
                : `<div style="color:var(--text-muted)">No image asset available to preview in lightbox</div>`;

            modal.classList.add('open');
        }

        function closeLightbox() {
            document.getElementById('lightboxModal').classList.remove('open');
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeComparisonModal();
                closeLightbox();
            }
        });
    </script>
</body>
</html>
"""

    compare_btn_html = """
            <button class="btn btn-primary" id="compareBtn" onclick="openComparisonModal()" disabled>
                <span>⚔️</span> Compare (<span id="selectedCount">0</span>)
            </button>""" if enable_compare else ""

    compare_modal_html = """
    <!-- Comparison Modal -->
    <div class="modal-overlay" id="compareModal">
        <div class="modal-header">
            <h2 style="font-size: 1.1rem; font-weight: 600;" id="compareModalTitle">Synchronized Video Comparison (9:16)</h2>
            <div style="display: flex; gap: 0.75rem; align-items: center;">
                <select class="select-custom" id="compareModeSelect" onchange="renderCompareBody()">
                    <option value="side-by-side">Side-by-Side View</option>
                    <option value="curtain">Wipe / Curtain Split</option>
                </select>
                <button class="btn" onclick="closeComparisonModal()">✕ Close</button>
            </div>
        </div>
        <div class="modal-body" id="compareModalBody">
            <!-- Dynamically populated -->
        </div>
        <div class="sync-controls" id="syncControls">
            <button class="btn btn-primary" onclick="toggleSyncPlay()" id="syncPlayBtn">▶ Play</button>
            <div class="scrubber-container">
                <span class="time-display" id="syncCurrentTime">00:00</span>
                <input type="range" class="scrubber" id="syncScrubber" min="0" max="100" value="0" step="0.1" oninput="onSyncScrub(this.value)">
                <span class="time-display" id="syncDuration">00:00</span>
            </div>
            <select class="select-custom" onchange="setSyncSpeed(this.value)">
                <option value="0.5">0.5x</option>
                <option value="1" selected>1.0x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
            </select>
        </div>
    </div>""" if enable_compare else ""

    return html_template.replace("__CARDS_HTML__", cards_html)\
                        .replace("__ITEMS_JSON__", items_json)\
                        .replace("__ITEM_COUNT__", str(len(triples)))\
                        .replace("__COMPARE_BTN__", compare_btn_html)\
                        .replace("__COMPARE_MODAL__", compare_modal_html)

if __name__ == "__main__":
    triples = find_triples(LIBRARY_DIR)
    if triples:
        html_out = generate_html(triples)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(html_out)
        print(f"Successfully generated '{OUTPUT_FILE}' with {len(triples)} entries from '{LIBRARY_DIR}'.")
    else:
        print(f"No valid items found in '{LIBRARY_DIR}'.")