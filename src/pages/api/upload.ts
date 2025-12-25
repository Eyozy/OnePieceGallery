import type { APIRoute } from 'astro';
import { Octokit } from 'octokit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetch as undici_fetch, ProxyAgent } from 'undici';

export const prerender = false;

// Simple slugify function
function createSlug(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { imageUrl, title, author, originalUrl } = body;

        if (!imageUrl || !title) {
            return new Response(JSON.stringify({ message: 'Missing required fields' }), { status: 400 });
        }

        const slug = `${createSlug(title)}-${Date.now()}`;
        const imageFilename = `${slug}.jpg`;

        const proxy = import.meta.env.HTTPS_PROXY || process.env.HTTPS_PROXY;
        console.log('[upload] HTTPS_PROXY from import.meta.env:', import.meta.env.HTTPS_PROXY);
        console.log('[upload] HTTPS_PROXY from process.env:', process.env.HTTPS_PROXY);
        console.log('[upload] Using proxy:', proxy || 'NONE');
        const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;

        // Headers to avoid 403 Forbidden on image download
        const headers = {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        };

        // Download Image using undici's fetch directly (supports dispatcher properly)
        console.log('[upload] Downloading image from:', imageUrl);
        const imageResponse = await undici_fetch(imageUrl, { headers, dispatcher });
        console.log('[upload] Image response status:', imageResponse.status, imageResponse.statusText);

        if (!imageResponse.ok) {
            console.error('[upload] Failed to download image. Status:', imageResponse.status);
            throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        // Prepare Markdown Content
        const markdownContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "Image by ${author}"
image: "../../assets/images/uploads/${imageFilename}"
originalUrl: "${originalUrl}"
author: "${author}"
date: ${new Date().toISOString()}
---
`;

        const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
        const GITHUB_OWNER = import.meta.env.GITHUB_OWNER || process.env.GITHUB_OWNER;
        const GITHUB_REPO = import.meta.env.GITHUB_REPO || process.env.GITHUB_REPO;

        // STRATEGY: GitHub API if configured, else Local FS
        if (GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO) {
            const octokit = new Octokit({ auth: GITHUB_TOKEN });

            // Upload Image
            await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                path: `src/assets/images/uploads/${imageFilename}`,
                message: `Add image: ${title}`,
                content: base64Image,
                encoding: 'base64',
            });

            // Upload Markdown
            await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                path: `src/content/gallery/${slug}.md`,
                message: `Add gallery item: ${title}`,
                content: Buffer.from(markdownContent).toString('base64'),
                encoding: 'base64',
            });

            return new Response(JSON.stringify({ message: 'Saved to GitHub successfully! Site rebuild triggered.' }), { status: 200 });

        } else {
            // Local Filesystem Fallback (for local dev)
            if (import.meta.env.PROD) {
                return new Response(JSON.stringify({ message: 'GITHUB_TOKEN not configured for production environment.' }), { status: 500 });
            }

            const projectRoot = process.cwd();
            const assetsDir = path.join(projectRoot, 'src/assets/images/uploads');
            const contentDir = path.join(projectRoot, 'src/content/gallery');

            await fs.mkdir(assetsDir, { recursive: true });
            await fs.mkdir(contentDir, { recursive: true });

            await fs.writeFile(path.join(assetsDir, imageFilename), buffer);
            await fs.writeFile(path.join(contentDir, `${slug}.md`), markdownContent);

            return new Response(JSON.stringify({ message: 'Saved to local filesystem.' }), { status: 200 });
        }

    } catch (error: unknown) {
        console.error('[upload] Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ message: 'Error processing upload', error: errorMessage }), { status: 500 });
    }
};
