const STORAGE_KEY = 'penny:v2';

const MOODS = {
  calm: { primary: '#7dd3fc', secondary: '#0ea5e9', glow: 'rgba(125,211,252,0.24)', ring: 'rgba(125,211,252,0.14)', label: 'calm' },
  happy: { primary: '#86efac', secondary: '#22c55e', glow: 'rgba(134,239,172,0.24)', ring: 'rgba(134,239,172,0.14)', label: 'happy' },
  excited: { primary: '#fcd34d', secondary: '#f59e0b', glow: 'rgba(252,211,77,0.26)', ring: 'rgba(252,211,77,0.16)', label: 'excited' },
  thinking: { primary: '#d8b4fe', secondary: '#8b5cf6', glow: 'rgba(216,180,254,0.25)', ring: 'rgba(216,180,254,0.14)', label: 'thinking' },
  surprised: { primary: '#f9a8d4', secondary: '#ec4899', glow: 'rgba(249,168,212,0.25)', ring: 'rgba(249,168,212,0.14)', label: 'surprised' },
};

const DEFAULT_MEMORY = {
  facts: [],
  sessions: [],
  relationshipScore: 4,
  userName: '',
  voiceOn: false,
  brainMode: 'local',
  sessionId: `penny-local-${Math.random().toString(36).slice(2, 10)}`,
};

const state = {
  panel: 'chat',
  messages: [],
  mood: 'calm',
  presence: 'idle',
  loading: false,
  consolidating: false,
  syncingMemory: false,
  turns: 0,
  backendStatus: null,
  memory: structuredClone(DEFAULT_MEMORY),
};

const els = {
  chat: document.getElementById('chat'),
  composer: document.getElementById('composer'),
  send: document.getElementById('send'),
  moodPill: document.getElementById('moodPill'),
  bondPill: document.getElementById('bondPill'),
  bondBar: document.getElementById('bondBar'),
  bondNote: document.getElementById('bondNote'),
  presenceValue: document.getElementById('presenceValue'),
  turnsValue: document.getElementById('turnsValue'),
  statusValue: document.getElementById('statusValue'),
  statusValueTop: document.getElementById('statusValueTop'),
  coreFace: document.getElementById('coreFace'),
  shell: document.getElementById('shell'),
  intro: document.getElementById('intro'),
  tabs: Array.from(document.querySelectorAll('.tab')),
  views: Array.from(document.querySelectorAll('.view')),
  factList: document.getElementById('factList'),
  profileNoteList: document.getElementById('profileNoteList'),
  sessionList: document.getElementById('sessionList'),
  nameInput: document.getElementById('nameInput'),
  voiceToggle: document.getElementById('voiceToggle'),
  brainModeShadow: document.getElementById('brainModeShadow'),
  brainModeLocal: document.getElementById('brainModeLocal'),
  brainModeNote: document.getElementById('brainModeNote'),
  backendReachability: document.getElementById('backendReachability'),
  backendModel: document.getElementById('backendModel'),
  newChat: document.getElementById('newChat'),
  clearMemory: document.getElementById('clearMemory'),
  refreshMemory: document.getElementById('refreshMemory'),
  clearFacts: document.getElementById('clearFacts'),
  clearProfileNotes: document.getElementById('clearProfileNotes'),
  clearSessions: document.getElementById('clearSessions'),
};

function parseMood(text) {
  const str = String(text || '');
  const all = [...str.matchAll(/\[MOOD:(\w+)\]/g)];
  const lastTag = all.length ? all[all.length - 1][1] : null;
  const mood = lastTag && MOODS[lastTag] ? lastTag : 'calm';
  return { mood, text: str.replace(/\s*\[MOOD:\w+\]\s*/g, '').trim() };
}

