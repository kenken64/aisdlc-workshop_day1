#!/usr/bin/env node

const { spawn } = require('node:child_process');

const apiBase = (process.env.SNIP_API || 'http://localhost:3000').replace(/\/+$/, '');
const usage = `Usage:
  snip add <url>    Create a short link
  snip ls           List links and hit counts
  snip open <code>  Open the destination for a short code
  snip help         Show this help`;

function requireHttpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Provide a valid http or https URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Provide a valid http or https URL.');
  }
}

async function fetchApi(path, options) {
  try {
    return await fetch(`${apiBase}${path}`, options);
  } catch {
    throw new Error(`Could not reach the Snip API at ${apiBase}.`);
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function addLink(url) {
  requireHttpUrl(url);
  const response = await fetchApi('/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload?.error || `The API returned ${response.status}.`);
  }
  if (typeof payload?.shortUrl !== 'string') {
    throw new Error('The API response did not include a short URL.');
  }

  console.log(payload.shortUrl);
}

async function listLinks() {
  const response = await fetchApi('/api/links');
  const links = await readJson(response);

  if (!response.ok) {
    throw new Error(links?.error || `The API returned ${response.status}.`);
  }
  if (!Array.isArray(links)) {
    throw new Error('The API returned an invalid links list.');
  }
  if (links.length === 0) {
    console.log('No links yet.');
    return;
  }

  const codeWidth = Math.max(4, ...links.map((link) => String(link.code ?? '').length));
  const hitsWidth = Math.max(4, ...links.map((link) => String(link.hits ?? '').length));
  console.log(`${'CODE'.padEnd(codeWidth)}  ${'HITS'.padStart(hitsWidth)}  URL`);
  for (const link of links) {
    const code = String(link.code ?? '');
    const hits = String(link.hits ?? '');
    const url = String(link.url ?? '');
    console.log(`${code.padEnd(codeWidth)}  ${hits.padStart(hitsWidth)}  ${url}`);
  }
}

function openInBrowser(url) {
  let command;
  let args;
  if (process.platform === 'win32') {
    command = 'cmd.exe';
    args = ['/c', 'start', '', url];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', (error) => {
      reject(new Error(`Could not launch a browser: ${error.message}`));
    });
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function openLink(code) {
  const response = await fetchApi(`/${encodeURIComponent(code)}`, { redirect: 'manual' });
  if (response.status === 404) {
    throw new Error(`Unknown short code: ${code}`);
  }
  if (response.status >= 400) {
    const payload = await readJson(response);
    throw new Error(payload?.error || `The API returned ${response.status}.`);
  }

  const location = response.headers.get('location');
  if (!location) {
    throw new Error('The API did not return a redirect destination.');
  }

  let destination;
  try {
    destination = new URL(location);
  } catch {
    throw new Error('The API returned an invalid redirect destination.');
  }
  if (destination.protocol !== 'http:' && destination.protocol !== 'https:') {
    throw new Error('The API returned an invalid redirect destination.');
  }

  await openInBrowser(destination.href);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === 'help' || command === '-h' || command === '--help') {
    console.log(usage);
    return;
  }

  if (command === 'add') {
    if (args.length !== 1) throw new Error(`Usage: snip add <url>\n\n${usage}`);
    await addLink(args[0]);
    return;
  }

  if (command === 'ls') {
    if (args.length !== 0) throw new Error(`Usage: snip ls\n\n${usage}`);
    await listLinks();
    return;
  }

  if (command === 'open') {
    if (args.length !== 1) throw new Error(`Usage: snip open <code>\n\n${usage}`);
    await openLink(args[0]);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});