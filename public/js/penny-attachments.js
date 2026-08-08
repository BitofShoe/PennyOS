const IMAGE_RULES = {
  maxInputBytes: 12 * 1024 * 1024,
  targetBytes: 1100 * 1024,
  hardMaxBytes: 1600 * 1024,
  maxDimension: 1536,
  minDimension: 480,
  qualitySteps: [0.9, 0.82, 0.74, 0.66, 0.58],
  maxImages: 4,
  maxBatchBytes: 5 * 1024 * 1024,
};

const FILE_RULES = {
  maxInputBytes: 220 * 1024,
  maxPayloadChars: 180000,
  allowedExtensions: ['.txt', '.md', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.html', '.svg', '.yml', '.yaml', '.log', '.ps1', '.sh', '.example'],
};

const FOLDER_RULES = {
  maxFiles: 12,
  maxSourceBytes: 180 * 1024,
  maxPayloadChars: 180000,
  maxFileBytes: 64 * 1024,
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

function utf8ByteLength(text = '') {
  return new TextEncoder().encode(String(text || '')).length;
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

function normalizeRelativePath(file = {}) {
  const raw = String(file.webkitRelativePath || file.name || '').replace(/\\/g, '/');
  const parts = raw
    .split('/')
    .map(part => part.replace(/[\u0000-\u001f<>:"|?*]/g, '').trim())
    .filter(part => part && part !== '.' && part !== '..');
  return parts.join('/').slice(0, 240) || String(file.name || 'attached-file').slice(0, 180);
}

function folderSafeName(value = '') {
  const clean = String(value || 'folder')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '-')
    .trim()
    .slice(0, 80);
  return clean || 'folder';
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

export async function prepareFolderAttachment(files) {
  const selected = Array.from(files || []).filter(Boolean);
  if (!selected.length) throw new Error('Pick a folder with at least one text/code file.');

  const sorted = selected
    .map(file => ({ file, relativePath: normalizeRelativePath(file) }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const entries = [];
  const skipped = [];
  let sourceBytes = 0;
  let bodyLength = 0;

  for (const { file, relativePath } of sorted) {
    if (entries.length >= FOLDER_RULES.maxFiles) {
      skipped.push(`${relativePath} (file limit)`);
      continue;
    }
    if (!looksLikeSupportedTextFile(file)) {
      skipped.push(`${relativePath} (not text/code)`);
      continue;
    }
    if (Number(file.size || 0) > FOLDER_RULES.maxFileBytes) {
      skipped.push(`${relativePath} (over ${formatBytes(FOLDER_RULES.maxFileBytes)})`);
      continue;
    }

    let text = '';
    try {
      text = String(await file.text()).replace(/\r\n/g, '\n');
    } catch {
      skipped.push(`${relativePath} (could not read)`);
      continue;
    }
    if (!text.trim() || text.includes('\u0000')) {
      skipped.push(`${relativePath} (empty or binary)`);
      continue;
    }

    const bytes = utf8ByteLength(text);
    const block = `\n\n--- FILE: ${relativePath} (${text.split('\n').length} lines) ---\n${text}`;
    if (sourceBytes + bytes > FOLDER_RULES.maxSourceBytes || bodyLength + block.length > FOLDER_RULES.maxPayloadChars) {
      skipped.push(`${relativePath} (folder budget)`);
      continue;
    }
    sourceBytes += bytes;
    bodyLength += block.length;
    entries.push({ relativePath, text, lineCount: text.split('\n').length, bytes });
  }

  if (!entries.length) {
    throw new Error(`No supported text/code files fit in this folder. Pick up to ${FOLDER_RULES.maxFiles} small text files.`);
  }

  const rootName = folderSafeName(entries[0].relativePath.split('/')[0] || 'folder');
  const manifest = entries
    .map(entry => `- ${entry.relativePath} (${entry.lineCount} lines, ${formatBytes(entry.bytes)})`)
    .join('\n');
  const skippedSummary = skipped.length
    ? `\nSkipped ${skipped.length} selected file${skipped.length === 1 ? '' : 's'} because of type or safety limits.`
    : '';
  const text = [
    `Selected text-folder bundle: ${rootName}`,
    `Included ${entries.length} of ${selected.length} selected file${selected.length === 1 ? '' : 's'} (${formatBytes(sourceBytes)} before bundle framing).`,
    'These are only the files explicitly selected for this turn; this is not permission to browse the rest of the disk.',
    '',
    'Manifest:',
    manifest,
    skippedSummary,
    ...entries.map(entry => `--- FILE: ${entry.relativePath} (${entry.lineCount} lines) ---\n${entry.text}`),
  ].filter(Boolean).join('\n');

  if (text.length > FILE_RULES.maxPayloadChars || utf8ByteLength(text) > FILE_RULES.maxInputBytes) {
    throw new Error('That folder bundle is still too large. Pick fewer or smaller text files.');
  }

  return {
    name: `${rootName}.folder.md`,
    type: 'text/markdown',
    size: utf8ByteLength(text),
    text,
    lineCount: text.split('\n').length,
    folder: true,
    folderName: rootName,
    fileCount: entries.length,
    selectedFileCount: selected.length,
    skippedFileCount: skipped.length,
    relativePaths: entries.map(entry => entry.relativePath),
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

export async function prepareImageAttachments(files, { existingCount = 0, existingBytes = 0 } = {}) {
  const selected = Array.from(files || []).filter(Boolean);
  if (!selected.length) throw new Error('Pick at least one image first.');
  if (existingCount + selected.length > IMAGE_RULES.maxImages) {
    throw new Error(`Penny can take up to ${IMAGE_RULES.maxImages} images in one turn. Remove one first.`);
  }
  const images = [];
  for (const file of selected) images.push(await prepareImageAttachment(file));
  const totalBytes = Number(existingBytes || 0) + images.reduce((total, image) => total + Number(image.bytes || 0), 0);
  if (totalBytes > IMAGE_RULES.maxBatchBytes) {
    throw new Error(`Those images total ${formatBytes(totalBytes)} after prep. Keep the batch under ${formatBytes(IMAGE_RULES.maxBatchBytes)}.`);
  }
  return images;
}

export function createAttachmentUi({ els, setComposerNotice }) {
  let pendingImages = [];
  let pendingFile = null;

  function renderImagePreview() {
    const list = els.imagePreviewList;
    if (list) {
      list.replaceChildren();
      for (let index = 0; index < pendingImages.length; index += 1) {
        const image = pendingImages[index];
        const item = list.ownerDocument.createElement('div');
        item.className = 'image-preview-item';
        const preview = list.ownerDocument.createElement('img');
        preview.src = image.dataUrl;
        preview.alt = image.sourceName ? `Attached ${image.sourceName}` : `Attached image ${index + 1}`;
        const remove = list.ownerDocument.createElement('button');
        remove.className = 'image-preview-item-remove';
        remove.type = 'button';
        remove.title = `Remove image ${index + 1}`;
        remove.setAttribute('aria-label', `Remove image ${index + 1}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => removePendingImage(index));
        item.append(preview, remove);
        list.appendChild(item);
      }
    } else if (els.imagePreviewImg) {
      els.imagePreviewImg.src = pendingImages[0]?.dataUrl || '';
    }
    if (els.imagePreview) els.imagePreview.hidden = pendingImages.length === 0;
    if (els.imageBtn) els.imageBtn.classList.toggle('has-image', pendingImages.length > 0);
  }

  function attachImages(images, { append = false } = {}) {
    const next = Array.isArray(images) ? images.filter(Boolean) : [];
    pendingImages = append ? [...pendingImages, ...next] : next;
    renderImagePreview();
    const totalBytes = pendingImages.reduce((total, image) => total + Number(image.bytes || 0), 0);
    setComposerNotice(`${pendingImages.length} image${pendingImages.length === 1 ? '' : 's'} ready - ${formatBytes(totalBytes)} - sent only with this turn.`, 'ok');
  }

  function attachFile(file) {
    pendingFile = file;
    if (els.filePreviewName) els.filePreviewName.textContent = file.folder ? `${file.folderName} folder` : file.name;
    if (els.filePreviewMeta) {
      els.filePreviewMeta.textContent = file.folder
        ? `${file.fileCount}/${file.selectedFileCount} text files - ${formatBytes(file.size)}`
        : `${file.lineCount} lines - ${formatBytes(file.size)}`;
    }
    if (els.filePreview) els.filePreview.hidden = false;
    if (els.fileBtn) els.fileBtn.classList.add('has-file');
    if (els.folderBtn && file.folder) els.folderBtn.classList.add('has-file');
    const folderNote = file.folder && file.skippedFileCount
      ? ` (${file.skippedFileCount} skipped by limits)`
      : '';
    setComposerNotice(`${file.folder ? 'Folder bundle' : 'File'} ready - ${file.folder ? `${file.fileCount} text files` : file.name}${folderNote} - sent only with this turn.`, 'ok');
  }

  function clearPendingImages({ keepNotice = false } = {}) {
    pendingImages = [];
    renderImagePreview();
    if (els.imageInput) els.imageInput.value = '';
    if (!keepNotice) setComposerNotice('');
  }

  function removePendingImage(index) {
    pendingImages = pendingImages.filter((_image, candidateIndex) => candidateIndex !== index);
    renderImagePreview();
    if (!pendingImages.length) {
      if (els.imageInput) els.imageInput.value = '';
      setComposerNotice('');
      return;
    }
    const totalBytes = pendingImages.reduce((total, image) => total + Number(image.bytes || 0), 0);
    setComposerNotice(`${pendingImages.length} image${pendingImages.length === 1 ? '' : 's'} ready - ${formatBytes(totalBytes)} - sent only with this turn.`, 'ok');
  }

  function clearPendingFile({ keepNotice = false } = {}) {
    pendingFile = null;
    if (els.filePreview) els.filePreview.hidden = true;
    if (els.filePreviewName) els.filePreviewName.textContent = '';
    if (els.filePreviewMeta) els.filePreviewMeta.textContent = '';
    if (els.fileBtn) els.fileBtn.classList.remove('has-file');
    if (els.folderBtn) els.folderBtn.classList.remove('has-file');
    if (els.fileInput) els.fileInput.value = '';
    if (els.folderInput) els.folderInput.value = '';
    if (!keepNotice) setComposerNotice('');
  }

  function clearPendingAttachments() {
    clearPendingImages({ keepNotice: true });
    clearPendingFile({ keepNotice: true });
    setComposerNotice('');
  }

  return {
    attachImages,
    attachFile,
    clearPendingAttachments,
    clearPendingFile,
    clearPendingImage: clearPendingImages,
    clearPendingImages,
    getPendingFile: () => pendingFile,
    getPendingImage: () => pendingImages[0] || null,
    getPendingImages: () => [...pendingImages],
    removePendingImage,
  };
}
