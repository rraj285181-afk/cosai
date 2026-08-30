import { getYouTubeTranscript } from './services/youtube.js';

async function runTest(url) {
  console.log(`\n=== Testing: ${url} ===`);
  try {
    const data = await getYouTubeTranscript(url);
    console.log(`Title: ${data.title}`);
    console.log(`Items count: ${data.items.length}`);
    console.log(`First 5 timestamped lines:\n`);
    console.log(data.transcriptText.split('\n').slice(0, 8).join('\n'));
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
  }
}

async function main() {
  await runTest('dQw4w9WgXcQ');
  await runTest('https://www.youtube.com/watch?v=k3_tw44QsZQ');
}

main();