function escapeHtml(text) {
  return String(text || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function companionFaceSvg(mood, palette, turns = 0) {
  const flip = Math.abs(Number(turns) || 0) % 2;
  const variant = Math.abs(Number(turns) || 0) % 4;
  const openEye = (cx, cy, { wide = false, soft = false, sparkle = false } = {}) => `
    <g class="avatar-eye" transform="translate(${cx} ${cy})">
      <path d="M -14 0 Q 0 -${wide ? 12.4 : soft ? 9.2 : 10.8} 14 0 Q 0 ${wide ? 12.4 : soft ? 8.8 : 10.4} -14 0 Z" fill="#fff9fd" />
      <ellipse cx="0" cy="1.4" rx="${wide ? 8.9 : soft ? 7.7 : 8.2}" ry="${wide ? 10.7 : soft ? 8.2 : 9.5}" fill="url(#eyeTone)" />
      ${sparkle ? `<path d="M0 -4.6 l1.9 3.8 l4.2 .7 l-3.1 2.8 l.8 4 l-3.8 -1.9 l-3.8 1.9 l.8 -4 l-3.1 -2.8 l4.2 -.7 z" fill="#15121a" />` : `<ellipse cx="0" cy="4" rx="${wide ? 4.8 : 4.3}" ry="${wide ? 5.8 : 5.2}" class="pupil" />`}
      <circle cx="-4.3" cy="-4.3" r="2.5" class="eye-shine" />
      <ellipse cx="4.5" cy="5.9" rx="1.5" ry="2.1" fill="rgba(255,255,255,.64)" />
      <path d="M -13.5 -1 Q 0 -${wide ? 12.3 : soft ? 8.6 : 10.6} 13.5 -1" fill="none" stroke="#271822" stroke-width="3.2" stroke-linecap="round" />
    </g>
  `;
  const halfEye = (cx, cy, { sly = false } = {}) => `
    <g class="avatar-eye-half" transform="translate(${cx} ${cy})">
      <path d="M -12 0 Q 0 -${sly ? 5.8 : 6.8} 12 0 Q 0 ${sly ? 3.6 : 4.5} -12 0 Z" fill="#fff9fd" />
      <ellipse cx="0" cy="1" rx="${sly ? 7.4 : 6.5}" ry="${sly ? 4.7 : 5.3}" fill="url(#eyeTone)" />
      <ellipse cx=".8" cy="1.8" rx="3.6" ry="4" class="pupil" />
      <circle cx="-3.7" cy="-2.3" r="1.8" class="eye-shine" />
      <path d="M -12.3 -1 Q 0 -${sly ? 7 : 8.1} 12.3 -1" fill="none" stroke="#271822" stroke-width="3" stroke-linecap="round" />
    </g>
  `;
  const winkEye = (cx, cy, { cheeky = false } = {}) => `<path d="M ${cx - 12} ${cy} Q ${cx} ${cy - (cheeky ? 6.8 : 5.6)} ${cx + 12} ${cy}" fill="none" stroke="#271822" stroke-width="3.4" stroke-linecap="round" />`;
  const smileEye = (cx, cy, { bright = false } = {}) => `
    <g class="avatar-eye-smile" transform="translate(${cx} ${cy})">
      <path d="M -12 0 Q 0 -${bright ? 7.5 : 6.3} 12 0" fill="none" stroke="#271822" stroke-width="3.3" stroke-linecap="round" />
      <path d="M -8 -2 Q 0 -${bright ? 3.8 : 3.1} 8 -2" fill="none" stroke="rgba(255,250,252,.7)" stroke-width="1.3" stroke-linecap="round" opacity=".8" />
    </g>
  `;
  const mitten = (x, y, rotate = 0, scale = 1) => `
    <g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})">
      <ellipse cx="0" cy="0" rx="8.6" ry="8" fill="url(#skinTone)" />
      <ellipse cx="5.8" cy="2.1" rx="3.8" ry="3.1" fill="url(#skinTone)" opacity=".94" />
    </g>
  `;
  const peaceHand = (x, y, rotate = 0, scale = 1) => `
    <g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})">
      <ellipse cx="0" cy="11" rx="8.6" ry="9.2" fill="url(#skinTone)" />
      <rect x="-6.4" y="-14" width="5.2" height="27" rx="2.6" fill="url(#skinTone)" />
      <rect x="2" y="-17" width="5.2" height="30" rx="2.6" fill="url(#skinTone)" />
      <ellipse cx="8.2" cy="9.3" rx="3.4" ry="4.7" fill="url(#skinTone)" />
    </g>
  `;
  const props = {
    glasses: `
      <g class="avatar-glasses">
        <circle cx="108" cy="118" r="15" />
        <circle cx="142" cy="118" r="15" />
        <path d="M123 117 H127" />
        <path d="M93 118 H84" />
        <path d="M157 118 H166" />
      </g>
    `,
    phone: `
      <g class="avatar-prop avatar-phone" transform="translate(154 183) rotate(-10)">
        <rect x="0" y="0" width="22" height="36" rx="6" />
        <rect x="3" y="4" width="16" height="24" rx="3" class="avatar-phone-screen" />
        <circle cx="11" cy="31" r="1.8" class="avatar-phone-dot" />
      </g>
    `,
    holo: `
      <g class="avatar-prop avatar-holo" transform="translate(150 144) rotate(-7)">
        <rect x="0" y="0" width="34" height="22" rx="6" />
        <path d="M 6 7 H 28" />
        <path d="M 6 12 H 24" />
        <path d="M 6 17 H 20" />
      </g>
    `,
    ping: `
      <g class="avatar-prop avatar-ping" transform="translate(164 82) rotate(-8)">
        <rect x="0" y="0" width="32" height="18" rx="6" />
        <circle cx="7" cy="9" r="3" />
        <path d="M 14 9 H 25" />
      </g>
    `,
    heartNote: `
      <g class="avatar-prop avatar-heart-note" transform="translate(166 88) rotate(-10)">
        <rect x="0" y="0" width="24" height="18" rx="6" fill="rgba(18,16,26,.84)" stroke="rgba(255,255,255,.18)" stroke-width="1.1" />
        <path d="M8 8 c0 -2 2 -4 4 -4 c1.6 0 2.8 .7 3.4 2 c.6 -1.3 1.8 -2 3.4 -2 c2 0 4 1.6 4 4 c0 2.6 -2.6 4.7 -5.7 7 c-3.1 -2.3 -5.1 -4.4 -5.1 -7 z" fill="#ffb4bf" />
      </g>
    `,
  };
  const sprites = {
    calm: {
      label: ['SOFT LINK', 'CASUAL CHAOS', 'OH, YOU', 'CLOSER'][variant],
      tilt: [flip ? -3 : 2, -2, -7, -4][variant],
      shift: [0, 0, 1, 1][variant],
      frameScale: [1.28, 1.28, 2.08, 2.36][variant],
      frameY: [170, 170, 112, 98][variant],
      leftArm: [
        `<path d="M95 154 C84 168 82 190 86 211 C89 220 97 221 103 213 C99 193 99 173 103 157 Z" fill="url(#sleeveLight)" />${mitten(101, 215, -10)}`,
        `<path d="M96 154 C84 167 83 188 87 208 C90 217 98 218 103 210 C99 190 99 172 103 157 Z" fill="url(#sleeveLight)" />${mitten(101, 211, -10)}`,
        `<path d="M95 154 C82 167 79 189 84 210 C87 220 95 221 101 212 C98 192 98 173 102 157 Z" fill="url(#sleeveLight)" />${mitten(100, 215, -8)}`,
        `<path d="M97 160 C109 170 122 172 137 168 C139 179 130 186 120 186 C108 186 98 179 92 166 Z" fill="url(#sleeveLight)" />${mitten(116, 183, -12, .94)}`,
      ][variant],
      rightArm: [
        `<path d="M150 154 C162 168 164 190 160 211 C157 220 149 221 144 213 C147 193 147 173 144 157 Z" fill="url(#sleeveLight)" />${mitten(146, 215, 8)}`,
        `<path d="M150 154 C162 168 163 186 160 204 C157 213 150 214 145 206 C148 189 148 172 145 156 Z" fill="url(#sleeveLight)" />${mitten(148, 208, -10)}`,
        `<path d="M150 154 C164 160 170 149 170 135 C170 123 164 116 156 117 C154 129 152 141 148 151 Z" fill="url(#sleeveLight)" />${mitten(149, 138, -18)}`,
        `<path d="M150 154 C164 160 170 149 170 135 C170 123 164 116 156 117 C154 129 152 141 148 151 Z" fill="url(#sleeveLight)" />${mitten(149, 140, -18)}`,
      ][variant],
      brows: [
        `<path d="M95 105 Q107 99 118 103" /><path d="M131 103 Q143 98 154 104" />`,
        `<path d="M95 105 Q107 100 118 104" /><path d="M131 104 Q143 99 154 103" />`,
        `<path d="M95 106 Q108 99 119 103" /><path d="M132 100 Q143 93 154 100" />`,
        `<path d="M95 106 Q107 101 118 105" /><path d="M132 105 Q143 101 154 105" />`,
      ][variant],
      eyes: [
        `${openEye(108, 119, { soft: true })}${openEye(142, 118, { soft: true })}`,
        `${halfEye(108, 120)}${openEye(142, 118, { soft: true })}`,
        `${halfEye(108, 120, { sly: true })}${halfEye(142, 119, { sly: true })}`,
        `${halfEye(108, 119)}${halfEye(142, 119)}`,
      ][variant],
      mouth: [
        `<path d="M116 150 Q127 156 138 147" />`,
        `<path d="M117 150 Q127 154 138 146" />`,
        `<path d="M115 150 Q127 161 140 143" />`,
        `<path d="M115 150 Q127 160 139 147" />`,
      ][variant],
      blush: [
        flip ? `<ellipse cx="90" cy="136" rx="8" ry="4.5" fill="rgba(255,163,176,.2)" /><ellipse cx="160" cy="135" rx="8" ry="4.5" fill="rgba(255,163,176,.2)" />` : '',
        '',
        `<ellipse cx="90" cy="136" rx="9.5" ry="5.2" fill="rgba(255,163,176,.28)" /><ellipse cx="160" cy="135" rx="9.5" ry="5.2" fill="rgba(255,163,176,.28)" />`,
        `<ellipse cx="91" cy="136" rx="10" ry="5.4" fill="rgba(255,163,176,.3)" /><ellipse cx="160" cy="135" rx="10" ry="5.4" fill="rgba(255,163,176,.3)" />`,
      ][variant],
      faceAccessory: ['', props.glasses, '', ''][variant],
      prop: ['', props.phone, '', ''][variant],
      icons: [
        `<circle cx="62" cy="80" r="3" class="avatar-icon soft" /><path d="M182 78 l4 -8 l4 8 l-8 0" class="avatar-icon soft" />`,
        `<circle cx="58" cy="79" r="3.4" class="avatar-icon soft" /><path d="M176 74 c0 -4 3 -6 6 -6 c2 0 4 1 5 3 c1 -2 3 -3 5 -3 c3 0 6 2 6 6 c0 4 -5 7 -11 12 c-6 -5 -11 -8 -11 -12 z" class="avatar-icon warm" />`,
        `<path d="M54 82 l6 -12 l6 12 l-12 0" class="avatar-icon" /><path d="M176 73 c0 -4 3 -7 7 -7 c2 0 4 1 5 3 c1 -2 3 -3 5 -3 c4 0 7 3 7 7 c0 5 -5 8 -12 14 c-7 -6 -12 -9 -12 -14 z" class="avatar-icon warm" />`,
        `<circle cx="61" cy="79" r="3.2" class="avatar-icon soft" /><path d="M181 76 c0 -4 3 -6 6 -6 c2 0 4 1 5 3 c1 -2 3 -3 5 -3 c3 0 6 2 6 6 c0 4 -5 7 -11 12 c-6 -5 -11 -8 -11 -12 z" class="avatar-icon warm" />`,
      ][variant],
    },
    happy: {
      label: ['CHARM MODE', 'PEACE MODE', 'CUTIE DAMAGE', 'HEART THIEF'][variant],
      tilt: [-6, -8, -3, -5][variant],
      shift: [0, 0, 0, 1][variant],
      frameScale: [1.28, 1.32, 1.96, 2.16][variant],
      frameY: [170, 166, 120, 108][variant],
      leftArm: [
        `<path d="M96 154 C80 160 72 181 77 200 C82 214 95 216 104 208 C99 190 99 174 103 157 Z" fill="url(#sleeveLight)" />${mitten(90, 207, -8)}`,
        `<path d="M96 154 C80 160 72 181 77 200 C82 214 95 216 104 208 C99 190 99 174 103 157 Z" fill="url(#sleeveLight)" />${mitten(90, 207, -8)}`,
        `<path d="M96 157 C86 167 85 186 89 203 C92 210 99 212 104 205 C101 188 101 173 104 158 Z" fill="url(#sleeveLight)" />${mitten(98, 205, -10, .96)}`,
        `<path d="M97 160 C109 170 122 172 137 168 C139 179 130 186 120 186 C108 186 98 179 92 166 Z" fill="url(#sleeveLight)" />${mitten(116, 183, -10, .96)}`,
      ][variant],
      rightArm: [
        `<path d="M150 153 C172 157 185 139 191 120 C194 109 189 102 180 103 C170 106 161 121 150 144 Z" fill="url(#sleeveLight)" />${peaceHand(184, 108, -8, 1)}`,
        `<path d="M150 153 C172 157 185 139 191 120 C194 109 189 102 180 103 C170 106 161 121 150 144 Z" fill="url(#sleeveLight)" />${peaceHand(184, 108, -12, 1)}`,
        `<path d="M150 153 C169 158 181 146 187 129 C190 118 186 110 178 111 C169 114 161 126 151 145 Z" fill="url(#sleeveLight)" />${peaceHand(181, 116, -10, .96)}`,
        `<path d="M150 154 C165 160 170 148 170 135 C170 124 164 118 156 119 C154 130 152 141 148 151 Z" fill="url(#sleeveLight)" />${peaceHand(179, 120, -14, .92)}`,
      ][variant],
      brows: [
        `<path d="M96 106 Q108 101 118 106" /><path d="M132 105 Q144 100 154 106" />`,
        `<path d="M96 106 Q108 100 118 105" /><path d="M132 104 Q144 100 154 105" />`,
        `<path d="M96 104 Q108 98 118 104" /><path d="M132 104 Q144 98 154 104" />`,
        `<path d="M96 106 Q108 100 118 106" /><path d="M132 105 Q144 100 154 106" />`,
      ][variant],
      eyes: [
        flip ? `${openEye(108, 118)}${winkEye(142, 120, { cheeky: true })}` : `${winkEye(108, 120, { cheeky: true })}${openEye(142, 118)}`,
        flip ? `${winkEye(108, 120, { cheeky: true })}${openEye(142, 118)}` : `${openEye(108, 118)}${winkEye(142, 120, { cheeky: true })}`,
        `${openEye(108, 118)}${openEye(142, 118)}`,
        `${smileEye(108, 119, { bright: true })}${smileEye(142, 119, { bright: true })}`,
      ][variant],
      mouth: [
        `<path d="M113 148 Q127 164 139 147" /><path d="M116 153 Q127 159 136 152" class="avatar-mouth-fill" />`,
        `<path d="M113 148 Q127 164 139 147" /><path d="M116 153 Q127 159 136 152" class="avatar-mouth-fill" />`,
        `<path d="M112 146 Q127 165 140 146" /><path d="M116 151 Q127 161 137 150" class="avatar-mouth-fill" />`,
        `<path d="M111 148 Q127 168 143 148" /><path d="M116 153 Q127 164 138 153" class="avatar-mouth-fill" />`,
      ][variant],
      blush: [
        `<ellipse cx="91" cy="136" rx="9" ry="5" fill="rgba(255,163,176,.28)" /><ellipse cx="160" cy="135" rx="9" ry="5" fill="rgba(255,163,176,.28)" />`,
        `<ellipse cx="91" cy="136" rx="9" ry="5" fill="rgba(255,163,176,.28)" /><ellipse cx="160" cy="135" rx="9" ry="5" fill="rgba(255,163,176,.28)" />`,
        `<ellipse cx="91" cy="136" rx="10" ry="5.2" fill="rgba(255,163,176,.3)" /><ellipse cx="160" cy="135" rx="10" ry="5.2" fill="rgba(255,163,176,.3)" />`,
        `<ellipse cx="91" cy="136" rx="11.5" ry="6" fill="rgba(255,163,176,.38)" /><ellipse cx="160" cy="135" rx="11.5" ry="6" fill="rgba(255,163,176,.38)" />`,
      ][variant],
      faceAccessory: '',
      prop: ['', '', '', props.heartNote][variant],
      icons: [
        `<path d="M56 82 l6 -12 l6 12 l-12 0" class="avatar-icon" /><path d="M176 72 c0 -5 4 -8 8 -8 c3 0 5 1 6 4 c1 -3 4 -4 7 -4 c4 0 8 3 8 8 c0 6 -6 10 -14 16 c-8 -6 -15 -10 -15 -16 z" class="avatar-icon warm" />`,
        `<path d="M56 82 l6 -12 l6 12 l-12 0" class="avatar-icon" /><path d="M176 72 c0 -5 4 -8 8 -8 c3 0 5 1 6 4 c1 -3 4 -4 7 -4 c4 0 8 3 8 8 c0 6 -6 10 -14 16 c-8 -6 -15 -10 -15 -16 z" class="avatar-icon warm" />`,
        `<circle cx="59" cy="79" r="4" class="avatar-icon soft" /><path d="M176 72 c0 -5 4 -8 8 -8 c3 0 5 1 6 4 c1 -3 4 -4 7 -4 c4 0 8 3 8 8 c0 6 -6 10 -14 16 c-8 -6 -15 -10 -15 -16 z" class="avatar-icon warm" />`,
        `<path d="M54 82 l6 -12 l6 12 l-12 0" class="avatar-icon" /><path d="M176 72 c0 -5 4 -8 8 -8 c3 0 5 1 6 4 c1 -3 4 -4 7 -4 c4 0 8 3 8 8 c0 6 -6 10 -14 16 c-8 -6 -15 -10 -15 -16 z" class="avatar-icon warm" /><circle cx="194" cy="66" r="2.8" class="avatar-icon soft" />`,
      ][variant],
    },
    excited: {
      label: ['MAX HYPE', 'SHOW OFF', 'LOOK AT ME', 'GREMLIN MODE'][variant],
      tilt: [-10, -8, -4, -10][variant],
      shift: [-3, -2, 0, -2][variant],
      frameScale: [1.52, 1.52, 1.94, 1.94][variant],
      frameY: [148, 148, 118, 118][variant],
      leftArm: [
        `<path d="M96 154 C70 153 56 138 50 121 C47 109 53 102 64 106 C76 110 85 124 97 146 Z" fill="url(#sleeveLight)" />${mitten(53, 117, -18, 1.02)}`,
        `<path d="M96 154 C70 153 56 138 50 121 C47 109 53 102 64 106 C76 110 85 124 97 146 Z" fill="url(#sleeveLight)" />${mitten(53, 117, -18, 1.02)}`,
        `<path d="M96 157 C83 164 76 179 79 194 C82 205 92 208 100 201 C96 186 97 171 101 158 Z" fill="url(#sleeveLight)" />${mitten(93, 200, -10)}`,
        `<path d="M95 154 C82 167 80 186 84 204 C87 213 95 214 101 206 C98 189 98 172 102 157 Z" fill="url(#sleeveLight)" />${mitten(100, 208, -10)}`,
      ][variant],
      rightArm: [
        `<path d="M149 154 C175 153 189 138 195 121 C198 109 191 102 180 106 C168 110 159 124 147 146 Z" fill="url(#sleeveLight)" />${mitten(193, 117, 18, 1.02)}`,
        `<path d="M149 154 C175 153 189 138 195 121 C198 109 191 102 180 106 C168 110 159 124 147 146 Z" fill="url(#sleeveLight)" />${mitten(193, 117, 18, 1.02)}`,
        `<path d="M149 154 C164 160 170 149 170 135 C170 123 164 116 156 117 C154 129 152 141 148 151 Z" fill="url(#sleeveLight)" />${mitten(149, 138, -18)}`,
        `<path d="M150 154 C167 161 173 149 171 134 C169 123 162 117 154 118 C153 130 151 141 147 151 Z" fill="url(#sleeveLight)" />${mitten(150, 139, -16)}`,
      ][variant],
      brows: [
        `<path d="M94 105 Q108 93 120 103" /><path d="M132 103 Q145 92 156 104" />`,
        `<path d="M94 105 Q108 95 120 103" /><path d="M132 103 Q145 93 156 104" />`,
        `<path d="M95 104 Q108 95 120 102" /><path d="M132 103 Q145 94 156 103" />`,
        `<path d="M94 104 Q107 96 119 101" /><path d="M132 102 Q145 95 156 103" />`,
      ][variant],
      eyes: [
        `${openEye(107, 117, { wide: true, sparkle: true })}${openEye(143, 117, { wide: true, sparkle: true })}`,
        `${openEye(107, 117, { wide: true, sparkle: true })}${openEye(143, 117, { wide: true, sparkle: true })}`,
        `${openEye(108, 118, { wide: true, sparkle: true })}${openEye(142, 118, { wide: true, sparkle: true })}`,
        `${halfEye(108, 120, { sly: true })}${openEye(143, 117, { wide: true })}`,
      ][variant],
      mouth: [
        `<path d="M112 145 Q127 168 140 145" /><path d="M116 151 Q127 162 137 151" class="avatar-mouth-fill" />`,
        `<path d="M112 145 Q127 168 140 145" /><path d="M116 151 Q127 162 137 151" class="avatar-mouth-fill" />`,
        `<path d="M111 144 Q127 169 141 144" /><path d="M116 150 Q127 163 138 150" class="avatar-mouth-fill" />`,
        `<path d="M112 145 Q127 166 142 145" /><path d="M117 151 Q127 162 137 151" class="avatar-mouth-fill" /><path d="M131 150 l2.6 7.5 l2.6 -7.5 z" class="avatar-fang" /><path d="M119 150 l-2.6 7.5 l-2.6 -7.5 z" class="avatar-fang" />`,
      ][variant],
      blush: [
        `<ellipse cx="91" cy="136" rx="9" ry="5" fill="rgba(255,163,176,.28)" /><ellipse cx="160" cy="136" rx="9" ry="5" fill="rgba(255,163,176,.28)" />`,
        `<ellipse cx="91" cy="136" rx="9" ry="5" fill="rgba(255,163,176,.28)" /><ellipse cx="160" cy="136" rx="9" ry="5" fill="rgba(255,163,176,.28)" />`,
        `<ellipse cx="91" cy="136" rx="9.5" ry="5.2" fill="rgba(255,163,176,.3)" /><ellipse cx="160" cy="136" rx="9.5" ry="5.2" fill="rgba(255,163,176,.3)" />`,
        `<ellipse cx="91" cy="136" rx="9.5" ry="5.2" fill="rgba(255,163,176,.3)" /><ellipse cx="160" cy="136" rx="9.5" ry="5.2" fill="rgba(255,163,176,.3)" />`,
      ][variant],
      faceAccessory: ['', '', props.glasses, ''][variant],
      prop: ['', props.phone, '', ''][variant],
      icons: [
        `<path d="M48 74 c0 -5 4 -8 8 -8 c3 0 5 1 7 5 c1 -4 4 -5 7 -5 c5 0 8 3 8 8 c0 7 -6 11 -15 17 c-9 -6 -15 -10 -15 -17 z" class="avatar-icon warm" /><path d="M181 70 l5 -10 l5 10 l-10 0" class="avatar-icon" />`,
        `<path d="M48 74 c0 -5 4 -8 8 -8 c3 0 5 1 7 5 c1 -4 4 -5 7 -5 c5 0 8 3 8 8 c0 7 -6 11 -15 17 c-9 -6 -15 -10 -15 -17 z" class="avatar-icon warm" /><path d="M181 70 l5 -10 l5 10 l-10 0" class="avatar-icon" />`,
        `<path d="M48 74 c0 -5 4 -8 8 -8 c3 0 5 1 7 5 c1 -4 4 -5 7 -5 c5 0 8 3 8 8 c0 7 -6 11 -15 17 c-9 -6 -15 -10 -15 -17 z" class="avatar-icon warm" /><path d="M181 70 l5 -10 l5 10 l-10 0" class="avatar-icon" /><circle cx="193" cy="64" r="2.8" class="avatar-icon soft" />`,
        `<path d="M54 82 l6 -12 l6 12 l-12 0" class="avatar-icon" /><path d="M182 72 c0 -5 4 -8 8 -8 c3 0 5 1 6 4 c1 -3 4 -4 7 -4 c4 0 8 3 8 8 c0 6 -6 10 -14 16 c-8 -6 -15 -10 -15 -16 z" class="avatar-icon warm" />`,
      ][variant],
    },
    thinking: {
      label: ['TACTICAL CUTE', 'SCAN MODE', 'LOCKED IN', 'READING YOU'][variant],
      tilt: [4, 2, 0, -4][variant],
      shift: [2, 2, 0, 1][variant],
      frameScale: [1.28, 2.14, 1.88, 2.16][variant],
      frameY: [170, 102, 120, 116][variant],
      leftArm: [
        `<path d="M96 160 C108 171 121 173 137 170 C139 181 129 188 119 188 C107 188 96 180 91 166 Z" fill="url(#sleeveLight)" />`,
        `<path d="M96 160 C108 171 121 173 137 170 C139 181 129 188 119 188 C107 188 96 180 91 166 Z" fill="url(#sleeveLight)" />`,
        `<path d="M96 160 C108 171 121 173 137 170 C139 181 129 188 119 188 C107 188 96 180 91 166 Z" fill="url(#sleeveLight)" />`,
        `<path d="M97 160 C109 170 122 172 137 168 C139 179 130 186 120 186 C108 186 98 179 92 166 Z" fill="url(#sleeveLight)" />${mitten(116, 183, -10, .94)}`,
      ][variant],
      rightArm: [
        `<path d="M150 155 C168 160 169 145 165 130 C161 118 154 112 147 115 C147 128 146 140 143 151 Z" fill="url(#sleeveLight)" />${mitten(147, 136, -12)}`,
        `<path d="M150 155 C168 160 169 145 165 130 C161 118 154 112 147 115 C147 128 146 140 143 151 Z" fill="url(#sleeveLight)" />${mitten(147, 136, -12)}`,
        `<path d="M150 155 C168 160 169 145 165 130 C161 118 154 112 147 115 C147 128 146 140 143 151 Z" fill="url(#sleeveLight)" />${mitten(147, 136, -12)}`,
        `<path d="M150 154 C165 159 169 147 167 134 C165 123 158 116 151 118 C150 129 149 140 145 151 Z" fill="url(#sleeveLight)" />${mitten(149, 137, -18)}`,
      ][variant],
      brows: [
        `<path d="M95 108 Q107 100 118 105" /><path d="M133 102 Q144 99 154 106" />`,
        `<path d="M95 108 Q107 100 118 105" /><path d="M133 102 Q144 99 154 106" />`,
        `<path d="M95 106 Q107 99 118 103" /><path d="M133 102 Q144 98 154 104" />`,
        `<path d="M95 105 Q108 98 119 102" /><path d="M132 102 Q144 97 154 102" />`,
      ][variant],
      eyes: [
        `${halfEye(107, 120)}${openEye(142, 117, { soft: true })}`,
        `${halfEye(107, 120)}${openEye(142, 117, { soft: true })}`,
        `${halfEye(107, 119, { sly: true })}${halfEye(142, 119)}`,
        `${halfEye(107, 119, { sly: true })}${halfEye(142, 120, { sly: true })}`,
      ][variant],
      mouth: [
        `<path d="M115 151 Q127 147 138 151" />`,
        `<path d="M115 151 Q127 147 138 151" />`,
        `<path d="M116 150 Q127 148 138 149" />`,
        `<path d="M115 149 Q127 158 140 145" />`,
      ][variant],
      blush: ['', '', '', `<ellipse cx="91" cy="136" rx="9.5" ry="5.2" fill="rgba(255,163,176,.26)" /><ellipse cx="160" cy="135" rx="9.5" ry="5.2" fill="rgba(255,163,176,.26)" />`][variant],
      faceAccessory: [props.glasses, props.glasses, '', ''][variant],
      prop: ['', props.holo, props.phone, ''][variant],
      icons: [
        `<circle cx="184" cy="80" r="5" class="avatar-thought-ring" /><circle cx="194" cy="69" r="3" class="avatar-thought-ring soft" />`,
        `<circle cx="184" cy="80" r="5" class="avatar-thought-ring" /><circle cx="194" cy="69" r="3" class="avatar-thought-ring soft" />`,
        `<circle cx="184" cy="80" r="5" class="avatar-thought-ring" /><circle cx="194" cy="69" r="3" class="avatar-thought-ring soft" /><circle cx="52" cy="80" r="3.2" class="avatar-icon soft" />`,
        `<circle cx="184" cy="80" r="5" class="avatar-thought-ring" /><circle cx="194" cy="69" r="3" class="avatar-thought-ring soft" /><path d="M54 82 l6 -12 l6 12 l-12 0" class="avatar-icon soft" />`,
      ][variant],
    },
    surprised: {
      label: ['HEART SPIKE', 'PINGED', 'OH WOW', 'FLUSTERED'][variant],
      tilt: [1, 1, -1, -3][variant],
      shift: [0, 0, 1, 0][variant],
      frameScale: [1.28, 1.28, 2.16, 2.38][variant],
      frameY: [170, 170, 104, 96][variant],
      leftArm: [
        `<path d="M97 157 C80 156 69 162 66 176 C64 188 75 194 87 191 C93 181 100 173 108 168 Z" fill="url(#sleeveLight)" />${mitten(84, 184, -26)}`,
        `<path d="M97 157 C80 156 69 162 66 176 C64 188 75 194 87 191 C93 181 100 173 108 168 Z" fill="url(#sleeveLight)" />${mitten(84, 184, -26)}`,
        `<path d="M97 157 C80 156 69 162 66 176 C64 188 75 194 87 191 C93 181 100 173 108 168 Z" fill="url(#sleeveLight)" />${mitten(84, 184, -26)}`,
        `<path d="M98 158 C87 159 78 166 76 178 C74 188 82 193 90 191 C95 183 101 176 108 170 Z" fill="url(#sleeveLight)" />${mitten(89, 183, -18)}`,
      ][variant],
      rightArm: [
        `<path d="M149 157 C166 156 177 162 180 176 C182 188 171 194 159 191 C153 181 146 173 138 168 Z" fill="url(#sleeveLight)" />${mitten(161, 184, 26)}`,
        `<path d="M149 157 C166 156 177 162 180 176 C182 188 171 194 159 191 C153 181 146 173 138 168 Z" fill="url(#sleeveLight)" />${mitten(161, 184, 26)}`,
        `<path d="M149 157 C166 156 177 162 180 176 C182 188 171 194 159 191 C153 181 146 173 138 168 Z" fill="url(#sleeveLight)" />${mitten(161, 184, 26)}`,
        `<path d="M148 158 C159 159 168 166 170 178 C172 188 164 193 156 191 C151 183 145 176 138 170 Z" fill="url(#sleeveLight)" />${mitten(157, 183, 18)}`,
      ][variant],
      brows: [
        `<path d="M95 103 Q108 92 120 100" /><path d="M132 101 Q145 91 156 101" />`,
        `<path d="M95 103 Q108 92 120 100" /><path d="M132 101 Q145 91 156 101" />`,
        `<path d="M95 103 Q108 94 120 101" /><path d="M132 101 Q145 92 156 101" />`,
        `<path d="M96 106 Q108 100 119 105" /><path d="M132 105 Q144 100 154 105" />`,
      ][variant],
      eyes: [
        `${openEye(107, 117, { wide: true })}${openEye(143, 117, { wide: true })}`,
        `${openEye(107, 117, { wide: true })}${openEye(143, 117, { wide: true })}`,
        `${openEye(108, 118, { wide: true })}${openEye(142, 118, { wide: true })}`,
        `${halfEye(108, 119)}${halfEye(142, 119)}`,
      ][variant],
      mouth: [
        `<ellipse cx="127" cy="151" rx="10" ry="12" class="avatar-mouth-open" />`,
        `<ellipse cx="127" cy="151" rx="10" ry="12" class="avatar-mouth-open" />`,
        `<ellipse cx="127" cy="151" rx="9" ry="11" class="avatar-mouth-open" />`,
        `<path d="M119 152 Q123 156 127 152 Q131 156 135 152" />`,
      ][variant],
      blush: [
        `<ellipse cx="91" cy="136" rx="10" ry="5.5" fill="rgba(255,163,176,.3)" /><ellipse cx="160" cy="136" rx="10" ry="5.5" fill="rgba(255,163,176,.3)" />`,
        `<ellipse cx="91" cy="136" rx="10" ry="5.5" fill="rgba(255,163,176,.3)" /><ellipse cx="160" cy="136" rx="10" ry="5.5" fill="rgba(255,163,176,.3)" />`,
        `<ellipse cx="91" cy="136" rx="10.5" ry="5.8" fill="rgba(255,163,176,.32)" /><ellipse cx="160" cy="136" rx="10.5" ry="5.8" fill="rgba(255,163,176,.32)" />`,
        `<ellipse cx="91" cy="136" rx="13" ry="7" fill="rgba(255,163,176,.44)" /><ellipse cx="160" cy="136" rx="13" ry="7" fill="rgba(255,163,176,.44)" />`,
      ][variant],
      faceAccessory: '',
      prop: ['', props.ping, '', props.heartNote][variant],
      icons: [
        `<path d="M183 66 l0 20" class="avatar-alarm" /><circle cx="183" cy="92" r="3" class="avatar-alarm-dot" /><path d="M54 82 l5 -10 l5 10 l-10 0" class="avatar-icon" />`,
        `<path d="M183 66 l0 20" class="avatar-alarm" /><circle cx="183" cy="92" r="3" class="avatar-alarm-dot" /><path d="M54 82 l5 -10 l5 10 l-10 0" class="avatar-icon" />`,
        `<path d="M183 66 l0 20" class="avatar-alarm" /><circle cx="183" cy="92" r="3" class="avatar-alarm-dot" /><path d="M54 82 l5 -10 l5 10 l-10 0" class="avatar-icon" /><circle cx="194" cy="65" r="2.8" class="avatar-icon soft" />`,
        `<path d="M176 72 c0 -5 4 -8 8 -8 c3 0 5 1 6 4 c1 -3 4 -4 7 -4 c4 0 8 3 8 8 c0 6 -6 10 -14 16 c-8 -6 -15 -10 -15 -16 z" class="avatar-icon warm" /><circle cx="54" cy="82" r="3.2" class="avatar-icon soft" />`,
      ][variant],
    },
  };
  const s = sprites[mood] || sprites.calm;
  const frameScale = s.frameScale || 1.28;
  const frameY = s.frameY || 170;
  return `
    <svg class="avatar-sprite avatar-${mood}" viewBox="0 0 240 320" aria-hidden="true">
      <defs>
        <linearGradient id="screenGlow" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="${palette.primary}" stop-opacity=".24" /><stop offset="42%" stop-color="#090d14" stop-opacity=".05" /><stop offset="100%" stop-color="${palette.secondary}" stop-opacity=".22" /></linearGradient>
        <linearGradient id="hairTone" x1="10%" x2="84%" y1="0%" y2="100%"><stop offset="0%" stop-color="#ffbf87" /><stop offset="38%" stop-color="#ff8a67" /><stop offset="100%" stop-color="#8d3556" /></linearGradient>
        <linearGradient id="hairShade" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#a54154" /><stop offset="100%" stop-color="#4c1e34" /></linearGradient>
        <linearGradient id="hairLight" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#fff3cc" stop-opacity=".92" /><stop offset="100%" stop-color="#fff" stop-opacity="0" /></linearGradient>
        <linearGradient id="skinTone" x1="24%" x2="76%" y1="0%" y2="100%"><stop offset="0%" stop-color="#ffe2d3" /><stop offset="100%" stop-color="#eeb29f" /></linearGradient>
        <linearGradient id="eyeTone" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#ff6eaa" /><stop offset="100%" stop-color="#8a49ff" /></linearGradient>
        <linearGradient id="coatLight" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#f6e7df" /><stop offset="100%" stop-color="#d1d7e3" /></linearGradient>
        <linearGradient id="sleeveLight" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#f2d2ca" /><stop offset="100%" stop-color="#e0aaa4" /></linearGradient>
        <linearGradient id="coatAccent" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#ffbb74" /><stop offset="100%" stop-color="#f06f5d" /></linearGradient>
        <linearGradient id="vestTone" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#ffb678" /><stop offset="100%" stop-color="#ef7b63" /></linearGradient>
        <linearGradient id="skirtTone" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#2c2330" /><stop offset="100%" stop-color="#120f19" /></linearGradient>
        <linearGradient id="sockTone" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#1d2129" /><stop offset="100%" stop-color="#090b10" /></linearGradient>
        <linearGradient id="shoeTone" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#1f2330" /><stop offset="100%" stop-color="#07090d" /></linearGradient>
        <clipPath id="screenClip"><rect x="18" y="18" width="204" height="284" rx="34" /></clipPath>
      </defs>
      <g clip-path="url(#screenClip)">
        <rect x="18" y="18" width="204" height="284" rx="34" fill="#05070b" />
        <rect x="18" y="18" width="204" height="284" rx="34" fill="url(#screenGlow)" />
        <path d="M18 64 Q120 14 222 60" fill="rgba(255,255,255,.04)" />
        <path d="M18 246 Q120 306 222 246" fill="rgba(255,132,102,.12)" />
        <g class="avatar-grid"><path d="M28 76 H212" /><path d="M28 132 H212" /><path d="M28 188 H212" /><path d="M28 244 H212" /></g>
        <ellipse cx="120" cy="149" rx="84" ry="104" class="avatar-aura" />
        <ellipse cx="120" cy="282" rx="56" ry="12" class="avatar-floor-glow" />
        <g class="avatar-icons">${s.icons}</g>
        ${s.prop || ''}
        <g class="avatar-character" transform="translate(120 ${frameY}) scale(${frameScale}) translate(-120 ${s.shift - frameY})">
          <path d="M113 218 C109 242 109 268 111 295 L123 295 C124 270 127 244 131 218 Z" fill="url(#skinTone)" />
          <path d="M132 218 C129 242 130 268 131 295 L143 295 C144 270 147 244 150 218 Z" fill="url(#skinTone)" />
          <path d="M112 231 C112 254 112 277 113 295 L124 295 C125 277 127 254 129 231 Z" fill="url(#sockTone)" />
          <path d="M131 231 C131 254 132 277 133 295 L144 295 C145 277 147 254 149 231 Z" fill="url(#sockTone)" />
          <path d="M108 294 Q118 288 128 294 L129 305 Q117 309 105 301 Z" fill="url(#shoeTone)" />
          <path d="M128 294 Q140 288 152 294 L153 305 Q140 310 126 301 Z" fill="url(#shoeTone)" />
          <path d="M104 202 Q126 212 148 202 L150 226 Q126 233 102 226 Z" fill="url(#skirtTone)" />
          <path d="M109 203 L109 226" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1" stroke-linecap="round" />
          <path d="M119 205 L119 228" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1" stroke-linecap="round" />
          <path d="M130 205 L130 228" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1" stroke-linecap="round" />
          <path d="M140 204 L140 226" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1" stroke-linecap="round" />
          <path d="M85 149 Q102 136 121 142 L110 210 Q92 208 77 220 Q75 182 85 149 Z" fill="url(#coatLight)" />
          <path d="M129 142 Q146 137 165 149 L174 213 Q158 209 144 206 L139 149 Z" fill="url(#coatLight)" />
          <path d="M102 145 Q120 138 138 144 L140 202 Q122 207 103 202 Z" fill="url(#vestTone)" />
          <path d="M92 143 Q108 132 123 140 L118 154 Q104 158 93 151 Z" fill="url(#coatAccent)" opacity=".92" />
          <path d="M129 140 Q145 134 160 145 L151 157 Q138 155 130 150 Z" fill="url(#coatAccent)" opacity=".78" />
          <path d="M116 136 h18" fill="none" stroke="rgba(255,255,255,.26)" stroke-width="2" stroke-linecap="round" />
          <path d="M112 158 Q126 153 140 158" fill="none" stroke="rgba(214,92,112,.58)" stroke-width="2.8" stroke-linecap="round" />
          <path d="M116 170 c0 -4 3 -7 7 -7 c3 0 5 1 7 4 c1 -3 4 -4 7 -4 c4 0 7 3 7 7 c0 5 -5 9 -14 15 c-9 -6 -14 -10 -14 -15 z" fill="rgba(242,102,146,.2)" />
          <rect x="122" y="136" width="11" height="18" rx="5.5" fill="url(#skinTone)" />
          <g transform="translate(-5 0)">
            <g class="avatar-head" transform="rotate(${s.tilt} 126 116)">
            <g class="avatar-hair-sway">
              <path d="M94 112 C94 90 108 59 135 59 C159 59 173 80 172 110 C171 128 163 141 153 149 C145 156 138 160 129 160 C120 160 112 158 105 153 C97 146 94 131 94 112 Z" fill="url(#hairTone)" />
              <path d="M102 126 C100 130 100 135 102 139 C105 137 107 134 108 130 C106 128 104 127 102 126 Z" fill="url(#hairShade)" />
              <path d="M156 124 C159 129 159 135 157 140 C154 138 151 134 150 130 C152 128 154 126 156 124 Z" fill="url(#hairShade)" />
              <path d="M99 95 C102 79 116 66 137 66 C156 66 170 76 172 94 C163 90 153 89 145 92 C136 86 127 85 119 89 C110 87 103 89 99 95 Z" fill="url(#hairTone)" />
              <path d="M103 86 C112 71 126 64 142 67 C135 77 125 84 114 90 C108 91 105 90 103 86 Z" fill="url(#hairLight)" opacity=".72" />
              <path d="M128 46 C127 35 133 27 139 29 C135 33 134 40 138 47" fill="none" stroke="url(#hairLight)" stroke-width="3.1" stroke-linecap="round" />
              <path d="M105 128 C104 132 104 136 106 139 C109 137 111 134 112 130 C110 129 108 128 105 128 Z" fill="url(#hairTone)" />
              <path d="M152 126 C154 131 154 137 152 141 C148 139 145 135 144 130 C146 128 149 127 152 126 Z" fill="url(#hairTone)" />
            </g>
            <path d="M94 111 C94 89 111 67 132 67 C153 67 170 86 170 110 C170 126 160 141 151 149 C145 154 139 159 132 162 C125 159 119 154 113 149 C104 141 94 126 94 111 Z" fill="url(#skinTone)" />
            <path d="M99 97 C102 82 116 69 137 69 C155 69 169 78 171 96 C162 92 153 91 145 93 C137 88 128 87 120 91 C112 88 104 90 99 97 Z" fill="url(#hairTone)" />
            <path d="M95 102 C104 91 112 89 119 94 C125 86 132 84 138 90 C145 84 153 85 163 98" fill="none" stroke="url(#hairLight)" stroke-width="2.8" stroke-linecap="round" opacity=".82" />
            <circle cx="99" cy="84" r="3" fill="#ff9db0" opacity=".92" />
            <rect x="102" y="80" width="10" height="3.2" rx="1.6" fill="#fff5f7" transform="rotate(-18 107 82)" opacity=".86" />
            <g class="avatar-face-features" transform="translate(5 0)">
              ${s.faceAccessory || ''}
              <g fill="none" stroke="#261822" stroke-width="3.1" stroke-linecap="round">${s.brows}</g>
              <g class="avatar-eyes">${s.eyes}</g>
              <g>${s.blush}</g>
              <path d="M124 124 q1 5 -1 10" fill="none" stroke="#c98c85" stroke-width="1.6" stroke-linecap="round" opacity=".7" />
              <circle cx="150" cy="145" r="1.4" fill="#966070" opacity=".58" />
              <g class="avatar-mouth" fill="none" stroke="#7d445d" stroke-width="2.8" stroke-linecap="round">${s.mouth}</g>
            </g>
          </g>
          </g>
          <g class="avatar-arms">${s.leftArm}${s.rightArm}</g>
        </g>
        <g class="screen-hud"><path d="M34 38 H90" /><path d="M150 38 H206" /><path d="M34 284 H82" /><path d="M159 284 H206" /><path d="M28 56 H44" /><path d="M196 56 H212" /><text x="38" y="52" class="avatar-hud-text">PENNY.EXE</text><text x="204" y="52" class="avatar-hud-text right">${s.label}</text><text x="38" y="274" class="avatar-hud-sub">CHARACTER LINK / ${mood.toUpperCase()}</text></g>
      </g>
      <rect x="18" y="18" width="204" height="284" rx="34" class="screen-shell" />
      <rect x="32" y="32" width="176" height="256" rx="28" class="screen-shell inner" />
      <circle cx="194" cy="44" r="3.4" class="status-dot" />
    </svg>
  `;
}

function relationshipLabel(score) {
  if (score < 10) return 'just met';
  if (score < 25) return 'warming up';
  if (score < 50) return 'getting close';
  if (score < 75) return 'trusted gremlin';
  return 'deep bond';
}

function relationshipNote(score) {
  if (score < 10) return 'Still doing the whole "figuring each other out" thing.';
  if (score < 25) return 'There is definitely a thread here now.';
  if (score < 50) return 'Penny is starting to feel lived-in instead of spun up.';
  if (score < 75) return 'This is where the companion part starts feeling real.';
  return 'Okay yeah, this is a whole creature-shaped continuity now.';
}

function updateBrainModeUi(meta = null) {
  const mode = state.memory.brainMode === 'local' ? 'local' : 'shadow';
  if (els.brainModeShadow) els.brainModeShadow.checked = mode === 'shadow';
  if (els.brainModeLocal) els.brainModeLocal.checked = mode === 'local';
  if (!els.brainModeNote) return;
  if (!meta) {
    els.brainModeNote.textContent = mode === 'shadow'
      ? 'Shadow brain uses the OpenClaw lane. It is still experimental.'
      : 'Local brain mode now talks directly to LM Studio.';
    return;
  }
  if (meta.requestedMode === 'shadow' && meta.usedFallback) {
    const reason = meta.shadowError ? ` ${meta.shadowError}` : '';
    els.brainModeNote.textContent = `Shadow failed, so this reply used the local placeholder fallback.${reason}`;
    return;
  }
  if (meta.backend === 'openclaw-shadow') {
    els.brainModeNote.textContent = 'Shadow brain handled the last reply.';
    return;
  }
  els.brainModeNote.textContent = mode === 'local'
    ? 'Local LM Studio brain handled the last reply.'
    : 'Shadow brain is selected; if it fails, Penny will block the reply instead of silently faking it.';
}

function svgTransformToCss(attr) {
  if (!attr) return '';
  return attr.replace(
    /translate\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/g,
    (_, x, y) => `translate(${x}px, ${y}px)`
  );
}

let _lastSpriteKey = '';
let _lastCharTransform = '';
let _spriteTimer = null;

function renderSprite(mood, palette, turns) {
  const container = els.coreFace;
  const key = `${mood}:${turns}`;
  if (key === _lastSpriteKey) return;

  const html = companionFaceSvg(mood, palette, turns);
  const hadSprite = !!container.querySelector('.avatar-sprite');

  if (!hadSprite) {
    container.innerHTML = html;
    const cg = container.querySelector('.avatar-character');
    if (cg) _lastCharTransform = cg.getAttribute('transform') || '';
    _lastSpriteKey = key;
    return;
  }

  const prevTransform = _lastCharTransform;
  if (_spriteTimer) { clearTimeout(_spriteTimer); _spriteTimer = null; }

  container.style.transition = 'opacity 80ms ease-out';
  container.style.opacity = '0.06';

  _spriteTimer = setTimeout(() => {
    container.innerHTML = html;
    const cg = container.querySelector('.avatar-character');
    const newTransform = cg?.getAttribute('transform') || '';
    _lastCharTransform = newTransform;

    if (cg && prevTransform && prevTransform !== newTransform) {
      cg.removeAttribute('transform');
      cg.style.transform = svgTransformToCss(prevTransform);
      requestAnimationFrame(() => {
        cg.style.transition = 'transform 220ms cubic-bezier(.22,.68,.36,1)';
        cg.style.transform = svgTransformToCss(newTransform);
      });
      setTimeout(() => {
        if (cg.isConnected) {
          cg.style.transition = '';
          cg.style.transform = '';
          cg.setAttribute('transform', newTransform);
        }
      }, 240);
    }

    container.style.transition = 'opacity 140ms ease-in';
    container.style.opacity = '1';
    _spriteTimer = setTimeout(() => {
      container.style.transition = '';
      _spriteTimer = null;
    }, 300);
    _lastSpriteKey = key;
  }, 90);
}

function updateTheme() {
  const palette = MOODS[state.mood] || MOODS.calm;
  document.documentElement.style.setProperty('--primary', palette.primary);
  document.documentElement.style.setProperty('--secondary', palette.secondary);
  document.documentElement.style.setProperty('--glow', palette.glow);
  document.documentElement.style.setProperty('--ring', palette.ring);
  els.moodPill.textContent = state.loading ? 'thinking' : palette.label;
  els.bondPill.textContent = relationshipLabel(state.memory.relationshipScore);
  els.bondBar.style.width = `${Math.max(6, Math.min(100, state.memory.relationshipScore))}%`;
  els.bondNote.textContent = relationshipNote(state.memory.relationshipScore);
  els.presenceValue.textContent = state.presence;
  els.turnsValue.textContent = String(state.turns);
  const statusText = state.loading ? 'processing' : state.consolidating ? 'saving memory' : state.syncingMemory ? 'syncing memory' : 'live';
  els.statusValue.textContent = statusText;
  els.statusValueTop.textContent = statusText;
  renderSprite(state.mood, palette, state.turns);
  els.shell.dataset.mood = state.mood;
}

function updateBackendStatusUi(status = null) {
  state.backendStatus = status;
  if (!els.backendReachability || !els.backendModel) return;

  const lmStudio = status?.lmStudio || status;
  if (!lmStudio) {
    els.backendReachability.textContent = 'unknown';
    els.backendModel.textContent = 'pending';
    return;
  }

  if (lmStudio.reachable) {
    els.backendReachability.textContent = status?.localLlmTransport
      ? `ready / ${status.localLlmTransport}`
      : 'ready';
    els.backendModel.textContent = lmStudio.resolvedModel || lmStudio.configuredModel || 'available';
    return;
  }

  els.backendReachability.textContent = 'offline';
  els.backendModel.textContent = lmStudio.error || lmStudio.hint || 'not detected';
}

function renderMessages() {
  els.chat.innerHTML = '';
  els.intro.hidden = state.messages.length !== 0;
  for (const msg of state.messages) {
    const item = document.createElement('div');
    item.className = `msg-row ${msg.role}`;
    if (msg.role === 'assistant') {
      const label = document.createElement('div');
      label.className = 'msg-label';
      label.textContent = 'PENNY';
      item.appendChild(label);
    }
    const bubble = document.createElement('div');
    bubble.className = `bubble ${msg.role}`;
    bubble.innerHTML = escapeHtml(msg.content).replace(/\n/g, '<br>');
    item.appendChild(bubble);
    els.chat.appendChild(item);
  }
  if (state.loading) {
    const loading = document.createElement('div');
    loading.className = 'msg-row assistant';
    loading.innerHTML = `<div class="msg-label">PENNY</div><div class="bubble assistant loading-bubble"><span></span><span></span><span></span></div>`;
    els.chat.appendChild(loading);
  }
  els.chat.parentElement.scrollTop = els.chat.parentElement.scrollHeight;
}

function renderFacts() {
  const facts = state.memory.facts || [];
  els.factList.className = `list-block${facts.length ? '' : ' empty'}`;
  els.factList.innerHTML = facts.length
    ? facts.map((item, index) => `<div class="list-item memory-item"><div class="memory-copy">${escapeHtml(item.fact)}<small>${escapeHtml(item.category || 'other')}</small></div><button class="memory-remove" data-kind="fact" data-index="${index}" type="button">x</button></div>`).join('')
    : 'No sticky facts yet. Penny\'s memory layer will start filling this in as you talk.';
}

function renderProfileNotes() {
  const notes = state.memory.profileNotes || [];
  els.profileNoteList.className = `list-block${notes.length ? '' : ' empty'}`;
  els.profileNoteList.innerHTML = notes.length
    ? notes.map((item, index) => `<div class="list-item memory-item"><div class="memory-copy">${escapeHtml(item.note)}<small>${escapeHtml(item.source || 'Penny\'s running impression')}</small></div><button class="memory-remove" data-kind="profileNote" data-index="${index}" type="button">x</button></div>`).join('')
    : 'No read yet. This is where Penny\'s impression starts feeling personal instead of archival.';
}

function renderSessions() {
  const sessions = state.memory.sessions || [];
  els.sessionList.className = `list-block${sessions.length ? '' : ' empty'}`;
  els.sessionList.innerHTML = sessions.length
    ? sessions.map((item, index) => `<div class="list-item memory-item"><div class="memory-copy">${escapeHtml(item.summary)}<small>${escapeHtml(item.date || '')}</small></div><button class="memory-remove" data-kind="session" data-index="${index}" type="button">x</button></div>`).join('')
    : 'No recent echoes yet. Only the strongest continuity crumbs should survive here.';
}

function renderMemory() {
  renderFacts();
  renderProfileNotes();
  renderSessions();
  els.nameInput.value = state.memory.userName || '';
  els.voiceToggle.checked = !!state.memory.voiceOn;
  updateBrainModeUi();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ memory: state.memory, messages: state.messages.slice(-16), mood: state.mood, turns: state.turns }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.memory = { ...structuredClone(DEFAULT_MEMORY), ...(parsed.memory || {}) };
    if (state.memory.brainMode !== 'local' && state.memory.brainMode !== 'shadow') state.memory.brainMode = 'shadow';
    state.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    state.mood = parsed.mood && MOODS[parsed.mood] ? parsed.mood : 'calm';
    state.turns = Number(parsed.turns || state.messages.filter(m => m.role === 'assistant').length || 0);
    state.presence = state.messages.length ? 'present' : 'idle';
  } catch {}
}

