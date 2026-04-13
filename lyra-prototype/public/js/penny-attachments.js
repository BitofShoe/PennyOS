const IMAGE_RULES = {
  maxInputBytes: 12 * 1024 * 1024,
  targetBytes: 1100 * 1024,
  hardMaxBytes: 1600 * 1024,
  maxDimension: 1536,
  minDimension: 480,
  qualitySteps: [0.9, 0.82, 0.74, 0.66, 0.58],
};

const FILE_RULES = {
  maxInputBytes: 220 * 1024,
  maxPayloadChars: 180000,
  allowedExtensions: ['.txt', '.md', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.html', '.svg', '.yml', '.yaml', '.log', '.ps1', '.sh', '.env'],
};

export function formatBytes(bytes = 0) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function estimateDataUrlBytes(dataUrl = '') {
  const base64 = String(dataUrl || '').split(',', 2)[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That image could not be opened.'));
    };
    img.src = objectUrl;
  });
}

function fileExtension(name = '') {
  const match = String(name || '').toLowerCase().match(/(\.[a-z0-9]+)$/i);
  return match ? match[1] : '';
}

function looksLikeSupportedTextFile(file) {
  const ext = fileExtension(file?.name || '');
  const type = String(file?.type || '').toLowerCase();
  if (FILE_RULES.allowedExtensions.includes(ext)) return true;
  if (!type) return false;
  return type.startsWith('text/')
    || type.includes('json')
    || type.includes('javascript')
    || type.includes('typescript')
    || type.includes('xml')
    || type.includes('yaml');
}

export async function prepareFileAttachment(file) {
  if (!file) throw new Error('Pick a file first.');
  if (!looksLikeSupportedTextFile(file)) {
    throw new Error('File attach is for text/code files right now. Use the camera button for images.');
  }
  if (file.size > FILE_RULES.maxInputBytes) {
    throw new Error(`That file is too large. Keep attached text/code files under ${formatBytes(FILE_RULES.maxInputBytes)}.`);
  }
  const text = (await file.text()).replace(/\r\n/g, '\n');
  if (text.includes('\u0000')) {
    throw new Error('That file looks binary. Attach a text/code file instead.');
  }
  if (text.length > FILE_RULES.maxPayloadChars) {
    throw new Error('That file is too long to ship in one turn. Trim it down or attach a smaller excerpt.');
  }
  return {
    name: file.name,
    type: file.type || 'text/plain',
    size: file.size || new Blob([text]).size,
    text,
    lineCount: text ? text.split('\n').length : 0,
  };
}

export async function prepareImageAttachment(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Pick a real image file first.');
  }
  if (file.size > IMAGE_RULES.maxInputBytes) {
    throw new Error(`That file is too big to prep locally. Keep it under ${formatBytes(IMAGE_RULES.maxInputBytes)} before upload.`);
  }
  const img = await loadImageElement(file);
  let width = Math.max(1, img.naturalWidth || img.width || 1);
  let height = Math.max(1, img.naturalHeight || img.height || 1);
  const scaleDown = Math.min(1, IMAGE_RULES.maxDimension / Math.max(width, height));
  width = Math.max(1, Math.round(width * scaleDown));
  height = Math.max(1, Math.round(height * scaleDown));

  let best = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Image prep failed: canvas context unavailable.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of IMAGE_RULES.qualitySteps) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const bytes = estimateDataUrlBytes(dataUrl);
      const candidate = {
        dataUrl,
        mime: 'image/jpeg',
        width,
        height,
        bytes,
        sourceName: file.name,
      };
      if (!best || bytes < best.bytes) best = candidate;
      if (bytes <= IMAGE_RULES.targetBytes) return candidate;
    }

    if (best && best.bytes <= IMAGE_RULES.hardMaxBytes) return best;

    const shrinkRatio = Math.max(0.68, Math.sqrt(IMAGE_RULES.targetBytes / Math.max(best?.bytes || 1, 1)) * 0.96);
    const minScale = IMAGE_RULES.minDimension / Math.max(width, height);
    const nextScale = Math.max(shrinkRatio, minScale);
    const nextWidth = Math.max(1, Math.round(width * nextScale));
    const nextHeight = Math.max(1, Math.round(height * nextScale));
    if ((nextWidth === width && nextHeight === height) || (width <= IMAGE_RULES.minDimension && height <= IMAGE_RULES.minDimension)) break;
    width = nextWidth;
    height = nextHeight;
  }

  if (best && best.bytes <= IMAGE_RULES.hardMaxBytes) return best;
  throw new Error(`Couldn't shrink that image enough. Keep the final upload under ${formatBytes(IMAGE_RULES.hardMaxBytes)}.`);
}

export function createAttachmentUi({ els, setComposerNotice }) {
  let pendingImage = null;
  let pendingFile = null;

  function attachImage(image) {
    pendingImage = image;
    if (els.imagePreviewImg) els.imagePreviewImg.src = image.dataUrl;
    if (els.imagePreview) els.imagePreview.hidden = false;
    if (els.imageBtn) els.imageBtn.classList.add('has-image');
    setComposerNotice(`Image ready - ${image.width}x${image.height} - ${formatBytes(image.bytes)}`, 'ok');
  }

  function attachFile(file) {
    pendingFile = file;
    if (els.filePreviewName) els.filePreviewName.textContent = file.name;
    if (els.filePreviewMeta) els.filePreviewMeta.textContent = `${file.lineCount} lines - ${formatBytes(file.size)}`;
    if (els.filePreview) els.filePreview.hidden = false;
    if (els.fileBtn) els.fileBtn.classList.add('has-file');
    setComposerNotice(`File ready - ${file.name} - ${file.lineCount} lines`, 'ok');
  }

  function clearPendingImage({ keepNotice = false } = {}) {
    pendingImage = null;
    if (els.imagePreview) els.imagePreview.hidden = true;
    if (els.imagePreviewImg) els.imagePreviewImg.src = '';
    if (els.imageBtn) els.imageBtn.classList.remove('has-image');
    if (els.imageInput) els.imageInput.value = '';
    if (!keepNotice) setComposerNotice('');
  }

  function clearPendingFile({ keepNotice = false } = {}) {
    pendingFile = null;
    if (els.filePreview) els.filePreview.hidden = true;
    if (els.filePreviewName) els.filePreviewName.textContent = '';
    if (els.filePreviewMeta) els.filePreviewMeta.textContent = '';
    if (els.fileBtn) els.fileBtn.classList.remove('has-file');
    if (els.fileInput) els.fileInput.value = '';
    if (!keepNotice) setComposerNotice('');
  }

  function clearPendingAttachments() {
    clearPendingImage({ keepNotice: true });
    clearPendingFile({ keepNotice: true });
    setComposerNotice('');
  }

  return {
    attachImage,
    attachFile,
    clearPendingAttachments,
    clearPendingFile,
    clearPendingImage,
    getPendingFile: () => pendingFile,
    getPendingImage: () => pendingImage,
  };
}
