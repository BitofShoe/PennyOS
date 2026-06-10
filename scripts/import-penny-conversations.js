const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ingestConversationThreads } = require('../lib/penny-knowledge-ingestion');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: node scripts/import-penny-conversations.js <input.json> [output.json]');
  }
  const resolvedInputPath = path.resolve(ROOT_DIR, inputPath);
  const resolvedOutputPath = process.argv[3]
    ? path.resolve(ROOT_DIR, process.argv[3])
    : path.join(OUTPUT_DIR, `conversation-ingest-${STAMP}.json`);
  const rawSourceText = fs.readFileSync(resolvedInputPath, 'utf8');
  const raw = JSON.parse(rawSourceText);
  const threads = Array.isArray(raw) ? raw : (Array.isArray(raw.threads) ? raw.threads : []);
  const ingested = ingestConversationThreads(threads, {
    sourceArtifact: {
      sourceType: 'conversation-export',
      originalPath: resolvedInputPath,
      originalName: path.basename(resolvedInputPath),
      rawSourceText,
      checksumSha256: crypto.createHash('sha256').update(rawSourceText).digest('hex'),
      bytes: Buffer.byteLength(rawSourceText, 'utf8'),
      processingStatus: 'parsed',
    },
  });
  ensureDir(path.dirname(resolvedOutputPath));
  fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(ingested, null, 2)}\n`);
  console.log(`Saved conversation ingestion artifact to ${resolvedOutputPath}`);
  console.log(`Ingested ${ingested.summary.importedThreadCount} thread(s), ${ingested.summary.chunkCount} chunk(s), and ${ingested.summary.promotionPacketCount} review packet(s).`);
  if (ingested.summary.skippedCandidateCount || ingested.summary.malformedMessageCount || ingested.summary.skippedLowSignalMessageCount) {
    console.log(`Skipped ${ingested.summary.skippedCandidateCount} candidate(s), ${ingested.summary.malformedMessageCount} malformed message(s), and ${ingested.summary.skippedLowSignalMessageCount} low-signal message(s).`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  }
}