function applyDebugSpriteOverrides() {
  try {
    const params = new URLSearchParams(window.location.search);
    const debugMood = params.get('debugMood');
    const debugTurns = params.get('debugTurns');
    if (debugMood && MOODS[debugMood]) state.mood = debugMood;
    if (debugTurns !== null && debugTurns !== '') state.turns = Number(debugTurns) || 0;
    if (params.get('debugIdle') === '1') {
      state.messages = [];
      state.presence = 'idle';
    }
  } catch {}
}

function switchPanel(panel) {
  state.panel = panel;
  for (const tab of els.tabs) tab.classList.toggle('active', tab.dataset.panel === panel);
  for (const view of els.views) view.classList.toggle('active', view.dataset.view === panel);
}

function maybeSpeak(text) {
  if (!state.memory.voiceOn || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.03;
  utterance.pitch = 1.08;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function applyMemory(memory) {
  if (!memory) return;
  state.memory = {
    ...state.memory,
    ...memory,
    facts: Array.isArray(memory.facts) ? memory.facts : state.memory.facts,
    sessions: Array.isArray(memory.sessions) ? memory.sessions : state.memory.sessions,
    profileNotes: Array.isArray(memory.profileNotes) ? memory.profileNotes : state.memory.profileNotes,
    traits: Array.isArray(memory.traits) ? memory.traits : state.memory.traits,
  };
  if (state.memory.brainMode !== 'local' && state.memory.brainMode !== 'shadow') state.memory.brainMode = 'shadow';
}

async function memoryRequest(method, body, query = '') {
  const res = await fetch(`/api/penny/memory${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`Memory request failed: ${res.status}`);
  return res.json();
}

async function syncMemoryToDisk() {
  state.syncingMemory = true; updateTheme();
  try {
    const data = await memoryRequest('POST', { sessionId: state.memory.sessionId, memory: state.memory });
    applyMemory(data.memory); renderMemory(); saveState();
  } catch {} finally { state.syncingMemory = false; updateTheme(); }
}

async function loadDurableMemory() {
  state.syncingMemory = true; updateTheme();
  try {
    const res = await fetch(`/api/penny/memory?sessionId=${encodeURIComponent(state.memory.sessionId)}`);
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    applyMemory(data.memory); renderMemory(); saveState();
  } catch {} finally { state.syncingMemory = false; updateTheme(); }
}

async function patchMemory(patch) {
  state.syncingMemory = true; updateTheme();
  try {
    const data = await memoryRequest('PATCH', { sessionId: state.memory.sessionId, patch });
    applyMemory(data.memory); renderMemory(); saveState();
  } catch {} finally { state.syncingMemory = false; updateTheme(); }
}

async function loadBackendStatus() {
  try {
    const res = await fetch('/api/penny/status');
    if (!res.ok) throw new Error(`Status failed: ${res.status}`);
    const data = await res.json();
    updateBackendStatusUi(data);
    if (!data.shadowEnabled && state.memory.brainMode === 'shadow') {
      state.memory.brainMode = 'local';
      renderMemory();
      saveState();
      if (!state.syncingMemory) {
        await syncMemoryToDisk();
      }
    }
  } catch {
    updateBackendStatusUi({ reachable: false, error: 'Unable to reach Penny status route.' });
  }
}

async function consolidateMemory() {
  if (state.consolidating) return;
  state.consolidating = true; updateTheme();
  try {
    const res = await fetch('/api/penny/consolidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.memory.sessionId, messages: state.messages.slice(-8), memories: state.memory }) });
    if (!res.ok) throw new Error('Consolidation failed');
    const data = await res.json();
    applyMemory(data.memory); renderMemory(); saveState();
  } catch {} finally { state.consolidating = false; updateTheme(); }
}

async function sendMessage() {
  const userText = els.composer.value.trim();
  if (!userText || state.loading) return;
  state.messages.push({ role: 'user', content: userText });
  els.composer.value = ''; state.loading = true; state.presence = 'thinking'; renderMessages(); updateTheme(); saveState();
  try {
    const res = await fetch('/api/penny/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.memory.sessionId, messages: state.messages, memories: state.memory }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      updateBrainModeUi(data.meta || { requestedMode: state.memory.brainMode, usedFallback: false, shadowError: data.detail || data.error || `Request failed: ${res.status}` });
      throw new Error(data.detail || data.error || `Request failed: ${res.status}`);
    }
    const parsed = parseMood(data.text || 'Something glitched.');
    state.messages.push({ role: 'assistant', content: parsed.text });
    state.mood = parsed.mood; state.presence = 'present'; state.turns = data.meta?.turns || state.turns + 1; applyMemory(data.memory); maybeSpeak(parsed.text); updateBrainModeUi(data.meta || null);
  } catch (error) {
    const prefix = state.memory.brainMode === 'shadow'
      ? 'Shadow brain did not return a reply.'
      : 'Local LLM did not return a reply.';
    state.messages.push({ role: 'assistant', content: `${prefix} ${error?.message || 'Try again in a moment.'}` });
    state.mood = 'thinking'; state.presence = 'error';
  } finally {
    state.loading = false; renderMessages(); renderMemory(); updateTheme(); saveState(); els.composer.focus();
    loadBackendStatus();
    if (state.messages.length >= 2) setTimeout(() => consolidateMemory(), 120);
  }
}

for (const tab of els.tabs) tab.addEventListener('click', () => switchPanel(tab.dataset.panel));
els.send.addEventListener('click', sendMessage);
els.composer.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } });
els.nameInput.addEventListener('change', async () => { state.memory.userName = els.nameInput.value.trim(); saveState(); renderMemory(); await syncMemoryToDisk(); });
els.voiceToggle.addEventListener('change', async () => { state.memory.voiceOn = els.voiceToggle.checked; saveState(); await syncMemoryToDisk(); });
els.brainModeShadow?.addEventListener('change', async () => {
  if (!els.brainModeShadow.checked) return;
  state.memory.brainMode = 'shadow';
  saveState();
  renderMemory();
  await syncMemoryToDisk();
});
els.brainModeLocal?.addEventListener('change', async () => {
  if (!els.brainModeLocal.checked) return;
  state.memory.brainMode = 'local';
  saveState();
  renderMemory();
  await syncMemoryToDisk();
});
els.refreshMemory.addEventListener('click', loadDurableMemory);
els.clearFacts.addEventListener('click', async () => { await patchMemory({ facts: [] }); });
els.clearProfileNotes?.addEventListener('click', async () => { await patchMemory({ profileNotes: [] }); });
els.clearSessions.addEventListener('click', async () => { await patchMemory({ sessions: [] }); });
els.factList.addEventListener('click', async (event) => {
  const button = event.target.closest('.memory-remove'); if (!button || button.dataset.kind !== 'fact') return;
  const index = Number(button.dataset.index); const facts = [...(state.memory.facts || [])]; facts.splice(index, 1); await patchMemory({ facts });
});
els.profileNoteList?.addEventListener('click', async (event) => {
  const button = event.target.closest('.memory-remove'); if (!button || button.dataset.kind !== 'profileNote') return;
  const index = Number(button.dataset.index); const profileNotes = [...(state.memory.profileNotes || [])]; profileNotes.splice(index, 1); await patchMemory({ profileNotes });
});
els.sessionList.addEventListener('click', async (event) => {
  const button = event.target.closest('.memory-remove'); if (!button || button.dataset.kind !== 'session') return;
  const index = Number(button.dataset.index); const sessions = [...(state.memory.sessions || [])]; sessions.splice(index, 1); await patchMemory({ sessions });
});
els.newChat?.addEventListener('click', async () => {
  const freshSessionId = `penny-local-${Math.random().toString(36).slice(2, 10)}`;
  state.memory = { ...state.memory, sessionId: freshSessionId };
  state.messages = [];
  state.turns = 0;
  state.mood = 'calm';
  state.presence = 'idle';
  renderMessages();
  renderMemory();
  updateTheme();
  saveState();
  await syncMemoryToDisk();
});
els.clearMemory.addEventListener('click', async () => {
  localStorage.removeItem(STORAGE_KEY);
  const freshSessionId = `penny-local-${Math.random().toString(36).slice(2, 10)}`;
  state.memory = { ...structuredClone(DEFAULT_MEMORY), sessionId: freshSessionId };
  state.messages = []; state.turns = 0; state.mood = 'calm'; state.presence = 'idle';
  renderMessages(); renderMemory(); updateTheme(); saveState(); await syncMemoryToDisk();
});

loadState();
applyDebugSpriteOverrides();
renderMessages();
renderMemory();
updateTheme();
updateBrainModeUi();
loadDurableMemory();
loadBackendStatus();

window.__pennyDebug = (mood, turns) => {
  if (mood && MOODS[mood]) state.mood = mood;
  if (turns !== undefined) state.turns = Number(turns) || 0;
  _lastSpriteKey = '';
  updateTheme();
};
